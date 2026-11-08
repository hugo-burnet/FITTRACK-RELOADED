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
    if (path === '/api/auth/logout') connected = false;
    if (path.startsWith('/api/auth/')) {
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
  await page.goto('/#/history');
  await expect(page.getByText('Séance du serveur', { exact: true })).toBeVisible();
});
for (const theme of ['dark', 'light', 'tty1', 'cyber']) {
  test(`formulaire à 200 % sans débordement : ${theme}`, async ({ page }) => {
    await mockAPI(page);
    await page.addInitScript((value) => localStorage.setItem('fittrack:theme', value), theme);
    await openApp(page);
    await page.goto('/#/settings/sync');
    await page.getByRole('button', { name: /Créer un compte/ }).click();
    await page.screenshot({ path: `test-results/sync/form-${theme}.png`, fullPage: true });
    await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    expect(overflow).toBe(false);
    for (const input of await page.getByRole('textbox').all()) {
      const box = await input.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(48);
    }
  });
}
test('une erreur serveur malformée ne casse pas les réglages', async ({ page }) => {
  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 503, json: { error: 'toString' } }),
  );
  await openApp(page);
  await page.goto('/#/settings/sync');
  await expect(page.getByRole('alert')).toContainText('L’opération n’a pas abouti');
  await page.getByRole('button', { name: /Créer un compte/ }).click();
  await expect(page.getByLabel('Identifiant', { exact: true })).toBeVisible();
});
