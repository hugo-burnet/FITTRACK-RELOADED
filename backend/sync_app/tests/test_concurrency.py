import threading
from concurrent.futures import ThreadPoolExecutor

from django.contrib.auth import get_user_model
from django.db import close_old_connections
from django.test import TransactionTestCase

from .test_protocol import authenticated_client, message


class ConcurrentPublicationTests(TransactionTestCase):
    def test_two_clients_cannot_both_publish_from_the_same_revision(self):
        owner = get_user_model().objects.create_user('concurrent')
        clients = [authenticated_client(owner), authenticated_client(owner)]
        barrier = threading.Barrier(2)

        def send(index):
            close_old_connections()
            try:
                barrier.wait(timeout=10)
                return clients[index].post(
                    '/api/sync/publish', message(f'device-{index}'),
                    content_type='application/json',
                ).status_code
            finally:
                close_old_connections()

        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(send, range(2)))
        self.assertEqual(sorted(results), [200, 409])
        self.assertEqual(clients[0].get('/api/sync/state').json()['revision'], 1)
