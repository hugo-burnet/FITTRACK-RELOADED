import { expect, test, type Page } from '@playwright/test';
import { openApp, seedCompletedWorkouts } from './support';

const generation = '11111111-1111-4111-8111-111111111111';
async function storedWorkouts(page: Page): Promise<Record<string, unknown>[]> {
  return page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fittrack');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const rows = await new Promise<Record<string, unknown>[]>((resolve, reject) => {
      const request = database.transaction('workouts').objectStore('workouts').getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    database.close();
    return rows;
  });
}
async function mockAPI(page: Page) {
  const calls: string[] = [];
  let connected = false;
  let revision = 0;
  let snapshot: Record<string, unknown> | null = null;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    calls.push(path);
    if (path === '/api/auth/register' || path === '/api/auth/login') connected = true;
    if (path === '/api/auth/logout' || path === '/api/account/delete') connected = false;
    if (path === '/api/account/export') {
      await route.fulfill({ json: { format: 'fittrack-personal-export', version: 1,
        exportedAt: new Date().toISOString(), account: { id: '1', username: 'alice' },
        state: { generation, revision, snapshot } } });
      return;
    }
    if (path.startsWith('/api/auth/') || path === '/api/account/delete') {
      await route.fulfill({
        json: {
          authenticated: connected,
          user: connected ? { id: '1', username: 'alice' } : null,
          generation,
          csrfToken: 'x'.repeat(64),
        },
      });
      return;
    }
    if (path === '/api/sync/state') {
      await route.fulfill({ json: { generation, revision, snapshot } });
      return;
    }
    const body = route.request().postDataJSON() as {
      operationId: string;
      snapshot: Record<string, unknown>;
    };
    snapshot = body.snapshot;
    revision += 1;
    await route.fulfill({ json: { generation, revision, operationId: body.operationId } });
  });
  return {
    calls,
    getSnapshot: () => snapshot,
    changeRemote: (next: Record<string, unknown>) => {
      snapshot = next;
      revision += 1;
    },
  };
}
async function createAccount(page: Page) {
  await page.getByRole('button', { name: 'Créer un compte', exact: true }).click();
  await page.getByLabel('Identifiant', { exact: true }).fill('alice');
  await page.getByLabel('Mot de passe', { exact: true }).fill('a-long-example-password-123');
  await page.getByLabel('Code d’invitation').fill('private-test-invitation');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByText('Connecté : alice', { exact: true })).toBeVisible();
}

test('export et suppression sans activer la synchronisation gardent l’historique local', async ({ page }) => {
  const api = await mockAPI(page);
  await openApp(page);
  await seedCompletedWorkouts(page, 1);
  await page.goto('/#/settings/sync');
  await createAccount(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exporter mes données du serveur', exact: true }).click();
  expect((await download).suggestedFilename()).toBe('fittrack-server-account.json');
  await page.getByRole('button', { name: 'Supprimer mon compte', exact: true }).click();
  const confirm = page.getByRole('button', { name: 'Supprimer définitivement mon compte', exact: true });
  await expect(confirm).toBeDisabled();
  await page.getByLabel('Confirmer mon identifiant', { exact: true }).fill('alice');
  await expect(confirm).toBeDisabled();
  await page.getByLabel('Mot de passe actuel', { exact: true }).fill('synthetic-password');
  await expect(confirm).toBeEnabled();
  await page.screenshot({ path: 'C:/Users/e6/Documents/homelab/backups/fittrack-account-controls.png', fullPage: true });
  await confirm.click();
  await expect(page.getByRole('button', { name: 'Créer un compte', exact: true })).toBeVisible();
  expect(await storedWorkouts(page)).toHaveLength(1);
  expect(api.calls).not.toContain('/api/sync/publish');
});
test('app sans compte puis inscription ultérieure : historique conservé et aucun envoi', async ({
  page,
}) => {
  const api = await mockAPI(page);
  await openApp(page);
  await seedCompletedWorkouts(page, 1);
  await page.goto('/#/settings');
  expect(await storedWorkouts(page)).toHaveLength(1);
  await expect(page.getByRole('heading', { level: 1, name: 'Réglages' })).toBeVisible();
  expect(api.calls).toEqual([]);
  await page.getByRole('button', { name: /Compte et synchronisation/ }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Compte et synchronisation' }),
  ).toBeVisible();
  // Opening the screen is not an account action: still no request at all.
  await expect(page.getByRole('button', { name: 'Créer un compte', exact: true })).toBeVisible();
  expect(api.calls).toEqual([]);
  await createAccount(page);
  await expect(page.getByRole('switch', { name: 'Synchroniser cet appareil' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  expect(api.calls.every((path) => path.startsWith('/api/auth/'))).toBe(true);
  expect(await storedWorkouts(page)).toHaveLength(1);
  await page.reload();
  await page.goto('/#/history');
  await expect(page.getByText('Séance 1', { exact: true })).toBeVisible();
});
test('activation explicite puis arrêt : données locales préservées', async ({ page }) => {
  const api = await mockAPI(page);
  await openApp(page);
  await seedCompletedWorkouts(page, 1);
  await page.goto('/#/settings/sync');
  await createAccount(page);
  await page.getByRole('switch', { name: 'Synchroniser cet appareil' }).click();
  expect(api.calls).not.toContain('/api/sync/publish');
  await page.getByRole('button', { name: 'Activer et synchroniser', exact: true }).click();
  await expect(page.getByText('Données synchronisées.', { exact: true })).toBeVisible();
  expect(api.calls).toContain('/api/sync/publish');
  await page.getByRole('switch', { name: 'Synchroniser cet appareil' }).click();
  await expect(page.getByRole('switch', { name: 'Synchroniser cet appareil' })).toHaveAttribute(
    'aria-checked',
    'false',
  );
  const count = api.calls.length;
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page.getByRole('button', { name: 'Créer un compte', exact: true })).toBeVisible();
  expect(api.calls.slice(count).every((path) => path.startsWith('/api/auth/'))).toBe(true);
  expect(await storedWorkouts(page)).toHaveLength(1);
  await page.reload();
  await page.goto('/#/history');
  await expect(page.getByText('Séance 1', { exact: true })).toBeVisible();
});
test('données divergentes : aucun remplacement sans choix et confirmation', async ({ page }) => {
  const api = await mockAPI(page);
  await openApp(page);
  await seedCompletedWorkouts(page, 1);
  await page.goto('/#/settings/sync');
  await createAccount(page);
  await page.getByRole('switch', { name: 'Synchroniser cet appareil' }).click();
  await page.getByRole('button', { name: 'Activer et synchroniser', exact: true }).click();
  await expect(page.getByText('Données synchronisées.', { exact: true })).toBeVisible();
  const remote = structuredClone(api.getSnapshot())!;
  const tables = remote.tables as Record<string, Record<string, unknown>[]>;
  tables.workouts![0]!.name = 'Séance du serveur';
  api.changeRemote(remote);
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fittrack');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction('workouts', 'readwrite');
    const store = transaction.objectStore('workouts');
    const all = store.getAll();
    all.onsuccess = () => {
      store.put({ ...all.result[0], name: 'Séance locale' });
    };
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });
  await page.getByRole('button', { name: 'Synchroniser maintenant' }).click();
  await expect(page.getByText('Les deux copies sont différentes.', { exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/sync/conflict.png', fullPage: true });
  await page.getByRole('button', { name: 'Utiliser les données du serveur', exact: true }).click();
  await page.getByRole('button', { name: 'Remplacer sur cet appareil', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Compte et synchronisation', exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/^Données de cet appareil, remplacées le /)).toBeVisible();
  await page.goto('/#/history');
  await expect(page.getByText('Séance du serveur', { exact: true })).toBeVisible();
});
test.describe('mise en page agrandie', () => {
  // addStyleTag injects an inline <style>, which the client's policy rightly refuses.
  test.use({ bypassCSP: true });
  for (const theme of ['dark', 'light', 'tty1', 'cyber']) {
    test(`formulaire à 200 % sans débordement : ${theme}`, async ({ page }) => {
      await mockAPI(page);
      await page.addInitScript((value) => localStorage.setItem('fittrack:theme', value), theme);
      await openApp(page);
      await page.goto('/#/settings/sync');
      await page.getByRole('button', { name: /Créer un compte/ }).click();
      await page.screenshot({ path: `test-results/sync/form-${theme}.png`, fullPage: true });
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      const overflow = await page.evaluate(() => {
        if (document.documentElement.scrollWidth <= innerWidth + 1) return [];
        return [...document.querySelectorAll('*')].filter((node) => {
          const box = node.getBoundingClientRect(); return box.right > innerWidth + 1 || box.left < -1;
        }).map((node) => ({ tag: node.tagName, part: node.getAttribute('data-part'),
          text: node.textContent?.slice(0, 90), width: node.getBoundingClientRect().width }));
      });
      expect(overflow).toEqual([]);
      for (const input of await page.getByRole('textbox').all()) {
        const box = await input.boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(48);
      }
    });
  }
});
test('une erreur serveur malformée ne casse pas les réglages', async ({ page }) => {
  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 503, json: { error: 'toString' } }),
  );
  await openApp(page);
  await page.goto('/#/settings/sync');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.getByLabel('Identifiant', { exact: true }).fill('alice');
  await page.getByLabel('Mot de passe', { exact: true }).fill('a-long-example-password-123');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('L’opération n’a pas abouti');
  await expect(page.getByLabel('Identifiant', { exact: true })).toBeVisible();
});
test('le client homelab applique sa politique de sécurité sans rien casser', async ({ page }) => {
  await mockAPI(page);
  await page.addInitScript(() => {
    const seen: string[] = [];
    (window as unknown as { cspViolations: string[] }).cspViolations = seen;
    document.addEventListener('securitypolicyviolation', (event) =>
      seen.push(`${event.violatedDirective} ${event.blockedURI}`),
    );
  });
  const response = await page.goto('/');
  const policy = response?.headers()['content-security-policy'] ?? '';
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("connect-src 'self'");
  expect(policy).not.toMatch(/script-src[^;]*unsafe/);
  await openApp(page);
  await seedCompletedWorkouts(page, 1);
  for (const route of [
    '/#/',
    '/#/routines',
    '/#/history',
    '/#/analytics',
    '/#/exercises',
    '/#/settings',
    '/#/settings/sync',
  ]) {
    await page.goto(route);
    await page.waitForLoadState('networkidle');
  }
  expect(
    await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations),
  ).toEqual([]);
});
