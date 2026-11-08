import io
import copy
import json
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.core.management import CommandError, call_command
from django.db import close_old_connections
from django.test import Client, TestCase, TransactionTestCase, override_settings
from django.utils import timezone

from sync_app.models import SyncHead, SyncOperation
from sync_app.tests.test_protocol import message

PASSWORD = 'Distinct-Training-Passphrase-42!'


def csrf_client():
    client = Client(enforce_csrf_checks=True)
    response = client.get('/api/auth/session', secure=True)
    assert response.status_code == 200, response.status_code
    return client, response.json()['csrfToken']


def post(client, route, token, data):
    return client.post('/api/auth/' + route, data, content_type='application/json',
                       secure=True, HTTP_X_CSRFTOKEN=token, HTTP_ORIGIN='https://testserver')


class AuthTests(TestCase):
    def setUp(self):
        self.alice = get_user_model().objects.create_user('alice', password=PASSWORD)
        self.bob = get_user_model().objects.create_user('bob', password=PASSWORD)
        self.client, self.csrf = csrf_client()

    def invite(self, **kwargs):
        from sync_app.accounts import create_invitation
        return create_invitation(**kwargs)

    def register(self, username='charlie', password=PASSWORD, code=None):
        return post(self.client, 'register', self.csrf,
                    {'username': username, 'password': password, 'invitation': code or self.invite()})

    def login(self, username='alice', password=PASSWORD):
        return post(self.client, 'login', self.csrf, {'username': username, 'password': password})

    def test_anonymous_session_issues_csrf_without_creating_sync_state(self):
        result = self.client.get('/api/auth/session', secure=True)
        self.assertFalse(result.json()['authenticated'])
        self.assertIsNone(result.json()['user'])
        self.assertIn('no-store', result.headers['Cache-Control'])
        cookie = result.cookies[settings.CSRF_COOKIE_NAME]
        self.assertTrue(cookie['secure'])
        self.assertTrue(cookie['httponly'])
        self.assertEqual(cookie['samesite'], 'Strict')
        self.assertEqual(SyncHead.objects.count(), 0)

    def test_register_creates_normal_account_and_session_without_sync_data(self):
        result = self.register(username=' Charlie ')
        self.assertEqual(result.status_code, 201)
        user = get_user_model().objects.get(username='charlie')
        self.assertTrue(user.check_password(PASSWORD))
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertEqual(result.json()['user'], {'id': str(user.pk), 'username': 'charlie'})
        self.assertTrue(result.json()['authenticated'])
        self.assertNotIn('password', result.json())
        self.assertEqual(SyncHead.objects.count(), 0)
        self.assertEqual(SyncOperation.objects.count(), 0)
        self.assertEqual(self.client.session['fittrack_generation'], settings.SYNC_GENERATION)

    def test_used_invitation_cannot_register_another_account(self):
        code = self.invite()
        self.assertEqual(self.register(code=code).status_code, 201)
        other, token = csrf_client()
        result = post(other, 'register', token, {'username': 'david', 'password': PASSWORD, 'invitation': code})
        self.assertEqual(result.status_code, 400)
        self.assertFalse(get_user_model().objects.filter(username='david').exists())

    def test_expired_wrong_and_old_generation_invitations_are_refused(self):
        from sync_app.models import SyncInvitation
        code = self.invite()
        SyncInvitation.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.register(code=code).status_code, 400)
        self.assertEqual(self.register(code='unknown-code').status_code, 400)
        code = self.invite()
        with override_settings(SYNC_GENERATION=str(uuid.uuid4())):
            self.assertEqual(self.register(code=code).status_code, 400)
        self.assertFalse(get_user_model().objects.filter(username='charlie').exists())

    def test_invalid_password_does_not_consume_invitation(self):
        from sync_app.models import SyncInvitation
        code = self.invite()
        self.assertEqual(self.register(password='short', code=code).status_code, 400)
        self.assertIsNone(SyncInvitation.objects.get().used_at)
        self.assertEqual(self.register(code=code).status_code, 201)

    def test_existing_username_does_not_consume_invitation(self):
        from sync_app.models import SyncInvitation
        code = self.invite()
        self.assertEqual(self.register(username='ALICE', code=code).status_code, 400)
        self.assertIsNone(SyncInvitation.objects.get().used_at)
        self.assertEqual(self.register(code=code).status_code, 201)

    def test_login_rotates_csrf_and_allows_only_own_sync_state(self):
        old_cookie = self.client.cookies[settings.CSRF_COOKIE_NAME].value
        result = self.login()
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()['user']['id'], str(self.alice.pk))
        self.assertNotEqual(self.client.cookies[settings.CSRF_COOKIE_NAME].value, old_cookie)
        session_cookie = result.cookies[settings.SESSION_COOKIE_NAME]
        self.assertTrue(session_cookie['secure'])
        self.assertTrue(session_cookie['httponly'])
        self.assertEqual(session_cookie['samesite'], 'Strict')
        published = self.client.post('/api/sync/publish', message('alice'), content_type='application/json',
                                     secure=True, HTTP_X_CSRFTOKEN=result.json()['csrfToken'],
                                     HTTP_ORIGIN='https://testserver')
        self.assertEqual(published.status_code, 200)
        other, token = csrf_client()
        bob = post(other, 'login', token, {'username': 'bob', 'password': PASSWORD})
        self.assertEqual(bob.status_code, 200)
        self.assertIsNone(other.get('/api/sync/state', secure=True).json()['snapshot'])
        self.assertEqual(self.client.get('/api/sync/state', secure=True).json()['revision'], 1)

    def test_login_failure_is_identical_for_unknown_inactive_wrong_or_admin(self):
        self.bob.is_active = False
        self.bob.save(update_fields=['is_active'])
        admin = get_user_model().objects.create_user('admin', password=PASSWORD, is_staff=True)
        failures = [self.login('alice', 'incorrect'), self.login('missing'), self.login('bob'), self.login(admin.username)]
        self.assertTrue(all(response.status_code == 401 for response in failures))
        self.assertEqual([response.json() for response in failures], [{'error': 'invalid_credentials'}] * 4)

    def test_logout_revokes_session_and_preserves_snapshot(self):
        result = self.login()
        token = result.json()['csrfToken']
        stolen = Client(enforce_csrf_checks=True)
        stolen.cookies = copy.copy(self.client.cookies)
        self.assertEqual(self.client.post('/api/sync/publish', message(), content_type='application/json',
                                         secure=True, HTTP_X_CSRFTOKEN=token,
                                         HTTP_ORIGIN='https://testserver').status_code, 200)
        result = post(self.client, 'logout', token, {})
        self.assertEqual(result.status_code, 200)
        self.assertFalse(result.json()['authenticated'])
        self.assertEqual(self.client.get('/api/sync/state', secure=True).status_code, 401)
        self.assertEqual(stolen.get('/api/sync/state', secure=True).status_code, 401)
        self.assertEqual(SyncHead.objects.get(owner=self.alice).revision, 1)

    def test_login_replaces_a_preexisting_anonymous_session(self):
        anonymous = self.client.session
        anonymous['temporary'] = 'anonymous-only'
        anonymous.save()
        previous_key = anonymous.session_key
        result = self.login()
        self.assertEqual(result.status_code, 200)
        self.assertNotEqual(self.client.session.session_key, previous_key)
        self.assertFalse(Session.objects.filter(session_key=previous_key).exists())

    def test_old_csrf_token_is_not_accepted_after_login(self):
        self.assertEqual(self.login().status_code, 200)
        self.assertEqual(post(self.client, 'logout', self.csrf, {}).status_code, 403)

    def test_login_cannot_silently_switch_an_authenticated_session(self):
        result = self.login()
        response = post(self.client, 'login', result.json()['csrfToken'], {'username': 'bob', 'password': PASSWORD})
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.client.get('/api/auth/session', secure=True).json()['user']['id'], str(self.alice.pk))

    def test_all_mutations_require_csrf_and_reject_wrong_origin(self):
        for route, payload in (('login', {'username': 'alice', 'password': PASSWORD}),
                               ('register', {'username': 'charlie', 'password': PASSWORD, 'invitation': self.invite()}),
                               ('logout', {})):
            self.assertEqual(self.client.post('/api/auth/' + route, payload, content_type='application/json', secure=True).status_code, 403)
            response = self.client.post('/api/auth/' + route, payload, content_type='application/json', secure=True,
                                        HTTP_X_CSRFTOKEN=self.csrf, HTTP_ORIGIN='https://attacker.invalid')
            self.assertEqual(response.status_code, 403)

    def test_generation_change_invalidates_session(self):
        self.assertEqual(self.login().status_code, 200)
        with override_settings(SYNC_GENERATION=str(uuid.uuid4())):
            self.assertFalse(self.client.get('/api/auth/session', secure=True).json()['authenticated'])

    def test_promoting_account_to_admin_revokes_regular_sync_session(self):
        self.assertEqual(self.login().status_code, 200)
        self.alice.is_staff = True
        self.alice.save(update_fields=['is_staff'])
        self.assertEqual(self.client.get('/api/sync/state', secure=True).status_code, 401)

    def test_unpaired_unicode_surrogates_are_rejected_before_rate_or_hash_work(self):
        from sync_app.models import AuthRateBucket, SyncInvitation
        code = self.invite()
        for route, data in (
            ('register', {'username': 'charlie', 'password': PASSWORD + '\ud800', 'invitation': code}),
            ('register', {'username': 'charlie', 'password': PASSWORD, 'invitation': code + '\ud800'}),
            ('login', {'username': 'alice', 'password': PASSWORD + '\ud800'}),
            ('login', {'username': 'missing', 'password': PASSWORD + '\ud800'}),
        ):
            with self.subTest(route=route, username=data['username']):
                response = post(self.client, route, self.csrf, data)
                self.assertEqual(response.status_code, 400)
                self.assertEqual(response.json()['error'], 'invalid_request')
        self.assertEqual(AuthRateBucket.objects.count(), 0)
        self.assertIsNone(SyncInvitation.objects.get().used_at)

    def test_account_rate_limit_and_window_reset(self):
        from sync_app.models import AuthRateBucket
        for _ in range(5):
            self.assertEqual(self.login(password='incorrect').status_code, 401)
        result = self.login()
        self.assertEqual(result.status_code, 429)
        self.assertIn('Retry-After', result.headers)
        AuthRateBucket.objects.update(window_started=timezone.now() - timedelta(minutes=16))
        self.assertEqual(self.login().status_code, 200)

    def test_failures_from_another_client_do_not_lock_the_account(self):
        attacker = Client(enforce_csrf_checks=True, REMOTE_ADDR='198.51.100.7')
        token = attacker.get('/api/auth/session', secure=True).json()['csrfToken']
        for _ in range(6):
            post(attacker, 'login', token, {'username': 'alice', 'password': 'incorrect'})
        self.assertEqual(post(attacker, 'login', token, {'username': 'alice', 'password': PASSWORD}).status_code, 429)
        self.assertEqual(self.login().status_code, 200)

    def test_successful_logins_do_not_consume_the_failure_budget(self):
        for _ in range(7):
            client, token = csrf_client()
            response = post(client, 'login', token, {'username': 'alice', 'password': PASSWORD})
            self.assertEqual(response.status_code, 200)

    @override_settings(AUTH_GLOBAL_ATTEMPTS=2)
    def test_registration_attempts_never_block_logins(self):
        for code in ('ft_inv_a', 'ft_inv_b', 'ft_inv_c'):
            self.register(username='mallory', code=code)
        self.assertEqual(self.register(username='mallory', code='ft_inv_d').status_code, 429)
        self.assertEqual(self.login().status_code, 200)

    @override_settings(AUTH_CLIENT_ADDRESS_HEADER='HTTP_X_FORWARDED_FOR')
    def test_proxy_supplied_client_address_separates_budgets(self):
        def attempt(address, password):
            client = Client(enforce_csrf_checks=True, HTTP_X_FORWARDED_FOR=address)
            token = client.get('/api/auth/session', secure=True).json()['csrfToken']
            return post(client, 'login', token, {'username': 'alice', 'password': password})
        for _ in range(5):
            self.assertEqual(attempt('203.0.113.5', 'incorrect').status_code, 401)
        self.assertEqual(attempt('203.0.113.5', PASSWORD).status_code, 429)
        self.assertEqual(attempt('203.0.113.6', PASSWORD).status_code, 200)
        # A forged list or non-address never selects a fresh budget.
        self.assertEqual(attempt('not-an-ip', 'incorrect').status_code, 401)

    def test_expired_budgets_are_purged(self):
        from sync_app.models import AuthRateBucket
        AuthRateBucket.objects.create(key='stale', window_started=timezone.now() - timedelta(hours=1), attempts=3)
        self.assertEqual(self.login(password='incorrect').status_code, 401)
        self.assertFalse(AuthRateBucket.objects.filter(key='stale').exists())

    def test_admin_password_reset_revokes_sessions_and_prints_once(self):
        self.assertEqual(self.login().status_code, 200)
        self.assertEqual(Session.objects.count(), 1)
        output = io.StringIO()
        call_command('reset_sync_password', 'alice', stdout=output)
        temporary = output.getvalue().strip().splitlines()[-1]
        self.assertGreaterEqual(len(temporary), 20)
        self.assertEqual(Session.objects.count(), 0)
        self.alice.refresh_from_db()
        self.assertTrue(self.alice.check_password(temporary))
        self.assertFalse(self.alice.check_password(PASSWORD))
        with self.assertRaises(CommandError):
            call_command('reset_sync_password', 'nobody', stdout=io.StringIO())

    @override_settings(AUTH_GLOBAL_ATTEMPTS=1)
    def test_global_limit_cannot_be_bypassed_by_different_usernames(self):
        self.assertEqual(self.login('missing-one').status_code, 401)
        self.assertEqual(self.login('missing-two').status_code, 429)

    def test_bad_json_duplicates_unknown_fields_and_oversized_body_are_refused(self):
        for body in ('{', '[]', '{"username":"alice","username":"bob","password":"x"}',
                     json.dumps({'username': 'alice', 'password': PASSWORD, 'userId': self.bob.pk})):
            response = self.client.post('/api/auth/login', body, content_type='application/json', secure=True,
                                        HTTP_X_CSRFTOKEN=self.csrf, HTTP_ORIGIN='https://testserver')
            self.assertEqual(response.status_code, 400)
        response = self.client.post('/api/auth/login', ' ' * 8193, content_type='application/json', secure=True,
                                    HTTP_X_CSRFTOKEN=self.csrf, HTTP_ORIGIN='https://testserver')
        self.assertEqual(response.status_code, 413)
        self.assertEqual(self.client.get('/api/auth/login', secure=True).status_code, 405)

    def test_invitation_cli_persists_only_digest_and_expires(self):
        from sync_app.accounts import invitation_digest
        from sync_app.models import SyncInvitation
        output = io.StringIO()
        call_command('create_sync_invitation', hours=2, stdout=output)
        code = output.getvalue().strip()
        invitation = SyncInvitation.objects.get()
        self.assertEqual(invitation.pk, invitation_digest(code))
        self.assertNotEqual(invitation.pk, code)
        self.assertEqual(str(invitation.generation), settings.SYNC_GENERATION)
        self.assertGreater(invitation.expires_at, timezone.now() + timedelta(hours=1, minutes=59))

    @override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.Argon2PasswordHasher'])
    def test_production_registration_uses_argon2(self):
        response = self.register()
        self.assertEqual(response.status_code, 201)
        user = get_user_model().objects.get(username='charlie')
        self.assertTrue(user.password.startswith('argon2$'))
        self.assertTrue(user.check_password(PASSWORD))


class InvitationConcurrencyTests(TransactionTestCase):
    def test_one_invitation_registers_exactly_one_account_under_concurrency(self):
        from sync_app.accounts import create_invitation
        from sync_app.models import SyncInvitation
        code = create_invitation()

        def register(username):
            close_old_connections()
            try:
                client, csrf = csrf_client()
                return post(client, 'register', csrf, {
                    'username': username, 'password': PASSWORD, 'invitation': code,
                }).status_code
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as workers:
            results = sorted(workers.map(register, ('first-person', 'second-person')))
        self.assertEqual(results, [201, 400])
        self.assertEqual(get_user_model().objects.count(), 1)
        self.assertIsNotNone(SyncInvitation.objects.get().used_at)
