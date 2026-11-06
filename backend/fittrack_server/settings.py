"""Deployment-only settings: missing secrets or hosts must stop startup."""

import os
import re
import uuid
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403


def read_required_file(variable, secret=False):
    name = os.environ.get(variable)
    if not name:
        raise ImproperlyConfigured(f'{variable} is required.')
    path = Path(name)
    try:
        if secret and os.name != 'nt' and path.stat().st_mode & 0o027:
            raise ImproperlyConfigured('Secret file has overly broad permissions.')
        value = path.read_text(encoding='utf-8').strip()
    except OSError:
        raise ImproperlyConfigured(f'{variable} must point to a readable file.') from None
    if not value:
        raise ImproperlyConfigured(f'{variable} must not be empty.')
    return value


SECRET_KEY = read_required_file('FITTRACK_SECRET_FILE', secret=True)
if len(SECRET_KEY) < 50:
    raise ImproperlyConfigured('Provide a randomly generated secret of at least 50 characters.')

try:
    SYNC_GENERATION = str(uuid.UUID(read_required_file('FITTRACK_GENERATION_FILE')))
except ValueError:
    raise ImproperlyConfigured('Generation file must contain a UUID.') from None

ALLOWED_HOSTS = [value.strip().lower() for value in os.environ.get('FITTRACK_ALLOWED_HOSTS', '').split(',') if value.strip()]
if not ALLOWED_HOSTS or any(
    not re.fullmatch(r'[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?', host)
    for host in ALLOWED_HOSTS
):
    raise ImproperlyConfigured('Configure explicit hostnames, without wildcards, URLs or ports.')

data_directory = os.environ.get('FITTRACK_DATA_DIR')
if not data_directory:
    raise ImproperlyConfigured('FITTRACK_DATA_DIR is required; choose an explicit persistent volume.')
data_dir = Path(data_directory)
if not data_dir.is_dir() or not os.access(data_dir, os.W_OK):
    raise ImproperlyConfigured('FITTRACK_DATA_DIR must be an existing writable data volume.')
DATABASES = {'default': sqlite_database(data_dir / 'fittrack.sqlite3')}  # noqa: F405

SECURE_SSL_REDIRECT = True
# Deployment must strip untrusted forwarding headers at its sole proxy and
# keep this service off published host ports; this is not an authentication check.
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = False
SECURE_HSTS_PRELOAD = False
