from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DEBUG = False
ROOT_URLCONF = 'fittrack_server.urls'
INSTALLED_APPS = [
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'sync_app',
]
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'sync_app.middleware.SessionGenerationMiddleware',
]
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
USE_TZ = True
TIME_ZONE = 'UTC'
PASSWORD_HASHERS = ['django.contrib.auth.hashers.Argon2PasswordHasher']
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = True
SESSION_COOKIE_SAMESITE = 'Strict'
CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = True
SESSION_COOKIE_AGE = 7 * 24 * 60 * 60
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'same-origin'
MAX_SYNC_BYTES = 16 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = MAX_SYNC_BYTES


def sqlite_database(path):
    return {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': str(path),
        # SQLite select_for_update() cannot serialize the revision decision.
        # Acquire its write lock when the outer atomic transaction begins.
        'OPTIONS': {'transaction_mode': 'IMMEDIATE', 'timeout': 20},
    }
