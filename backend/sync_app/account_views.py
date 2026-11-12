"""Self-service account data: the session alone chooses the owner."""
from datetime import datetime, timezone

from django.conf import settings
from django.contrib.auth import get_user_model, logout
from django.contrib.sessions.models import Session
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_POST

from .auth_limits import client_address, record_auth_failure
from .auth_views import _body, _budget, _response, _safe
from .service import state_for
from .views import heavy_json


@require_GET
@never_cache
@_safe
def export(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'authentication_required'}, status=401)
    with heavy_json():
        response = JsonResponse({
            'format': 'fittrack-personal-export', 'version': 1,
            'exportedAt': datetime.now(timezone.utc).isoformat(),
            'account': {'id': str(request.user.pk), 'username': request.user.get_username()},
            'state': state_for(request.user),
        })
        if len(response.content) > settings.MAX_PERSONAL_EXPORT_BYTES:
            return JsonResponse({'error': 'export_too_large'}, status=413)
    response['Content-Disposition'] = 'attachment; filename="fittrack-server-account.json"'
    return response


@require_POST
@never_cache
@_safe
def delete(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'authentication_required'}, status=401)
    data = _body(request, {'password', 'confirmation'})
    user = request.user
    if data['confirmation'] != user.get_username():
        return JsonResponse({'error': 'confirmation_required'}, status=400)
    limited = _budget('delete', user.get_username(), request)
    if limited is not None:
        return limited
    password_hash = user.password
    if not user.check_password(data['password']) or user.is_staff or user.is_superuser:
        record_auth_failure('delete', user.get_username(), client_address(request))
        return JsonResponse({'error': 'invalid_credentials'}, status=401)
    with transaction.atomic():
        # Password verification is expensive; keep it outside the write lock,
        # but reject a concurrent password reset before doing any deletion.
        current = get_user_model().objects.filter(pk=user.pk, password=password_hash,
                                                 is_staff=False, is_superuser=False).first()
        if current is None:
            return JsonResponse({'error': 'authentication_required'}, status=401)
        for session in Session.objects.iterator():
            if session.get_decoded().get('_auth_user_id') == str(current.pk):
                session.delete()
        current.delete()
    logout(request)
    return _response(request)
