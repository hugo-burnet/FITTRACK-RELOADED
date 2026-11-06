"""Consistent private SQLite exports; never restores a live service."""

import hashlib
import json
import os
import shutil
import sqlite3
import time
import uuid
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path


def create_backup(source, destination, generation, timeout=30):
    """Create a new export directory, with manifest.json written last.

    The parent directory must be controlled by the service administrator.
    The source generation is metadata only, never a generation to restore.
    """
    source = Path(source).resolve(strict=True)
    generation = str(uuid.UUID(str(generation)))
    if timeout <= 0:
        raise ValueError('Backup timeout must be positive.')
    destination = Path(destination)
    # mkdir without exist_ok refuses existing files, directories and symlinks.
    destination.mkdir(mode=0o700)
    try:
        database = destination / 'database.sqlite3'
        with database.open('xb'):
            pass
        database.chmod(0o600)
        deadline = time.monotonic() + timeout

        def progress(status, remaining, total):
            if time.monotonic() > deadline:
                raise TimeoutError('SQLite export exceeded its time limit.')

        with closing(sqlite3.connect(source.as_uri() + '?mode=ro', uri=True)) as live:
            with closing(sqlite3.connect(database)) as copy:
                live.backup(copy, pages=256, progress=progress, sleep=0.05)
                # A portable export must not require WAL/SHM companion files.
                if copy.execute('PRAGMA journal_mode=DELETE').fetchone() != ('delete',):
                    raise sqlite3.DatabaseError('Export could not leave WAL mode.')
                if copy.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
                    raise sqlite3.DatabaseError('Export failed SQLite integrity check.')

        digest = hashlib.sha256()
        # Windows FlushFileBuffers requires a writable descriptor.
        with database.open('r+b') as exported:
            for chunk in iter(lambda: exported.read(1024 * 1024), b''):
                digest.update(chunk)
            os.fsync(exported.fileno())
        manifest = {
            'format': 'fittrack-server-backup',
            'version': 1,
            'createdAt': datetime.now(timezone.utc).isoformat(),
            'sourceGeneration': generation,
            'database': 'database.sqlite3',
            'sha256': digest.hexdigest(),
        }
        descriptor = os.open(destination / 'manifest.json', os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, 'w', encoding='utf-8') as output:
            json.dump(manifest, output, sort_keys=True)
            output.write('\n')
            output.flush()
            os.fsync(output.fileno())
        if os.name != 'nt':
            # Persist both the files' directory entries and the new export's
            # entry in its parent before reporting success.
            for path in (destination, destination.parent):
                directory = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
                try:
                    os.fsync(directory)
                finally:
                    os.close(directory)
    except BaseException:
        # Only this call's newly created export can be removed.
        shutil.rmtree(destination)
        raise
    return manifest
