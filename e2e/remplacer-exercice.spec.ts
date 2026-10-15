import { expect, test, type Page } from '@playwright/test';
import { createRoutineFromTemplate, openApp, startSuggestedWorkout } from './support';

/**
 * « La machine est prise » : un autre exercice pour ce qu'il reste à faire, depuis la séance.
 *
 * Une séance « 5×5 — A » : squat, développé couché, rowing, cinq séries chacun.
 */
async function startFiveByFive(page: Page): Promise<void> {
  await openApp(page);
  await createRoutineFromTemplate(page, /5×5 — A/);
  await startSuggestedWorkout(page, '5×5 — A');
}

async function openReplaceFor(page: Page, exercise: string): Promise<void> {
  await page.getByRole('button', { name: `Options de ${exercise}` }).click();
  await page.getByRole('button', { name: /Remplacer l’exercice/ }).click();
  await expect(page).toHaveURL(/#\/workout\/replace\/[^/]+$/);
}

async function chooseInLibrary(page: Page, search: string, exercise: string): Promise<void> {
  await page.getByRole('searchbox').or(page.getByRole('textbox')).first().fill(search);
  await page.getByRole('button', { name: new RegExp(exercise) }).first().click();
  await expect(page).toHaveURL(/#\/workout$/);
}

test.describe('remplacer l’exercice en séance', () => {
  test('aucune série validée : la ligne devient l’autre exercice, à la même place', async ({
    page,
  }) => {
    await startFiveByFive(page);

    await openReplaceFor(page, 'Squat (barre, nuque)');
    // Le nom complet de l'exercice remplacé se lit, non coupé comme il le serait dans un titre.
    await expect(page.getByText(/Pour les séries à faire de Squat \(barre, nuque\)/)).toBeVisible();
    await chooseInLibrary(page, 'presse à cuisses', 'Presse à cuisses');

    // Le squat a disparu de la séance, la presse est à sa place, les quinze séries sont là.
    await expect(page.getByRole('button', { name: /^Squat \(barre, nuque\)/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Presse à cuisses/ }).first()).toBeVisible();
    await expect(page.getByText('0 série sur 15')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Série 5 — reps' })).toHaveAttribute(
      'placeholder',
      '5',
    );
  });

  test('des séries validées : elles restent, l’autre exercice reprend derrière', async ({
    page,
  }) => {
    await startFiveByFive(page);
    await page.getByRole('textbox', { name: 'Série 1 — kg' }).fill('100');
    await page.getByRole('button', { name: 'Valider la série 1' }).click();
    await expect(page.getByText('1 série sur 15')).toBeVisible();

    await openReplaceFor(page, 'Squat (barre, nuque)');
    await chooseInLibrary(page, 'presse à cuisses', 'Presse à cuisses');

    // Le squat garde sa série faite ; la presse a les quatre qu'il restait. Toujours quinze au total.
    await expect(page.getByText('1 série sur 15')).toBeVisible();
    const squat = page.getByRole('button', { name: /^Squat \(barre, nuque\)/ });
    await expect(squat).toBeVisible();
    await expect(page.getByRole('button', { name: /^Presse à cuisses/ }).first()).toBeVisible();
    // La presse, ouverte, a quatre séries — pas cinq.
    await expect(page.getByRole('textbox', { name: 'Série 4 — kg' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Série 5 — kg' })).toHaveCount(0);

    // Le squat, rouvert, montre toujours sa série à 100 kg ; la presse n'a rien de saisi.
    await squat.click();
    const firstSets = await page
      .getByRole('textbox', { name: 'Série 1 — kg' })
      .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));
    expect(firstSets.sort()).toEqual(['', '100']);
  });

  test('la séance remplacée survit à un rechargement', async ({ page }) => {
    await startFiveByFive(page);
    await openReplaceFor(page, 'Rowing barre');
    await chooseInLibrary(page, 'tirage', 'Tirage');

    await page.reload();

    await expect(page.getByRole('button', { name: /^Rowing barre/ })).toHaveCount(0);
    await expect(page.getByText('0 série sur 15')).toBeVisible();
  });

  test('l’entrée du menu dit pourquoi elle est éteinte quand tout est validé', async ({
    page,
  }) => {
    await startFiveByFive(page);
    for (const number of [1, 2, 3, 4, 5]) {
      await page.getByRole('textbox', { name: `Série ${number} — kg` }).fill('100');
      await page.getByRole('button', { name: `Valider la série ${number}` }).click();
    }
    await expect(page.getByText('5 séries sur 15')).toBeVisible();

    await page.getByRole('button', { name: 'Options de Squat (barre, nuque)' }).click();
    const entry = page.getByRole('button', { name: /Remplacer l’exercice/ });
    await expect(entry).toBeDisabled();
    await expect(entry).toContainText('Toutes les séries sont validées');
  });
});
