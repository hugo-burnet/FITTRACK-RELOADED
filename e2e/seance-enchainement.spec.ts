import { expect, test } from '@playwright/test';
import { createRoutineFromTemplate, openApp, startSuggestedWorkout } from './support';

/**
 * Enchaîner les séries : le repos qu'on regarde de loin, et la série suivante qu'on valide d'un tap.
 * Deux défauts de l'audit d'ergonomie v2.19 (constats 3 et 7), vus ici dans un vrai navigateur.
 */
test.describe('enchaîner les séries', () => {
  test('première séance : la série 2 reprend en grisé la série 1, et la coche l’enregistre', async ({
    page,
  }) => {
    await openApp(page);
    await createRoutineFromTemplate(page, /Full-body/);
    await startSuggestedWorkout(page, 'Full-body');

    // Aucun historique : rien en grisé sur la série 1, on saisit.
    await page.getByRole('textbox', { name: 'Série 1 — kg' }).first().fill('60');
    await page
      .getByRole('textbox', { name: /^Série 1 — reps/ })
      .first()
      .fill('7');
    await page.getByRole('button', { name: 'Valider la série 1' }).first().click();
    await expect(page.getByText('1 série sur 15')).toBeVisible();

    const weight2 = page.getByRole('textbox', { name: 'Série 2 — kg' }).first();
    const reps2 = page.getByRole('textbox', { name: /^Série 2 — reps/ }).first();
    // Suggérés, pas écrits : les cases sont vides et montrent les chiffres en grisé.
    await expect(weight2).toHaveValue('');
    await expect(weight2).toHaveAttribute('placeholder', '60');
    await expect(reps2).toHaveValue('');
    await expect(reps2).toHaveAttribute('placeholder', '7');

    await page.getByRole('button', { name: 'Valider la série 2' }).first().click();
    await expect(page.getByText('2 séries sur 15')).toBeVisible();

    // Enregistrée telle quelle, et relue de la base après un rechargement.
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Série 2 — kg' }).first()).toHaveValue('60');
    await expect(page.getByRole('textbox', { name: /^Série 2 — reps/ }).first()).toHaveValue('7');
  });
});
