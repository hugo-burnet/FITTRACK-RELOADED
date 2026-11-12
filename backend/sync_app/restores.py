"""Recover a trusted export into a NEW, offline instance; never replace live data."""

import hashlib
import json
import os
import secrets
import shutil
import sqlite3
import stat
import uuid
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path

from django.apps import apps
from django.db.migrations.loader import MigrationLoader


def _read_regular(path):
    # The export's parent must be administrator-controlled. O_NOFOLLOW also
    # closes the last-component symlink race on the Linux deployment target.
    if path.is_symlink():
        raise ValueError('Export entries must not be links.')
    descriptor = os.open(path, os.O_RDONLY | getattr(os, 'O_NOFOLLOW', 0) | getattr(os, 'O_NONBLOCK', 0))
    stream = os.fdopen(descriptor, 'rb')
    if not stat.S_ISREG(os.fstat(stream.fileno()).st_mode) or path.is_symlink():
        stream.close()
        raise ValueError('Export entries must be regular files, not links.')
    return stream


def _write_private(path, value):
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w', encoding='utf-8') as output:
        output.write(value + '\n')
        output.flush()
        os.fsync(output.fileno())


def _sync_directory(path):
    if os.name != 'nt':
        descriptor = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
        try:
            os.fsync(descriptor)
        finally:
            os.close(descriptor)


def _manifest(source):
    if source.is_symlink() or not source.is_dir():
        raise ValueError('Choose a trusted export directory, not a link.')
    with _read_regular(source / 'manifest.json') as stream:
        raw = stream.read(16385)
    if len(raw) > 16384:
        raise ValueError('Manifest too large.')
    value = json.loads(raw)
    if (
        type(value) is not dict
        or value.get('format') != 'fittrack-server-backup'
        or type(value.get('version')) is not int or value['version'] != 1
        or value.get('database') != 'database.sqlite3'
        or not isinstance(value.get('sourceGeneration'), str)
        or not isinstance(value.get('sha256'), str)
        or len(value['sha256']) != 64
        or any(char not in '0123456789abcdef' for char in value['sha256'])
    ):
        raise ValueError('Unsupported backup manifest.')
    uuid.UUID(value['sourceGeneration'])
    return value


def _revoke_sessions(database):
    with closing(sqlite3.connect(database)) as connection:
        if connection.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
            raise ValueError('SQLite integrity check failed.')
        actual = set(connection.execute('SELECT app, name FROM django_migrations'))
        expected = set(MigrationLoader(None).disk_migrations)
        # No guessing how to recover credentials belonging to a future schema.
        if actual != expected:
            raise ValueError('Restore with the matching backend version before migrating.')
        for model in apps.get_models(include_auto_created=True):
            if not model._meta.managed or model._meta.proxy:
                continue
            table = model._meta.db_table.replace('"', '""')
            columns = {row[1] for row in connection.execute(f'PRAGMA table_info("{table}")')}
            expected_columns = {field.column for field in model._meta.local_concrete_fields}
            if columns != expected_columns:
                raise ValueError('Backup schema does not match the recorded migrations.')
        if connection.execute('PRAGMA foreign_key_check').fetchone() is not None:
            raise ValueError('SQLite foreign key check failed.')
        connection.execute('DELETE FROM django_session')
        connection.commit()
        connection.execute('PRAGMA journal_mode=DELETE')


def restore_backup(source, destination):
    """The caller activates this instance only after checks and an explicit stop.

    New credentials live in secrets/, outside the independently backed-up data/.
    Keep the original instance and export for rollback; neither is modified.
    """
    source, destination = Path(source), Path(destination)
    if destination.resolve().is_relative_to(source.resolve()):
        raise ValueError('Restore outside the export so credentials cannot enter a backup.')
    manifest = _manifest(source)
    destination.mkdir(mode=0o700)
    try:
        data, credentials = destination / 'data', destination / 'secrets'
        data.mkdir(mode=0o700)
        credentials.mkdir(mode=0o700)
        database = data / 'fittrack.sqlite3'
        digest = hashlib.sha256()
        with _read_regular(source / 'database.sqlite3') as original:
            descriptor = os.open(database, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
            with os.fdopen(descriptor, 'wb') as output:
                for chunk in iter(lambda: original.read(1024 * 1024), b''):
                    digest.update(chunk)
                    output.write(chunk)
        if digest.hexdigest() != manifest['sha256']:
            raise ValueError('Backup checksum mismatch.')
        _revoke_sessions(database)
        with database.open('r+b') as output:
            os.fsync(output.fileno())
        generation = str(uuid.uuid4())
        _write_private(credentials / 'generation', generation)
        _write_private(credentials / 'django-key', secrets.token_urlsafe(64))
        # Backups can predate account deletions. The operator must reconcile
        # restored accounts with deletion requests before allowing any login.
        _write_private(data / 'account-review-required', 'Review deleted accounts before removing this marker.')
        result = {
            'format': 'fittrack-restored-instance', 'version': 1,
            'createdAt': datetime.now(timezone.utc).isoformat(),
            'backupSha256': manifest['sha256'], 'generation': generation,
            'accountReviewRequired': True,
        }
        _write_private(destination / 'restore.json', json.dumps(result, sort_keys=True))
        for path in (data, credentials, destination, destination.parent):
            _sync_directory(path)
    except BaseException:
        # mkdir succeeded above: this is exclusively the new offline instance.
        shutil.rmtree(destination)
        raise
    return result
