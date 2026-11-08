from contextlib import contextmanager

from django.conf import settings
from django.db import OperationalError
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_POST

from .auth_limits import consume_publication
from .service import SyncConflict, publish_for, state_for
from .validation import parse_publication


@contextmanager
def heavy_json():
    """One multi-megabyte decode/encode at a time across this container's workers.

    Two concurrent 16 MiB publications (or a publication and a state read)
    would otherwise exceed the container memory limit together. Waiting is
    bounded by the worker timeout; nothing is lost, the client retries.
    """
    path = settings.SYNC_HEAVY_LOCK_FILE
    try:
        import fcntl
    except ImportError:  # Windows development only; deployment is Linux.
        fcntl = None
    if not path or fcntl is None:
        yield
        return
    with open(path, 'a+b') as handle:
        fcntl.flock(handle, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(handle, fcntl.LOCK_UN)


def _containers(raw):
    # Brackets inside strings are counted too: conservative, never permissive.
    return raw.count(b'[') + raw.count(b'{')


@require_GET
@never_cache
def state(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'authentication_required'}, status=401)
    with heavy_json():
        return JsonResponse(state_for(request.user))


@require_POST
@never_cache
def publish(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'authentication_required'}, status=401)
    if request.content_type != 'application/json':
        return JsonResponse({'error': 'json_required'}, status=415)
    try:
        retry = consume_publication(request.user)
    except OperationalError:
        return JsonResponse({'error': 'storage_unavailable'}, status=503)
    if retry:
        response = JsonResponse({'error': 'too_many_requests'}, status=429)
        response['Retry-After'] = str(retry)
        return response
    raw = request.read(settings.MAX_SYNC_BYTES + 1)
    if len(raw) > settings.MAX_SYNC_BYTES:
        return JsonResponse({'error': 'request_too_large'}, status=413)
    if _containers(raw) > settings.MAX_SYNC_CONTAINERS:
        return JsonResponse({'error': 'invalid_publication'}, status=400)
    with heavy_json():
        try:
            publication = parse_publication(raw)
        except (ValueError, TypeError, AttributeError, UnicodeError, RecursionError):
            return JsonResponse({'error': 'invalid_publication'}, status=400)
        try:
            return JsonResponse(publish_for(request.user, *publication))
        except SyncConflict as error:
            return JsonResponse({
                'error': error.code,
                'current': {'generation': settings.SYNC_GENERATION, 'revision': error.revision},
            }, status=409)
        except OperationalError:
            # Preserve the client operation for retry rather than silently dropping
            # it if SQLite is busy or the storage becomes unavailable.
            return JsonResponse({'error': 'storage_unavailable'}, status=503)
