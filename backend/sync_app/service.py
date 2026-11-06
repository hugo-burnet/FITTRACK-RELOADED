from django.conf import settings
from django.db import transaction

from .models import SyncHead, SyncOperation


class SyncConflict(Exception):
    def __init__(self, code, revision):
        self.code = code
        self.revision = revision


def state_for(owner):
    head = SyncHead.objects.filter(owner=owner).first()
    return {
        'generation': settings.SYNC_GENERATION,
        'revision': head.revision if head else 0,
        'snapshot': head.snapshot if head else None,
    }


def publish_for(owner, operation, generation, base_revision, backup, digest):
    # SQLite's configured BEGIN IMMEDIATE serializes the whole decision.
    # select_for_update alone is a no-op on SQLite and would permit races.
    with transaction.atomic():
        head = SyncHead.objects.filter(owner=owner).first()
        revision = head.revision if head else 0
        if generation != settings.SYNC_GENERATION:
            raise SyncConflict('generation_conflict', revision)
        previous = SyncOperation.objects.filter(
            owner=owner, generation=generation, operation_id=operation,
        ).first()
        if previous:
            if previous.request_digest != digest:
                raise SyncConflict('operation_conflict', revision)
            return {
                'generation': generation,
                'revision': previous.revision,
                'operationId': operation,
            }
        if base_revision != revision:
            raise SyncConflict('revision_conflict', revision)
        next_revision = revision + 1
        if head is None:
            SyncHead.objects.create(owner=owner, revision=next_revision, snapshot=backup)
        else:
            head.revision = next_revision
            head.snapshot = backup
            head.save(update_fields=['revision', 'snapshot'])
        SyncOperation.objects.create(
            owner=owner, generation=generation, operation_id=operation,
            request_digest=digest, revision=next_revision, snapshot=backup,
        )
        return {'generation': generation, 'revision': next_revision, 'operationId': operation}
