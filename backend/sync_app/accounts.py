"""Django account creation bound to one-use, generation-scoped invitations."""

import hashlib
import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import SyncInvitation


class RegistrationRefused(Exception):
    pass


def normalize_username(value):
    value = value.strip().lower()
    if not re.fullmatch(r'[a-z0-9][a-z0-9_.-]{2,31}', value):
        raise ValueError('Invalid username.')
    return value


def invitation_digest(code):
    return hashlib.sha256(code.encode('utf-8')).hexdigest()


def create_invitation(hours=24):
    if type(hours) is not int or not 1 <= hours <= 168:
        raise ValueError('Invitation lifetime must be between 1 and 168 hours.')
    code = 'ft_inv_' + secrets.token_urlsafe(32)
    SyncInvitation.objects.create(
        digest=invitation_digest(code), generation=settings.SYNC_GENERATION,
        expires_at=timezone.now() + timedelta(hours=hours),
    )
    return code


def _available_invitation(code):
    return SyncInvitation.objects.filter(
        digest=invitation_digest(code), generation=settings.SYNC_GENERATION,
        used_at__isnull=True, expires_at__gt=timezone.now(),
    )


def register_account(username, password, code):
    username = normalize_username(username)
    if not _available_invitation(code).exists():
        raise RegistrationRefused
    user = get_user_model()(username=username)
    if len(password) > 1024:
        raise ValidationError('Password too long.', code='password_too_long')
    validate_password(password, user=user)
    # Do the expensive password hash outside SQLite's global write lock.
    user.set_password(password)
    try:
        with transaction.atomic():
            # BEGIN IMMEDIATE serializes consumption, including concurrent
            # requests that both passed the inexpensive preflight above.
            invitation = _available_invitation(code).first()
            if invitation is None or get_user_model().objects.filter(username__iexact=username).exists():
                raise RegistrationRefused
            user.save(force_insert=True)
            invitation.used_at = timezone.now()
            invitation.save(update_fields=['used_at'])
    except IntegrityError:
        raise RegistrationRefused from None
    return user
