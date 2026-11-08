from django.conf import settings
from django.db import models


class SyncInvitation(models.Model):
    digest = models.CharField(max_length=64, primary_key=True)
    generation = models.UUIDField()
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True)


class AuthRateBucket(models.Model):
    key = models.CharField(max_length=64, primary_key=True)
    window_started = models.DateTimeField()
    attempts = models.PositiveIntegerField(default=0)


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
    # No snapshot copy: idempotent replies need only the digest and revision,
    # and a copy per publication filled the disk and kept deleted data forever.
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['owner', 'generation', 'operation_id'],
                name='unique_owner_generation_operation',
            ),
        ]
