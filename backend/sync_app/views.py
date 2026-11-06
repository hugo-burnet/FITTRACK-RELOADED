from django.conf import settings
from django.db import OperationalError
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_POST

from .service import SyncConflict, publish_for, state_for
from .validation import parse_publication


@require_GET
@never_cache
def state(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'authentication_required'}, status=401)
    return JsonResponse(state_for(request.user))


@require_POST
@never_cache
def publish(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'authentication_required'}, status=401)
    if request.content_type != 'application/json':
        return JsonResponse({'error': 'json_required'}, status=415)
    raw = request.read(settings.MAX_SYNC_BYTES + 1)
    if len(raw) > settings.MAX_SYNC_BYTES:
        return JsonResponse({'error': 'request_too_large'}, status=413)
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
