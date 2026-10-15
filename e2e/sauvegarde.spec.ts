import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { createRoutineFromTemplate, openApp, seedCompletedWorkouts } from './support';

test.describe('la protection de l’historique', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await createRoutineFromTemplate(page, /5×5 — A/);
    // Trois séances que nulle sauvegarde ne contient : le seuil du rappel.
    await seedCompletedWorkouts(page, 3);
    await page.reload();
  });

  test('le rappel se place sous la séance à lancer, jamais au-dessus', async ({ page }) => {
    const nudge = page.getByRole('region', { name: 'Sauvegarde ton historique' });
    await expect(nudge).toBeVisible();
    await expect(nudge).toContainText('3 séances');

    const launch = await page.getByRole('button', { name: 'Démarrer 5×5 — A' }).boundingBox();
    const card = await nudge.boundingBox();
    expect(launch).not.toBeNull();
    expect(card).not.toBeNull();
    // La prochaine action reste en tête de l'écran : ce rappel n'est pas elle.
    expect(card!.y).toBeGreaterThan(launch!.y + launch!.height);

    for (const name of ['Sauvegarder', 'Plus tard']) {
      const button = await nudge.getByRole('button', { name, exact: true }).boundingBox();
      expect(button!.height).toBeGreaterThanOrEqual(47.5);
    }
  });

  test('« Sauvegarder » sort un fichier complet et éteint le rappel', async ({ page }) => {
    const nudge = page.getByRole('region', { name: 'Sauvegarde ton historique' });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      nudge.getByRole('button', { name: 'Sauvegarder', exact: true }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^fittrack-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/);
    const path = await download.path();
    const file = JSON.parse(await readFile(path, 'utf8')) as {
      format: string;
      tables: { workouts: unknown[]; routines: unknown[] };
    };
    expect(file.format).toBe('fittrack-backup');
    expect(file.tables.workouts).toHaveLength(3);
    expect(file.tables.routines).toHaveLength(1);

    await expect(nudge).toBeHidden();

    // Les Réglages disent la même chose, et la mémoire survit à un rechargement.
    await page.getByRole('button', { name: 'Réglages' }).click();
    await expect(page.getByText(/Dernière sauvegarde : aujourd.hui\. À jour\./)).toBeVisible();
    await page.goto('');
    await expect(page.getByRole('region', { name: 'Sauvegarde ton historique' })).toBeHidden();
  });

  test('« Plus tard » fait taire le rappel, y compris après un rechargement', async ({ page }) => {
    const nudge = page.getByRole('region', { name: 'Sauvegarde ton historique' });
    await nudge.getByRole('button', { name: 'Plus tard' }).click();
    await expect(nudge).toBeHidden();

    await page.reload();
    await expect(page.getByRole('button', { name: 'Démarrer 5×5 — A' })).toBeVisible();
    await expect(nudge).toBeHidden();
  });

  test('les Réglages disent combien de séances rien ne protège', async ({ page }) => {
    await page.getByRole('button', { name: 'Réglages' }).click();
    await expect(
      page.getByText('Aucune sauvegarde faite depuis cet appareil. 3 séances à protéger.'),
    ).toBeVisible();
  });
});
