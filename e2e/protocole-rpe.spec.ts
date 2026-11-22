import { expect, test } from '@playwright/test';
import {
  createRoutineFromTemplate,
  findHorizontalOverflow,
  openApp,
  settleLayout,
  startSuggestedWorkout,
} from './support';

/**
 * Le protocole disciplinaire RPE dans un vrai navigateur : la série enregistrée au-delà du plafond
 * suspend la séance, le verrou survit à un rechargement (règle n° 4), le panneau tient à 390 px, et
 * la séance se termine toujours.
 */
test.describe('le protocole disciplinaire RPE', () => {
  test('suspend la séance au-delà du plafond, survit au rechargement, laisse terminer', async ({
    page,
  }) => {
    await openApp(page);
    await createRoutineFromTemplate(page, /5×5 — A/);
    await startSuggestedWorkout(page, '5×5 — A');

    await page.getByRole('textbox', { name: 'Série 1 — kg' }).fill('100');
    await page.getByRole('button', { name: 'Valider la série 1' }).click();

    const strip = page.getByRole('group', { name: 'Effort perçu' });
    await strip.getByRole('slider').fill('9');
    await strip.getByRole('button', { name: 'Valider le RPE 9' }).click();

    const title = page.getByRole('heading', { name: 'Autorisation d’entraînement suspendue' });
    await expect(title).toBeVisible();
    await expect(page.getByRole('button', { name: 'Valider la série 2' })).toBeDisabled();
    await expect(page.getByText('1 série sur 15')).toBeVisible();

    for (const name of ['Corriger une erreur de saisie', 'Déverrouillage exceptionnel']) {
      const box = await page.getByRole('button', { name }).boundingBox();
      expect(box!.height, name).toBeGreaterThanOrEqual(47.5);
    }
    await settleLayout(page);
    expect(await findHorizontalOverflow(page)).toEqual([]);

    // L'app tuée puis rouverte : le verrou se relit dans la base.
    await page.reload();
    await expect(title).toBeVisible();
    await expect(page.getByRole('button', { name: 'Valider la série 2' })).toBeDisabled();

    await page.getByRole('button', { name: 'Terminer la séance' }).click();
    await expect(page).toHaveURL(/#\/workout\/finish$/);
  });
});
