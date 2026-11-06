from .base import *  # noqa: F403

SECRET_KEY = 'test-only-key-never-use-this-module-for-deployment'
SYNC_GENERATION = '11111111-1111-4111-8111-111111111111'
ALLOWED_HOSTS = ['testserver']
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']
TEST_DATA = BASE_DIR / '.data'  # noqa: F405
TEST_DATA.mkdir(exist_ok=True)
DATABASES = {'default': sqlite_database(TEST_DATA / 'unused.sqlite3')}  # noqa: F405
# Real file-backed SQLite exercises write serialization across connections.
DATABASES['default']['TEST'] = {'NAME': str(TEST_DATA / 'test-sync.sqlite3')}
