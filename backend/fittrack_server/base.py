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
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
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
CSRF_COOKIE_SAMESITE = 'Strict'
SESSION_COOKIE_AGE = 7 * 24 * 60 * 60
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = 'same-origin'
MAX_SYNC_BYTES = 16 * 1024 * 1024
# An empty JSON array costs ~56 bytes once decoded for 3 bytes on the wire:
# bound containers before json.loads so 16 MiB cannot become ~350 MB.
MAX_SYNC_CONTAINERS = 1_000_000
# A client publishes at most once per 30 s poll per device.
SYNC_PUBLISH_ATTEMPTS = 120
# Only one large JSON decode/encode at a time per container (see views.py).
SYNC_HEAVY_LOCK_FILE = None
# None: REMOTE_ADDR. Deployment names the header its sole proxy rewrites.
AUTH_CLIENT_ADDRESS_HEADER = None
MAX_AUTH_BYTES = 8192
MAX_PERSONAL_EXPORT_BYTES = MAX_SYNC_BYTES + 8192
ACCOUNT_REVIEW_REQUIRED = False
AUTH_ATTEMPT_WINDOW_SECONDS = 15 * 60
AUTH_ACCOUNT_ATTEMPTS = 5
AUTH_GLOBAL_ATTEMPTS = 30
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 12}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]
DATA_UPLOAD_MAX_MEMORY_SIZE = MAX_SYNC_BYTES


def sqlite_database(path):
    return {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': str(path),
        # SQLite select_for_update() cannot serialize the revision decision.
        # Acquire its write lock when the outer atomic transaction begins.
        'OPTIONS': {'transaction_mode': 'IMMEDIATE', 'timeout': 20},
    }
