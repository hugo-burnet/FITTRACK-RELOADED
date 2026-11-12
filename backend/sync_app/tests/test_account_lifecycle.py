import json
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.test import Client, TestCase, override_settings
from sync_app.models import SyncHead, SyncOperation
from sync_app.tests.test_auth import PASSWORD, csrf_client, post
from sync_app.tests.test_protocol import authenticated_client, message


class AccountLifecycleTests(TestCase):
    def setUp(self):
        self.alice = get_user_model().objects.create_user('alice', password=PASSWORD)
        self.bob = get_user_model().objects.create_user('bob', password=PASSWORD)
        self.client, token = csrf_client()
        response = post(self.client, 'login', token, {'username': 'alice', 'password': PASSWORD})
        self.csrf = response.json()['csrfToken']
        self.other_session = authenticated_client(self.alice)
        self.other_account = authenticated_client(self.bob)
        for client, label in ((self.client, 'alice'), (self.other_account, 'bob')):
            self.assertEqual(client.post('/api/sync/publish', message(label), content_type='application/json',
                secure=True, HTTP_X_CSRFTOKEN=self.csrf, HTTP_ORIGIN='https://testserver').status_code, 200)

    def delete(self, **changes):
        return self.client.post('/api/account/delete', {'password': PASSWORD, 'confirmation': 'alice'} | changes,
            content_type='application/json', secure=True, HTTP_X_CSRFTOKEN=self.csrf,
            HTTP_ORIGIN='https://testserver')

    def test_personal_export_is_session_scoped_and_contains_no_credentials(self):
        response = self.client.get('/api/account/export?userId=' + str(self.bob.pk), secure=True)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['format'], 'fittrack-personal-export')
        self.assertEqual(data['version'], 1)
        self.assertEqual(data['account'], {'id': str(self.alice.pk), 'username': 'alice'})
        self.assertEqual(data['state']['snapshot']['tables']['settings'][0]['value'], 'alice')
        self.assertEqual(set(data), {'format', 'version', 'exportedAt', 'account', 'state'})
        for secret in (self.alice.password, settings.SECRET_KEY, self.client.session.session_key):
            self.assertNotIn(secret, response.content.decode())
        self.assertIn('attachment;', response.headers['Content-Disposition'])
        self.assertIn('no-store', response.headers['Cache-Control'])

    def test_export_requires_authentication_and_is_bounded(self):
        self.assertEqual(Client().get('/api/account/export', secure=True).status_code, 401)
        with override_settings(MAX_PERSONAL_EXPORT_BYTES=20):
            self.assertEqual(self.client.get('/api/account/export', secure=True).status_code, 413)

    def test_delete_requires_confirmation_reauthentication_and_csrf(self):
        self.assertEqual(self.delete(confirmation='bob').status_code, 400)
        self.assertEqual(self.delete(password='incorrect-password').status_code, 401)
        self.assertEqual(self.delete(userId=str(self.bob.pk)).status_code, 400)
        self.assertEqual(self.client.post('/api/account/delete', json.dumps({'password': PASSWORD, 'confirmation': 'alice'}),
            content_type='application/json', secure=True).status_code, 403)
        self.assertTrue(get_user_model().objects.filter(pk=self.alice.pk).exists())

    def test_delete_revokes_both_sessions_and_preserves_other_account(self):
        bob_before = self.other_account.get('/api/sync/state', secure=True).json()
        self.assertEqual(self.delete().status_code, 200)
        self.assertFalse(get_user_model().objects.filter(pk=self.alice.pk).exists())
        self.assertFalse(SyncHead.objects.filter(owner_id=self.alice.pk).exists())
        self.assertFalse(SyncOperation.objects.filter(owner_id=self.alice.pk).exists())
        self.assertFalse(any(s.get_decoded().get('_auth_user_id') == str(self.alice.pk) for s in Session.objects.all()))
        for client in (self.client, self.other_session):
            self.assertEqual(client.get('/api/sync/state', secure=True).status_code, 401)
        self.assertEqual(self.other_account.get('/api/sync/state', secure=True).json(), bob_before)

    @override_settings(AUTH_ACCOUNT_ATTEMPTS=2)
    def test_delete_attempt_budget_is_distinct_and_limited(self):
        self.assertEqual(self.delete(password='bad').status_code, 401)
        self.assertEqual(self.delete(password='bad').status_code, 401)
        response = self.delete()
        self.assertEqual(response.status_code, 429)
        self.assertIn('Retry-After', response.headers)
        self.assertTrue(get_user_model().objects.filter(pk=self.alice.pk).exists())

    @override_settings(ACCOUNT_REVIEW_REQUIRED=True)
    def test_old_restore_cannot_reactivate_accounts_before_operator_review(self):
        client, token = csrf_client()
        response = post(client, 'login', token, {'username': 'alice', 'password': PASSWORD})
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()['error'], 'account_review_required')
