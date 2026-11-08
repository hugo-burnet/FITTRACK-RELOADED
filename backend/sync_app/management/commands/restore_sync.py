import sqlite3

from django.core.management.base import BaseCommand, CommandError

from sync_app.restores import restore_backup


class Command(BaseCommand):
    help = 'Restore a trusted export into a NEW offline instance; never activates it.'

    def add_arguments(self, parser):
        parser.add_argument('source')
        parser.add_argument('destination')

    def handle(self, *args, **options):
        try:
            restore_backup(options['source'], options['destination'])
        except (OSError, ValueError, TypeError, KeyError, sqlite3.Error) as error:
            raise CommandError(f'Restore refused ({type(error).__name__}); no instance activated.') from error
        if options['verbosity']:
            self.stdout.write('New offline instance created with fresh generation and secret; sessions revoked. No service activated.')
