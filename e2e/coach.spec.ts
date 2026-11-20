import { expect, test } from '@playwright/test';
import {
  createRoutineFromTemplate,
  logFirstExerciseAndFinish,
  openApp,
  startSuggestedWorkout,
} from './support';

/**
 * La carte chiffrée du coach, dans un vrai navigateur.
 *
 * Elle naît à la fin d'une séance dont toutes les séries de travail atteignent le haut de la fourchette :
 * ici le développé couché du modèle « Poussée » (4 × 6 – 8), fait 4 × 8 à 80 kg, qui s'affiche à la
 * séance suivante. Le modèle n'est dans aucun programme : la carte est celle d'une séance hors programme.
 */

test.describe('la carte chiffrée du coach', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await createRoutineFromTemplate(page, /Poussée/);
    await startSuggestedWorkout(page, 'Poussée');
    await logFirstExerciseAndFinish(page, { sets: 4, weight: 80, reps: 8 });
    await startSuggestedWorkout(page, 'Poussée');
  });

  test('« Appliquer » sous un échauffement le laisse à sa charge et charge les séries de travail', async ({
    page,
  }) => {
    const coach = page.getByRole('article', { name: 'Coach' }).first();
    await expect(coach).toContainText('80 → 82,5 kg');

    // La série 1 devient un échauffement léger, non validé : « Appliquer » ne doit pas lui donner
    // la charge de travail (il la lui donnait, et l'échauffement montait à 82,5 kg).
    await page.getByRole('button', { name: /^Série 1/ }).first().click();
    await page.getByRole('button', { name: /^Type de série/ }).click();
    await page.getByRole('radio', { name: /^Échauffement/ }).click();
    // Choisir le type referme la feuille.
    await expect(page.getByRole('button', { name: 'Série 1 — Échauffement' })).toBeVisible();
    await page.getByRole('textbox', { name: /^Série 1 — kg/ }).first().fill('40');

    await coach.getByRole('button', { name: 'Appliquer 82,5 kg' }).click();

    await expect(page.getByRole('textbox', { name: /^Série 2 — kg/ }).first()).toHaveAttribute(
      'placeholder',
      '82,5',
    );
    for (const number of [3, 4]) {
      await expect(
        page.getByRole('textbox', { name: new RegExp(`^Série ${number} — kg`) }).first(),
      ).toHaveAttribute('placeholder', '82,5');
    }
    await expect(page.getByRole('textbox', { name: /^Série 1 — kg/ }).first()).toHaveValue('40');
    await expect(page.getByRole('textbox', { name: /^Série 1 — kg/ }).first()).not.toHaveAttribute(
      'placeholder',
      '82,5',
    );
    await expect(page.getByRole('article', { name: 'Coach' })).toHaveCount(0);
  });

  test('« Ignorer » fait disparaître la carte, et elle ne revient pas à la séance suivante', async ({
    page,
  }) => {
    const coach = page.getByRole('article', { name: 'Coach' }).first();
    await expect(coach).toContainText('80 → 82,5 kg');
    await coach.getByRole('button', { name: 'Ignorer' }).click();
    await expect(page.getByRole('article', { name: 'Coach' })).toHaveCount(0);

    // Même performance qu'avant : sans le refus, la même proposition renaîtrait à la fin de la séance.
    await logFirstExerciseAndFinish(page, { sets: 4, weight: 80, reps: 8 });
    await startSuggestedWorkout(page, 'Poussée');

    // La séance est affichée (le fantôme de la dernière fois y est lu) avant d'affirmer l'absence.
    await expect(page.getByRole('textbox', { name: /^Série 1 — kg/ }).first()).toHaveAttribute(
      'placeholder',
      '80',
    );
    await expect(page.getByRole('article', { name: 'Coach' })).toHaveCount(0);
  });
});
