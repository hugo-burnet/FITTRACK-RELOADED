import hashlib
import importlib.util
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from contextlib import closing
from pathlib import Path


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.source = self.root / 'fittrack.sqlite3'
        self.connection = sqlite3.connect(self.source)
        self.addCleanup(self.connection.close)
        self.connection.execute('PRAGMA journal_mode=WAL')
        self.connection.execute('CREATE TABLE records (value TEXT)')
        self.connection.execute("INSERT INTO records VALUES ('committed')")
        self.connection.commit()
        self.destination = self.root / 'export'

    def backup(self, source=None):
        from sync_app.backups import create_backup
        return create_backup(source or self.source, self.destination, '11111111-1111-4111-8111-111111111111')

    def test_export_contains_committed_wal_and_excludes_uncommitted_writes(self):
        self.connection.execute("INSERT INTO records VALUES ('pending')")
        self.backup()
        with closing(sqlite3.connect(self.destination / 'database.sqlite3')) as restored:
            self.assertEqual(restored.execute('SELECT value FROM records').fetchall(), [('committed',)])
            self.assertEqual(restored.execute('PRAGMA integrity_check').fetchone(), ('ok',))
            self.assertEqual(restored.execute('PRAGMA journal_mode').fetchone(), ('delete',))
        manifest = json.loads((self.destination / 'manifest.json').read_text())
        self.assertEqual(manifest['format'], 'fittrack-server-backup')
        self.assertEqual(manifest['version'], 1)
        self.assertEqual(manifest['sourceGeneration'], '11111111-1111-4111-8111-111111111111')
        self.assertEqual(manifest['sha256'], hashlib.sha256((self.destination / 'database.sqlite3').read_bytes()).hexdigest())
        self.assertEqual({file.name for file in self.destination.iterdir()}, {'database.sqlite3', 'manifest.json'})
        self.assertEqual(self.connection.execute('SELECT value FROM records').fetchall(), [('committed',), ('pending',)])

    def test_existing_destination_is_preserved(self):
        self.destination.mkdir()
        sentinel = self.destination / 'keep'
        sentinel.write_text('existing export')
        with self.assertRaises(FileExistsError):
            self.backup()
        self.assertEqual(sentinel.read_text(), 'existing export')
        self.assertEqual(list(self.destination.iterdir()), [sentinel])

    def test_missing_source_is_not_created_and_leaves_no_export(self):
        missing = self.root / 'missing.sqlite3'
        with self.assertRaises((FileNotFoundError, sqlite3.Error)):
            self.backup(missing)
        self.assertFalse(missing.exists())
        self.assertFalse(self.destination.exists())

    @unittest.skipIf(os.name == 'nt', 'Creating symlinks may require Windows privileges')
    def test_existing_symlink_is_not_followed(self):
        existing = self.root / 'other-export'
        existing.mkdir()
        sentinel = existing / 'keep'
        sentinel.write_text('keep')
        self.destination.symlink_to(existing, target_is_directory=True)
        with self.assertRaises(FileExistsError):
            self.backup()
        self.assertTrue(self.destination.is_symlink())
        self.assertEqual(list(existing.iterdir()), [sentinel])

    def test_corrupt_database_leaves_no_export(self):
        corrupt = self.root / 'corrupt.sqlite3'
        corrupt.write_bytes(b'not a sqlite database')
        with self.assertRaises(sqlite3.DatabaseError):
            self.backup(corrupt)
        self.assertFalse(self.destination.exists())
        self.assertEqual(corrupt.read_bytes(), b'not a sqlite database')

    @unittest.skipIf(os.name == 'nt', 'POSIX permission bits are not Windows ACLs')
    def test_export_has_private_permissions(self):
        self.backup()
        self.assertEqual(self.destination.stat().st_mode & 0o777, 0o700)
        for file in self.destination.iterdir():
            self.assertEqual(file.stat().st_mode & 0o777, 0o600)

    @unittest.skipUnless(importlib.util.find_spec('django'), 'Django integration runs in the backend environment')
    def test_management_command_exports_explicit_database(self):
        secret = self.root / 'secret'
        secret.write_text('test-only-backup-key-' * 4)
        secret.chmod(0o600)
        generation = self.root / 'generation'
        generation.write_text('11111111-1111-4111-8111-111111111111')
        environment = {key: value for key, value in os.environ.items() if not key.startswith('FITTRACK_')}
        environment.update(
            FITTRACK_SECRET_FILE=str(secret), FITTRACK_GENERATION_FILE=str(generation),
            FITTRACK_DATA_DIR=str(self.root), FITTRACK_ALLOWED_HOSTS='test.example',
        )
        result = subprocess.run(
            [sys.executable, 'manage.py', 'backup_sync', str(self.destination), '--settings=fittrack_server.settings'],
            cwd=Path(__file__).parents[2], env=environment, text=True, capture_output=True, timeout=15,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn(secret.read_text(), result.stdout + result.stderr)
        with closing(sqlite3.connect(self.destination / 'database.sqlite3')) as restored:
            self.assertEqual(restored.execute('SELECT value FROM records').fetchall(), [('committed',)])
