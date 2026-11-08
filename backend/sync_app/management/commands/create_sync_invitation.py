from django.core.management.base import BaseCommand, CommandError

from sync_app.accounts import create_invitation


class Command(BaseCommand):
    help = 'Privately issue one invitation code; only its digest is stored. Do not publish the output.'

    def add_arguments(self, parser):
        parser.add_argument('--hours', type=int, default=24)

    def handle(self, *args, **options):
        try:
            code = create_invitation(options['hours'])
        except ValueError as error:
            raise CommandError(str(error)) from error
        self.stdout.write(code)
