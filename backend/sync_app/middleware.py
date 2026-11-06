from django.conf import settings
from django.contrib.auth import logout


class SessionGenerationMiddleware:
    """A restored database must not revive previously revoked sessions."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated and request.session.get('fittrack_generation') != settings.SYNC_GENERATION:
            logout(request)
        return self.get_response(request)
