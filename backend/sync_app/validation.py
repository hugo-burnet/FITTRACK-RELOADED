"""Envelope validation only; clients still validate/migrate every domain row."""

import hashlib
import json
import uuid


TABLES = frozenset({
    'exercises', 'externalExerciseBindings', 'routineFolders', 'routines',
    'routineExercises', 'routineSets', 'workouts', 'workoutExercises',
    'workoutSets', 'personalRecords', 'milestones', 'coachRecommendations',
    'bodyMeasurements', 'progressPhotos', 'programs', 'programWeeks',
    'programScheduleRevisions', 'programScheduleEntries', 'settings',
})
MAX_SAFE_INTEGER = 2**53 - 1


def _keys(value, expected):
    if type(value) is not dict or set(value) != set(expected):
        raise ValueError('Invalid object fields.')


def _integer(value):
    if type(value) is not int or not 0 <= value <= MAX_SAFE_INTEGER:
        raise ValueError('Invalid integer.')


def _unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError('Duplicate JSON key.')
        result[key] = value
    return result


def parse_publication(raw):
    data = json.loads(raw, object_pairs_hook=_unique_object)
    _keys(data, {'operationId', 'base', 'snapshot'})
    operation = str(uuid.UUID(data['operationId']))
    _keys(data['base'], {'generation', 'revision'})
    generation = str(uuid.UUID(data['base']['generation']))
    revision = data['base']['revision']
    _integer(revision)
    backup = data['snapshot']
    _keys(backup, {'format', 'version', 'exportedAt', 'app', 'preferences', 'tables'})
    if backup['format'] != 'fittrack-backup' or type(backup['version']) is not int or backup['version'] != 1:
        raise ValueError('Unsupported backup format.')
    _integer(backup['exportedAt'])
    _keys(backup['app'], {'name', 'schemaVersion'})
    if backup['app']['name'] != 'FitTrack' or type(backup['app']['schemaVersion']) is not int or backup['app']['schemaVersion'] != 13:
        raise ValueError('Unsupported backup schema.')
    preferences = backup['preferences']
    if type(preferences) is not dict or any(
        not key.startswith('fittrack:') or type(value) is not str
        for key, value in preferences.items()
    ):
        raise ValueError('Invalid preferences.')
    _keys(backup['tables'], TABLES)
    for rows in backup['tables'].values():
        if type(rows) is not list or any(type(row) is not dict for row in rows):
            raise ValueError('Invalid table rows.')
    # Canonical request hashing makes retries independent of JSON key order.
    # allow_nan=False also rejects non-finite values nested inside domain rows.
    canonical = json.dumps(data, sort_keys=True, separators=(',', ':'), ensure_ascii=False, allow_nan=False)
    digest = hashlib.sha256(canonical.encode('utf-8')).hexdigest()
    return operation, generation, revision, backup, digest
