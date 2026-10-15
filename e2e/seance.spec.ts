import { expect, test } from '@playwright/test';
import { createRoutineFromTemplate, openApp, startSuggestedWorkout } from './support';

test.describe('une séance, du premier lancement à l’historique', () => {
  test('le premier lancement se passe en silence', async ({ page }) => {
    await page.goto('');
    const dialog = page.getByRole('dialog', { name: 'Avant le premier son' });
    await expect(dialog).toBeVisible();

    await page.getByRole('button', { name: 'Passer' }).click();

    await expect(dialog).toBeHidden();
    // « Passer » ouvre l'app directement, et en silence : aucun son avant que la personne l'ait voulu.
    expect(await page.evaluate(() => localStorage.getItem('fittrack:announcer'))).toBe('silence');
  });

  test('d’un modèle 5×5 à l’historique, avec la hausse de charge proposée', async ({ page }) => {
    await openApp(page);
    await createRoutineFromTemplate(page, /5×5 — A/);
    await startSuggestedWorkout(page, '5×5 — A');

    await page.getByRole('textbox', { name: 'Série 1 — kg' }).fill('100');
    await page.getByRole('button', { name: 'Valider la série 1' }).click();
    await expect(page.getByText('1 série sur 15')).toBeVisible();

    await page.getByRole('button', { name: 'Terminer la séance' }).click();
    await expect(page).toHaveURL(/#\/workout\/finish$/);

    // Un 5×5 est une cible unique, sans fourchette : le coach propose le cran. Il réclamait
    // 6 répétitions pour une cible de 5 — l'impossible — et ne proposait jamais la hausse.
    await expect(page.getByRole('article', { name: 'Coach' })).toContainText('100 → 102,5 kg');

    await page.getByRole('button', { name: 'Enregistrer la séance' }).click();
    await page.getByRole('link', { name: 'Historique' }).click();
    await expect(page.getByText('5×5 — A').first()).toBeVisible();
  });

  test('une série validée survit à un rechargement (règle n° 4)', async ({ page }) => {
    await openApp(page);
    await createRoutineFromTemplate(page, /5×5 — A/);
    await startSuggestedWorkout(page, '5×5 — A');
    await page.getByRole('textbox', { name: 'Série 1 — kg' }).fill('100');
    await page.getByRole('button', { name: 'Valider la série 1' }).click();
    // Le compteur ne bouge qu'une fois la série relue en base : l'écriture est faite.
    await expect(page.getByText('1 série sur 15')).toBeVisible();

    // L'app tuée puis rouverte : la séance reprend là où elle en était.
    await page.reload();

    await expect(page).toHaveURL(/#\/workout$/);
    await expect(page.getByText('1 série sur 15')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Série 1 — kg' })).toHaveValue('100');
    await expect(page.getByRole('button', { name: 'Annuler la série 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('les commandes de la séance ont au moins 48 px (règle n° 5)', async ({ page }) => {
    await openApp(page);
    await createRoutineFromTemplate(page, /5×5 — A/);
    await startSuggestedWorkout(page, '5×5 — A');

    const controls = [
      page.getByRole('button', { name: 'Retour' }),
      page.getByRole('button', { name: 'Options de la séance' }),
      page.getByRole('button', { name: 'Aide sur cette page' }),
      page.getByRole('button', { name: 'Valider la série 1' }),
      page.getByRole('button', { name: 'Terminer la séance' }),
      ...['Accueil', 'Planifier', 'Historique', 'Progression', 'Exercices'].map((name) =>
        page.getByRole('link', { name }),
      ),
    ];

    for (const control of controls) {
      const box = await control.boundingBox();
      expect(box, 'la commande doit être à l’écran').not.toBeNull();
      // 47,5 : un pixel fractionnaire de l'arrondi, pas une cible plus petite.
      expect(box!.height, await control.innerText().catch(() => '')).toBeGreaterThanOrEqual(47.5);
      expect(box!.width).toBeGreaterThanOrEqual(47.5);
    }
  });
});
