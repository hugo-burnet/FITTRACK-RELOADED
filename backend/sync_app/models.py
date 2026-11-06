from django.conf import settings
from django.db import models


class SyncHead(models.Model):
    owner = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    revision = models.PositiveBigIntegerField(default=0)
    snapshot = models.JSONField(null=True)


class SyncOperation(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    generation = models.UUIDField()
    operation_id = models.UUIDField()
    request_digest = models.CharField(max_length=64)
    revision = models.PositiveBigIntegerField()
    snapshot = models.JSONField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['owner', 'generation', 'operation_id'],
                name='unique_owner_generation_operation',
            ),
        ]
