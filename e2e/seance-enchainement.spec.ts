import { expect, test } from '@playwright/test';
import {
  createRoutineFromTemplate,
  findHorizontalOverflow,
  openApp,
  settleLayout,
  startSuggestedWorkout,
  type ThemeName,
} from './support';

/**
 * Enchaîner les séries : le repos qu'on regarde de loin, et la série suivante qu'on valide d'un tap.
 * Deux défauts de l'audit d'ergonomie v2.19 (constats 3 et 7), vus ici dans un vrai navigateur.
 */
test.describe('enchaîner les séries', () => {
  test('le repos reste à l’écran quand on fait défiler jusqu’à l’exercice suivant', async ({
    page,
  }) => {
    await openApp(page);
    await createRoutineFromTemplate(page, /5×5 — A/);
    await startSuggestedWorkout(page, '5×5 — A');
    await page.getByRole('textbox', { name: 'Série 1 — kg' }).fill('100');
    await page.getByRole('button', { name: 'Valider la série 1' }).click();

    const reading = page.getByText(/^Repos \d+:\d\d$/);
    await expect(reading).toBeVisible();

    // L'exercice suivant, ouvert et amené à l'écran : la carte qui se repose sort par le haut.
    await page
      .getByRole('button', { name: /Rowing barre/ })
      .first()
      .click();
    await page.getByRole('textbox', { name: 'Série 5 — kg' }).last().scrollIntoViewIfNeeded();
    await page
      .getByRole('button', { name: /Rowing barre/ })
      .first()
      .scrollIntoViewIfNeeded();

    await expect(reading).toBeInViewport();
    // Lisible à bout de bras : au moins 24 px.
    const size = await reading.evaluate((node) => parseFloat(getComputedStyle(node).fontSize));
    expect(size).toBeGreaterThanOrEqual(24);
    // Les trois gestes du repos, sous le pouce et à 48 px.
    for (const name of [
      'Retirer 15 secondes au repos',
      'Ajouter 15 secondes au repos',
      'Passer le repos',
    ]) {
      const control = page.getByRole('button', { name });
      await expect(control).toBeInViewport();
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(47.5);
      expect(box!.width).toBeGreaterThanOrEqual(47.5);
    }

    // « Passer » termine le repos maintenant.
    await page.getByRole('button', { name: 'Passer le repos' }).click();
    await expect(reading).toBeHidden();
  });

  // Les échelles les plus grandes de `mise-en-page.spec.ts` pour chaque thème : TTY1 s'y arrête à
  // 130 %, sa barre d'onglets ne tenant pas à 200 % (hors du sujet de ce test).
  const CASES: { theme: ThemeName; scale: number }[] = [
    { theme: 'dark', scale: 200 },
    { theme: 'light', scale: 200 },
    { theme: 'tty1', scale: 130 },
    { theme: 'cyber', scale: 200 },
  ];
  for (const { theme, scale } of CASES) {
    test(`thème ${theme}, police à ${scale} % : la barre de repos ne déborde pas`, async ({
      page,
    }) => {
      await openApp(page);
      await createRoutineFromTemplate(page, /5×5 — A/);
      await startSuggestedWorkout(page, '5×5 — A');
      await page.evaluate((chosen) => {
        localStorage.setItem('fittrack.tty1Unlocked', '1');
        localStorage.setItem('fittrack:theme', chosen);
      }, theme);
      await page.reload();
      await page.evaluate((percent) => {
        document.documentElement.style.fontSize = `${percent}%`;
      }, scale);
      await page.getByRole('textbox', { name: 'Série 1 — kg' }).fill('100');
      await page.getByRole('button', { name: 'Valider la série 1' }).click();
      const reading = page.getByText(/^Repos \d+:\d\d$/);
      await expect(reading).toBeInViewport();
      await settleLayout(page);

      expect(await findHorizontalOverflow(page)).toEqual([]);
      await expect(page.getByRole('button', { name: 'Passer le repos' })).toBeInViewport();
      await expect(page.getByRole('button', { name: 'Terminer la séance' })).toBeInViewport();
    });
  }

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
