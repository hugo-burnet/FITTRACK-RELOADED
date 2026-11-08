import secrets

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction


class Command(BaseCommand):
    help = (
        "Administrator-assisted recovery: replace a sync account's password with a "
        "random one, printed once, and revoke its sessions. Give it to the person privately."
    )

    def add_arguments(self, parser):
        parser.add_argument('username')

    def handle(self, *args, **options):
        from django.contrib.sessions.models import Session
        with transaction.atomic():
            user = get_user_model().objects.filter(username=options['username']).first()
            if user is None or user.is_staff or user.is_superuser:
                raise CommandError('No such regular sync account.')
            password = secrets.token_urlsafe(18)
            validate_password(password, user=user)
            user.set_password(password)
            user.save(update_fields=['password'])
            # Sessions reference the user only inside their encoded data.
            for session in Session.objects.iterator():
                if session.get_decoded().get('_auth_user_id') == str(user.pk):
                    session.delete()
        self.stdout.write('Temporary password (shown once, never stored in clear):')
        self.stdout.write(password)
