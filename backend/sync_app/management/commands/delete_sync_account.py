import sqlite3

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction


class Command(BaseCommand):
    help = (
        "Erase one sync account with its server snapshot, operations and sessions. "
        "Private exports made earlier still contain it; delete them separately."
    )

    def add_arguments(self, parser):
        parser.add_argument('username')

    def handle(self, *args, **options):
        from django.contrib.sessions.models import Session
        with transaction.atomic():
            user = get_user_model().objects.filter(username=options['username']).first()
            if user is None or user.is_staff or user.is_superuser:
                raise CommandError('No such regular sync account.')
            # Sessions reference the user only inside their encoded data.
            for session in Session.objects.iterator():
                if session.get_decoded().get('_auth_user_id') == str(user.pk):
                    session.delete()
            user.delete()  # CASCADE: SyncHead and SyncOperation rows.
        # Outside any transaction (always, from manage.py) so freed pages are dropped.
        if connection.vendor == 'sqlite' and not connection.in_atomic_block:
            try:
                with connection.cursor() as cursor:
                    cursor.execute('VACUUM')
            except sqlite3.Error as error:
                raise CommandError(f'Account erased; VACUUM failed ({type(error).__name__}).') from error
        if options['verbosity']:
            self.stdout.write('Account erased from the live database.')
