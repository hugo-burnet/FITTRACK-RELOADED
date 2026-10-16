import { expect, test, type Locator, type Page } from '@playwright/test';
import { openApp } from './support';

/**
 * Le pas de charge de toute l'appli (Réglages › Coach) : le poser une fois, le retrouver après un
 * rechargement (règle n° 4, rien ne se perd), le lire sur la fiche d'un exercice qui n'a pas le sien, et
 * le retirer.
 */

/** Réglages › Pas de charge par défaut, par les écrans et non par l'adresse : c'est la porte d'entrée. */
async function openStepSheet(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Réglages' }).click();
  await page.getByRole('button', { name: /^Pas de charge par défaut/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Pas de charge par défaut' });
  await expect(sheet).toBeVisible();
  return sheet;
}

test.describe('le pas de charge de toute l’appli', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('posé une fois, il survit à un rechargement et se lit sur la fiche d’un exercice', async ({
    page,
  }) => {
    const sheet = await openStepSheet(page);
    await expect(sheet.getByRole('textbox', { name: 'Pas en kilos' })).toHaveValue('');
    await sheet.getByRole('textbox', { name: 'Pas en kilos' }).fill('1,125');
    await sheet.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(sheet).toBeHidden();

    const row = page.getByRole('button', { name: /^Pas de charge par défaut/ });
    await expect(row).toContainText('1,125 kg quand la fiche d’un exercice n’a pas son propre pas');

    await page.reload();
    await expect(page.getByRole('button', { name: /^Pas de charge par défaut/ })).toContainText(
      '1,125 kg',
    );

    // La fiche d'un exercice sans incrément saisi : son champ vide montre le pas des Réglages.
    await page.getByRole('link', { name: 'Exercices' }).click();
    await page.getByRole('button', { name: /^Développé couché/ }).first().click();
    const field = page.getByRole('textbox', { name: 'Incrément de charge' });
    await expect(field).toHaveAttribute('placeholder', '1,125');
    await expect(page.getByText(/Vide = le pas des Réglages \(1,125 kg\)/)).toBeVisible();
  });

  test('« Selon le matériel » le retire, et la fiche retrouve la table du matériel', async ({
    page,
  }) => {
    let sheet = await openStepSheet(page);
    await sheet.getByRole('textbox', { name: 'Pas en kilos' }).fill('1,125');
    await sheet.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(sheet).toBeHidden();

    sheet = await openStepSheet(page);
    await expect(sheet.getByRole('textbox', { name: 'Pas en kilos' })).toHaveValue('1,125');
    await sheet.getByRole('button', { name: 'Selon le matériel' }).click();
    await sheet.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('button', { name: /^Pas de charge par défaut/ })).toContainText(
      'Selon le matériel de chaque exercice',
    );

    await page.getByRole('link', { name: 'Exercices' }).click();
    await page.getByRole('button', { name: /^Développé couché/ }).first().click();
    await expect(page.getByText(/Vide = défaut selon le matériel/)).toBeVisible();
  });

  test('les commandes de la feuille font au moins 48 px', async ({ page }) => {
    const sheet = await openStepSheet(page);

    for (const control of [
      sheet.getByRole('textbox', { name: 'Pas en kilos' }),
      sheet.getByRole('button', { name: 'Selon le matériel' }),
      sheet.getByRole('button', { name: 'Enregistrer' }),
    ]) {
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(47.5);
    }
  });
});
