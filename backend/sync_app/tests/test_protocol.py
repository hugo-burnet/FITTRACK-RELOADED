import copy
import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings


TABLES = [
    'exercises', 'externalExerciseBindings', 'routineFolders', 'routines',
    'routineExercises', 'routineSets', 'workouts', 'workoutExercises',
    'workoutSets', 'personalRecords', 'milestones', 'coachRecommendations',
    'bodyMeasurements', 'progressPhotos', 'programs', 'programWeeks',
    'programScheduleRevisions', 'programScheduleEntries', 'settings',
]


def snapshot(label='phone'):
    return {
        'format': 'fittrack-backup', 'version': 1, 'exportedAt': 1793980800000,
        'app': {'name': 'FitTrack', 'schemaVersion': 13},
        'preferences': {'fittrack:theme': 'dark'},
        'tables': {name: [] for name in TABLES},
    } | {'tables': {name: ([{'key': 'source', 'value': label}] if name == 'settings' else []) for name in TABLES}}


def message(label='phone', revision=0, operation=None):
    return {
        'operationId': str(operation or uuid.uuid4()),
        'base': {'generation': settings.SYNC_GENERATION, 'revision': revision},
        'snapshot': snapshot(label),
    }


def authenticated_client(user, enforce_csrf=False):
    client = Client(enforce_csrf_checks=enforce_csrf)
    client.force_login(user)
    session = client.session
    session['fittrack_generation'] = settings.SYNC_GENERATION
    session.save()
    return client


class ProtocolTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.alice = get_user_model().objects.create_user('alice', password='test-password')
        cls.bob = get_user_model().objects.create_user('bob', password='test-password')

    def setUp(self):
        self.client = authenticated_client(self.alice)

    def post(self, payload, client=None):
        return (client or self.client).post('/api/sync/publish', payload, content_type='application/json')

    def state(self, client=None):
        return (client or self.client).get('/api/sync/state').json()

    def test_state_requires_authentication(self):
        self.assertEqual(Client().get('/api/sync/state').status_code, 401)

    def test_empty_account_state(self):
        response = self.client.get('/api/sync/state')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            'generation': settings.SYNC_GENERATION, 'revision': 0, 'snapshot': None,
        })
        self.assertIn('no-store', response.headers['Cache-Control'])

    def test_published_state_is_returned_to_its_owner(self):
        payload = message()
        result = self.post(payload)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()['revision'], 1)
        self.assertEqual(self.state()['snapshot'], payload['snapshot'])

    def test_other_account_does_not_see_a_snapshot(self):
        self.assertEqual(self.post(message()).status_code, 200)
        other = authenticated_client(self.bob)
        self.assertEqual(self.state(other)['revision'], 0)
        self.assertIsNone(self.state(other)['snapshot'])

    def test_supplied_query_owner_cannot_select_another_account(self):
        self.assertEqual(self.post(message('alice')).status_code, 200)
        other = authenticated_client(self.bob)
        self.assertEqual(self.post(message('bob'), other).status_code, 200)
        response = self.client.get('/api/sync/state', {'userId': self.bob.pk})
        self.assertEqual(response.json()['snapshot'], snapshot('alice'))

    def test_supplied_body_owner_is_rejected(self):
        payload = message()
        payload['userId'] = self.bob.pk
        self.assertEqual(self.post(payload).status_code, 400)
        self.assertEqual(self.state()['revision'], 0)

    def test_same_operation_id_is_independent_between_accounts(self):
        operation = uuid.uuid4()
        self.assertEqual(self.post(message('alice', operation=operation)).status_code, 200)
        other = authenticated_client(self.bob)
        self.assertEqual(self.post(message('bob', operation=operation), other).status_code, 200)
        self.assertEqual(self.state()['snapshot'], snapshot('alice'))
        self.assertEqual(self.state(other)['snapshot'], snapshot('bob'))

    def test_stale_revision_cannot_overwrite_newer_state(self):
        self.assertEqual(self.post(message('first')).status_code, 200)
        response = self.post(message('stale'))
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.state()['snapshot'], snapshot('first'))

    def test_exact_retry_does_not_create_a_new_revision(self):
        payload = message()
        first = self.post(payload)
        retry = self.post(payload)
        self.assertEqual(first.status_code, 200)
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(first.json(), retry.json())
        self.assertEqual(self.state()['revision'], 1)

    def test_operation_id_reuse_with_different_content_is_a_conflict(self):
        payload = message('first')
        self.assertEqual(self.post(payload).status_code, 200)
        changed = copy.deepcopy(payload)
        changed['snapshot'] = snapshot('different')
        self.assertEqual(self.post(changed).status_code, 409)
        self.assertEqual(self.state()['snapshot'], snapshot('first'))

    def test_wrong_generation_is_not_accepted(self):
        payload = message()
        payload['base']['generation'] = str(uuid.uuid4())
        self.assertEqual(self.post(payload).status_code, 409)
        self.assertEqual(self.state()['revision'], 0)

    def test_restoration_generation_invalidates_existing_session(self):
        with override_settings(SYNC_GENERATION=str(uuid.uuid4())):
            self.assertEqual(self.client.get('/api/sync/state').status_code, 401)

    def test_publish_requires_csrf_on_browser_sessions(self):
        protected = authenticated_client(self.alice, enforce_csrf=True)
        self.assertEqual(self.post(message(), protected).status_code, 403)
        self.assertEqual(self.state()['revision'], 0)

    def test_invalid_json_does_not_change_state(self):
        result = self.client.post('/api/sync/publish', '{', content_type='application/json')
        self.assertEqual(result.status_code, 400)
        self.assertEqual(self.state()['revision'], 0)

    def test_non_finite_json_is_rejected(self):
        payload = message()
        payload['snapshot']['exportedAt'] = float('nan')
        self.assertEqual(self.post(payload).status_code, 400)

    def test_boolean_revision_is_not_an_integer_revision(self):
        payload = message()
        payload['base']['revision'] = False
        self.assertEqual(self.post(payload).status_code, 400)

    def test_unknown_backup_schema_is_rejected(self):
        payload = message()
        payload['snapshot']['app']['schemaVersion'] = 14
        self.assertEqual(self.post(payload).status_code, 400)

    def test_missing_table_and_non_record_rows_are_rejected(self):
        for mutate in (
            lambda data: data['tables'].pop('workoutSets'),
            lambda data: data['tables'].update({'workoutSets': ['invalid']}),
        ):
            payload = message()
            mutate(payload['snapshot'])
            self.assertEqual(self.post(payload).status_code, 400)
        self.assertEqual(self.state()['revision'], 0)

    def test_foreign_preference_namespace_is_rejected(self):
        payload = message()
        payload['snapshot']['preferences']['unrelated-secret'] = 'value'
        self.assertEqual(self.post(payload).status_code, 400)

    @override_settings(MAX_SYNC_BYTES=32)
    def test_size_limit_is_enforced_before_deserializing(self):
        self.assertEqual(self.post(message()).status_code, 413)

    def test_read_route_cannot_be_used_to_write(self):
        self.assertEqual(self.client.post('/api/sync/state').status_code, 405)

    def test_publish_route_cannot_be_called_with_get(self):
        self.assertEqual(self.client.get('/api/sync/publish').status_code, 405)
