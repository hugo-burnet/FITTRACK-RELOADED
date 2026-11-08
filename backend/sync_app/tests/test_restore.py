import hashlib
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
import uuid
from contextlib import closing
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TransactionTestCase, override_settings

from sync_app.backups import create_backup
from sync_app.models import SyncHead
from sync_app.tests.test_protocol import authenticated_client, message


class RestoreTests(TransactionTestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.export = self.root / 'export'
        self.destination = self.root / 'new-instance'
        self.alice = get_user_model().objects.create_user('alice', password='test-password')
        self.bob = get_user_model().objects.create_user('bob', password='test-password')
        self.client = authenticated_client(self.alice)
        other = authenticated_client(self.bob)
        for client, label in ((self.client, 'alice'), (other, 'bob')):
            self.assertEqual(client.post('/api/sync/publish', message(label), content_type='application/json').status_code, 200)
        create_backup(settings.DATABASES['default']['NAME'], self.export, settings.SYNC_GENERATION)

    def restore(self):
        from sync_app.restores import restore_backup
        return restore_backup(self.export, self.destination)

    def test_restored_instance_preserves_accounts_and_snapshots_and_revokes_sessions(self):
        result = self.restore()
        generation = (self.destination / 'secrets' / 'generation').read_text().strip()
        self.assertEqual(str(uuid.UUID(generation)), generation)
        self.assertNotEqual(generation, settings.SYNC_GENERATION)
        self.assertEqual(result['generation'], generation)
        secret = (self.destination / 'secrets' / 'django-key').read_text().strip()
        self.assertGreaterEqual(len(secret), 50)
        self.assertNotEqual(secret, settings.SECRET_KEY)
        with closing(sqlite3.connect(self.destination / 'data' / 'fittrack.sqlite3')) as restored:
            self.assertEqual(restored.execute('SELECT username FROM auth_user ORDER BY username').fetchall(), [('alice',), ('bob',)])
            self.assertEqual(restored.execute('SELECT COUNT(*) FROM django_session').fetchone(), (0,))
            self.assertEqual(restored.execute('SELECT revision FROM sync_app_synchead').fetchall(), [(1,), (1,)])
            self.assertEqual(restored.execute('SELECT COUNT(*) FROM sync_app_syncoperation').fetchone(), (2,))
            snapshots = [json.loads(row[0]) for row in restored.execute('SELECT snapshot FROM sync_app_synchead ORDER BY owner_id')]
            self.assertEqual([s['tables']['settings'][0]['value'] for s in snapshots], ['alice', 'bob'])
            self.assertEqual(restored.execute('PRAGMA integrity_check').fetchone(), ('ok',))
        self.assertEqual(self.client.get('/api/sync/state').status_code, 200)
        with override_settings(SYNC_GENERATION=generation):
            self.assertEqual(self.client.get('/api/sync/state').status_code, 401)
        self.assertEqual(SyncHead.objects.count(), 2)

    def test_each_restore_has_distinct_generation_and_secret(self):
        self.restore()
        first = self.destination
        self.destination = self.root / 'second-instance'
        self.restore()
        for name in ('generation', 'django-key'):
            self.assertNotEqual((first / 'secrets' / name).read_bytes(), (self.destination / 'secrets' / name).read_bytes())

    def test_existing_destination_and_export_are_preserved(self):
        self.destination.mkdir()
        sentinel = self.destination / 'keep'
        sentinel.write_text('existing data')
        before = (self.export / 'database.sqlite3').read_bytes()
        with self.assertRaises(FileExistsError):
            self.restore()
        self.assertEqual(sentinel.read_text(), 'existing data')
        self.assertEqual((self.export / 'database.sqlite3').read_bytes(), before)

    def test_corrupt_database_does_not_create_an_instance(self):
        with (self.export / 'database.sqlite3').open('ab') as database:
            database.write(b'changed after export')
        with self.assertRaises(ValueError):
            self.restore()
        self.assertFalse(self.destination.exists())

    def test_manifest_cannot_choose_a_path_or_unknown_version(self):
        path = self.export / 'manifest.json'
        original = json.loads(path.read_text())
        for field, value in [('database', '../fittrack.sqlite3'), ('version', 2), ('version', True), ('sourceGeneration', 'invalid'), ('sourceGeneration', 123)]:
            path.write_text(json.dumps(original | {field: value}))
            with self.subTest(field=field, value=value), self.assertRaises(ValueError):
                self.restore()
            self.assertFalse(self.destination.exists())

    def test_destination_cannot_put_fresh_secrets_inside_the_export(self):
        self.destination = self.export / 'recovered'
        with self.assertRaises(ValueError):
            self.restore()
        self.assertFalse(self.destination.exists())

    @unittest.skipIf(os.name == 'nt', 'POSIX FIFO')
    def test_fifo_input_is_refused_without_waiting_for_a_writer(self):
        database = self.export / 'database.sqlite3'
        database.unlink()
        os.mkfifo(database)
        script = (
            'import sys\nfrom sync_app.restores import restore_backup\n'
            'try:\n    restore_backup(sys.argv[1], sys.argv[2])\n'
            'except ValueError:\n    sys.exit(0)\nsys.exit(1)\n'
        )
        result = subprocess.run([sys.executable, '-c', script, str(self.export), str(self.destination)],
                                cwd=Path(__file__).parents[2], capture_output=True, timeout=5)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.destination.exists())

    def test_export_missing_manifest_is_refused(self):
        (self.export / 'manifest.json').unlink()
        with self.assertRaises((ValueError, FileNotFoundError)):
            self.restore()
        self.assertFalse(self.destination.exists())

    def test_incompatible_database_is_refused_even_with_matching_digest(self):
        database = self.export / 'database.sqlite3'
        with closing(sqlite3.connect(database)) as changed:
            changed.execute("UPDATE django_migrations SET name='9999_future' WHERE app='sync_app'")
            changed.commit()
        manifest_path = self.export / 'manifest.json'
        manifest = json.loads(manifest_path.read_text())
        manifest['sha256'] = hashlib.sha256(database.read_bytes()).hexdigest()
        manifest_path.write_text(json.dumps(manifest))
        with self.assertRaises(ValueError):
            self.restore()
        self.assertFalse(self.destination.exists())

    def test_missing_table_or_column_is_refused_despite_matching_migrations(self):
        database = self.export / 'database.sqlite3'
        original = database.read_bytes()
        for statement in ('DROP TABLE sync_app_syncoperation', 'ALTER TABLE sync_app_synchead DROP COLUMN snapshot'):
            database.write_bytes(original)
            with closing(sqlite3.connect(database)) as changed:
                changed.execute(statement)
                changed.commit()
            manifest_path = self.export / 'manifest.json'
            manifest = json.loads(manifest_path.read_text())
            manifest['sha256'] = hashlib.sha256(database.read_bytes()).hexdigest()
            manifest_path.write_text(json.dumps(manifest))
            with self.subTest(statement=statement), self.assertRaises(ValueError):
                self.restore()
            self.assertFalse(self.destination.exists())

    @unittest.skipIf(os.name == 'nt', 'POSIX file permissions and symlinks')
    def test_symlink_export_or_database_is_refused(self):
        original = self.export
        self.export = self.root / 'alias'
        self.export.symlink_to(original, target_is_directory=True)
        with self.assertRaises(ValueError):
            self.restore()
        self.export = original
        database = self.export / 'database.sqlite3'
        database.rename(self.root / 'elsewhere.sqlite3')
        database.symlink_to(self.root / 'elsewhere.sqlite3')
        with self.assertRaises(ValueError):
            self.restore()
        self.assertFalse(self.destination.exists())

    @unittest.skipIf(os.name == 'nt', 'POSIX permissions are not Windows ACLs')
    def test_new_instance_is_private(self):
        self.restore()
        for path in [self.destination, *self.destination.rglob('*')]:
            self.assertEqual(path.stat().st_mode & 0o777, 0o700 if path.is_dir() else 0o600)

    def test_management_command_creates_only_the_requested_new_instance(self):
        call_command('restore_sync', str(self.export), str(self.destination), verbosity=0)
        self.assertTrue((self.destination / 'restore.json').is_file())
