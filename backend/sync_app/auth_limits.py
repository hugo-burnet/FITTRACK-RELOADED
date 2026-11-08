"""Atomic auth budgets that an anonymous client cannot turn into a lockout.

Budgets are per client address: one client's failures never lock the same
account for anyone else, and registration attempts never spend the login
budget. Only a deployment-declared header, rewritten by the sole proxy, may
name the client; otherwise REMOTE_ADDR is used. Keys are HMACs, never raw
addresses or usernames.
"""

import hashlib
import hmac
import ipaddress
import math
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import AuthRateBucket


def _key(scope):
    value = f'{settings.SYNC_GENERATION}:{scope}'.encode()
    return hmac.new(settings.SECRET_KEY.encode(), value, hashlib.sha256).hexdigest()


def client_address(request):
    header = getattr(settings, 'AUTH_CLIENT_ADDRESS_HEADER', None)
    value = request.META.get(header if header else 'REMOTE_ADDR', '')
    try:
        # One proxy-written address; a list or garbage shares one strict bucket.
        return str(ipaddress.ip_address(value.strip()))
    except ValueError:
        return 'unidentified'


def _bucket(key, now, window):
    bucket, _ = AuthRateBucket.objects.get_or_create(key=key, defaults={'window_started': now})
    if now >= bucket.window_started + window:
        bucket.window_started, bucket.attempts = now, 0
        bucket.save(update_fields=['window_started', 'attempts'])
    return bucket


def _retry(bucket, now, window):
    return max(1, math.ceil((bucket.window_started + window - now).total_seconds()))


def consume_auth_attempt(action, username, client):
    """Charge this client's attempt budget; refuse while its failures on this account are spent.

    Returns 0 when allowed, else the Retry-After seconds.
    """
    now = timezone.now()
    window = timedelta(seconds=settings.AUTH_ATTEMPT_WINDOW_SECONDS)
    with transaction.atomic():
        # Expired windows carry no information: without a purge, every client
        # address ever seen would leave rows behind forever.
        AuthRateBucket.objects.filter(window_started__lt=now - window).delete()
        attempts = _bucket(_key(f'{action}:client:{client}'), now, window)
        if attempts.attempts >= settings.AUTH_GLOBAL_ATTEMPTS:
            return _retry(attempts, now, window)
        if username is not None:
            failures = _bucket(_key(f'{action}:failures:{username}:{client}'), now, window)
            if failures.attempts >= settings.AUTH_ACCOUNT_ATTEMPTS:
                return _retry(failures, now, window)
        attempts.attempts += 1
        attempts.save(update_fields=['attempts'])
    return 0


def record_auth_failure(action, username, client):
    now = timezone.now()
    window = timedelta(seconds=settings.AUTH_ATTEMPT_WINDOW_SECONDS)
    with transaction.atomic():
        failures = _bucket(_key(f'{action}:failures:{username}:{client}'), now, window)
        failures.attempts += 1
        failures.save(update_fields=['attempts'])


def consume_publication(owner):
    """Per-account publication budget; returns 0 when allowed, else Retry-After seconds."""
    now = timezone.now()
    window = timedelta(seconds=settings.AUTH_ATTEMPT_WINDOW_SECONDS)
    with transaction.atomic():
        bucket = _bucket(_key(f'publish:{owner.pk}'), now, window)
        if bucket.attempts >= settings.SYNC_PUBLISH_ATTEMPTS:
            return _retry(bucket, now, window)
        bucket.attempts += 1
        bucket.save(update_fields=['attempts'])
    return 0
