from django.db import migrations


class Migration(migrations.Migration):
    """Drops every historical snapshot copy; the head keeps the current one.

    The deployment exports the database before migrating, so the dropped
    history remains recoverable from that private backup only.
    """

    dependencies = [
        ('sync_app', '0002_authratebucket_syncinvitation'),
    ]

    operations = [
        migrations.RemoveField(model_name='syncoperation', name='snapshot'),
    ]
