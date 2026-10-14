import { expect, test } from '@playwright/test';
import { createRoutineFromTemplate, openApp } from './support';

// Le service worker est bloqué partout ailleurs (cf. `playwright.config.ts`) ; ici, c'est le sujet.
test.use({ serviceWorkers: 'allow' });

test('l’app complète démarre et s’utilise sans aucun réseau (règle n° 2)', async ({
  page,
  context,
}) => {
  await openApp(page);

  // Le service worker précache le build entier ; on attend qu'il l'ait fait, puis on recharge une
  // fois pour que la page soit contrôlée par lui — c'est le deuxième lancement qui tient hors-ligne.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(
      () =>
        page.evaluate(async () => {
          let precached = 0;
          for (const name of await caches.keys()) {
            precached = Math.max(precached, (await (await caches.open(name)).keys()).length);
          }
          return precached;
        }),
      { timeout: 60_000, message: 'le précache du service worker ne se remplit pas' },
    )
    .toBeGreaterThan(200);
  await page.reload();

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByRole('heading', { level: 1, name: 'Accueil' })).toBeVisible();
  // Et on s'en sert : une routine depuis un modèle, sans un octet de réseau.
  await createRoutineFromTemplate(page, /Poussée/);
  await expect(page.getByRole('button', { name: 'Démarrer Poussée' })).toBeVisible();
});
