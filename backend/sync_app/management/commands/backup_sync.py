import sqlite3

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from sync_app.backups import create_backup


class Command(BaseCommand):
    help = 'Export the configured SQLite database into a new private backup directory.'

    def add_arguments(self, parser):
        parser.add_argument('destination')

    def handle(self, *args, **options):
        database = settings.DATABASES['default']
        if database['ENGINE'] != 'django.db.backends.sqlite3' or database['NAME'] == ':memory:':
            raise CommandError('This command requires a persistent SQLite database.')
        try:
            create_backup(database['NAME'], options['destination'], settings.SYNC_GENERATION)
        except (OSError, ValueError, sqlite3.Error) as error:
            raise CommandError(f'Backup failed ({type(error).__name__}); no completed export produced.') from error
        if options['verbosity']:
            self.stdout.write('SQLite backup completed; copy it to encrypted storage outside this machine.')
