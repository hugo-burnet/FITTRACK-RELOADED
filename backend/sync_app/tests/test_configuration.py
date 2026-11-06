import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


class DeploymentConfigurationTests(unittest.TestCase):
    def run_settings(self, script='import fittrack_server.settings', **extra):
        environment = {key: value for key, value in os.environ.items() if not key.startswith('FITTRACK_')}
        environment.update(extra)
        return subprocess.run(
            [sys.executable, '-c', script],
            cwd=Path(__file__).parents[2], env=environment,
            text=True, capture_output=True, timeout=15,
        )

    def test_deployment_refuses_missing_configuration(self):
        result = self.run_settings()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('ImproperlyConfigured', result.stderr)

    def test_deployment_loads_only_explicit_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            key = root / 'secret'
            key.write_text('test-only-deployment-key-' * 4)
            key.chmod(0o600)
            generation = root / 'generation'
            generation.write_text('22222222-2222-4222-8222-222222222222')
            result = self.run_settings(
                FITTRACK_SECRET_FILE=str(key), FITTRACK_GENERATION_FILE=str(generation),
                FITTRACK_ALLOWED_HOSTS='homelab.test.ts.net', FITTRACK_DATA_DIR=str(root),
            )
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_wildcard_host_is_not_an_accepted_deployment(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            key = root / 'secret'
            key.write_text('test-only-deployment-key-' * 4)
            key.chmod(0o600)
            generation = root / 'generation'
            generation.write_text('22222222-2222-4222-8222-222222222222')
            result = self.run_settings(
                FITTRACK_SECRET_FILE=str(key), FITTRACK_GENERATION_FILE=str(generation),
                FITTRACK_ALLOWED_HOSTS='*', FITTRACK_DATA_DIR=str(root),
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('ImproperlyConfigured', result.stderr)

    def test_storage_must_be_selected_even_if_a_default_directory_exists(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            key = root / 'secret'
            key.write_text('test-only-deployment-key-' * 4)
            key.chmod(0o600)
            generation = root / 'generation'
            generation.write_text('22222222-2222-4222-8222-222222222222')
            # Simulate an image that happens to contain a writable /data,
            # without creating paths outside this test's temporary directory.
            result = self.run_settings(
                script=(
                    'from unittest.mock import patch\n'
                    'with patch("pathlib.Path.is_dir", return_value=True), patch("os.access", return_value=True):\n'
                    '    import fittrack_server.settings\n'
                ),
                FITTRACK_SECRET_FILE=str(key), FITTRACK_GENERATION_FILE=str(generation),
                FITTRACK_ALLOWED_HOSTS='homelab.test.ts.net',
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn('FITTRACK_DATA_DIR', result.stderr)
