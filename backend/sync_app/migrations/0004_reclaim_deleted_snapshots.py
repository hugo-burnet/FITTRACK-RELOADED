from django.db import migrations


def vacuum(apps, schema_editor):
    # Dropped rows otherwise survive in SQLite free pages, and in every export.
    if schema_editor.connection.vendor == 'sqlite':
        schema_editor.execute('VACUUM')


class Migration(migrations.Migration):
    atomic = False  # VACUUM cannot run inside a transaction.

    dependencies = [
        ('sync_app', '0003_remove_syncoperation_snapshot'),
    ]

    operations = [
        migrations.RunPython(vacuum, migrations.RunPython.noop),
    ]
