"""Private account HTTP API. Signing in never publishes or imports a snapshot."""

import json
from functools import wraps

from django.conf import settings
from django.contrib.auth import authenticate, login as django_login, logout as django_logout
from django.core.exceptions import ValidationError
from django.db import OperationalError
from django.http import JsonResponse
from django.middleware.csrf import get_token, rotate_token
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_POST

from .accounts import RegistrationRefused, normalize_username, register_account
from .auth_limits import client_address, consume_auth_attempt, record_auth_failure


class InvalidBody(Exception):
    def __init__(self, code='invalid_request', status=400):
        self.code, self.status = code, status


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate JSON field.')
        result[key] = value
    return result


def _body(request, fields):
    if request.content_type != 'application/json':
        raise InvalidBody('json_required', 415)
    raw = request.read(settings.MAX_AUTH_BYTES + 1)
    if len(raw) > settings.MAX_AUTH_BYTES:
        raise InvalidBody('request_too_large', 413)
    try:
        data = json.loads(raw.decode('utf-8'), object_pairs_hook=_unique_object)
    except (ValueError, UnicodeError, RecursionError):
        raise InvalidBody from None
    if type(data) is not dict or set(data) != set(fields) or any(type(value) is not str for value in data.values()):
        raise InvalidBody
    try:
        for value in data.values():
            value.encode('utf-8')
    except UnicodeEncodeError:
        # JSON permits escaped lone surrogates; password and token hashing
        # require actual Unicode scalar strings, before charging a budget.
        raise InvalidBody from None
    if 'username' in data:
        try:
            data['username'] = normalize_username(data['username'])
        except ValueError:
            raise InvalidBody from None
    if 'password' in data and not 1 <= len(data['password']) <= 1024:
        raise InvalidBody
    if 'invitation' in data:
        data['invitation'] = data['invitation'].strip()
        if not 1 <= len(data['invitation']) <= 128:
            raise InvalidBody
    return data


def _response(request, status=200):
    user = request.user
    return JsonResponse({
        'authenticated': user.is_authenticated,
        'user': {'id': str(user.pk), 'username': user.get_username()} if user.is_authenticated else None,
        'csrfToken': get_token(request), 'generation': settings.SYNC_GENERATION,
    }, status=status)


def _safe(view):
    @wraps(view)
    def wrapped(request):
        try:
            return view(request)
        except InvalidBody as error:
            return JsonResponse({'error': error.code}, status=error.status)
        except OperationalError:
            return JsonResponse({'error': 'storage_unavailable'}, status=503)
    return wrapped


def _budget(action, username, request):
    retry = consume_auth_attempt(action, username, client_address(request))
    if retry:
        response = JsonResponse({'error': 'too_many_attempts'}, status=429)
        response['Retry-After'] = str(retry)
        return response
    return None


def _sign_in(request, user):
    django_login(request, user, backend='django.contrib.auth.backends.ModelBackend')
    request.session['fittrack_generation'] = settings.SYNC_GENERATION


@require_GET
@never_cache
@_safe
def session(request):
    return _response(request)


@require_POST
@never_cache
@_safe
def register(request):
    if settings.ACCOUNT_REVIEW_REQUIRED:
        return JsonResponse({'error': 'account_review_required'}, status=503)
    if request.user.is_authenticated:
        return JsonResponse({'error': 'logout_required'}, status=409)
    data = _body(request, {'username', 'password', 'invitation'})
    # Registration has its own budget: invented invitations never block logins.
    limited = _budget('register', None, request)
    if limited is not None:
        return limited
    try:
        user = register_account(data['username'], data['password'], data['invitation'])
    except RegistrationRefused:
        return JsonResponse({'error': 'registration_refused'}, status=400)
    except ValidationError as error:
        return JsonResponse({'error': 'password_invalid', 'codes': [entry.code for entry in error.error_list]}, status=400)
    _sign_in(request, user)
    return _response(request, status=201)


@require_POST
@never_cache
@_safe
def login(request):
    if settings.ACCOUNT_REVIEW_REQUIRED:
        return JsonResponse({'error': 'account_review_required'}, status=503)
    if request.user.is_authenticated:
        return JsonResponse({'error': 'logout_required'}, status=409)
    data = _body(request, {'username', 'password'})
    limited = _budget('login', data['username'], request)
    if limited is not None:
        return limited
    user = authenticate(request, username=data['username'], password=data['password'])
    if user is None or user.is_staff or user.is_superuser:
        # Only failures count against an account, and only for this client.
        record_auth_failure('login', data['username'], client_address(request))
        return JsonResponse({'error': 'invalid_credentials'}, status=401)
    _sign_in(request, user)
    return _response(request)


@require_POST
@never_cache
@_safe
def logout(request):
    _body(request, set())
    django_logout(request)
    rotate_token(request)
    return _response(request)
