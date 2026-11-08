"""Atomic initial auth budgets; never trust an arbitrary forwarded client IP."""

import hashlib
import hmac
import math
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import AuthRateBucket


def _key(scope):
    value = f'{settings.SYNC_GENERATION}:{scope}'.encode()
    return hmac.new(settings.SECRET_KEY.encode(), value, hashlib.sha256).hexdigest()


def consume_auth_attempt(action, username):
    now = timezone.now()
    window = timedelta(seconds=settings.AUTH_ATTEMPT_WINDOW_SECONDS)
    limits = [(_key('global'), settings.AUTH_GLOBAL_ATTEMPTS),
              (_key(f'{action}:{username}'), settings.AUTH_ACCOUNT_ATTEMPTS)]
    with transaction.atomic():
        buckets = []
        for key, maximum in limits:
            bucket, _ = AuthRateBucket.objects.get_or_create(key=key, defaults={'window_started': now})
            if now >= bucket.window_started + window:
                bucket.window_started, bucket.attempts = now, 0
                bucket.save(update_fields=['window_started', 'attempts'])
            if bucket.attempts >= maximum:
                return max(1, math.ceil((bucket.window_started + window - now).total_seconds()))
            buckets.append(bucket)
        for bucket in buckets:
            bucket.attempts += 1
            bucket.save(update_fields=['attempts'])
    return 0
