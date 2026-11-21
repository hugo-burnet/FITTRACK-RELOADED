import { expect, test } from '@playwright/test';
import { openApp } from './support';

test.describe('une séance libre, sans routine', () => {
  test('de l’accueil vide à l’historique, sans rien perdre', async ({ page }) => {
    await openApp(page);

    // Premier jour : aucune routine, et pourtant un verbe à l'accueil.
    await page.getByRole('button', { name: 'Séance libre' }).click();
    await expect(page).toHaveURL(/#\/workout$/);

    await page.getByRole('button', { name: 'Ajouter un exercice' }).click();
    await expect(page).toHaveURL(/#\/workout\/add$/);
    await page.getByRole('checkbox', { name: /Développé couché \(barre\)/ }).first().click();
    await page.getByRole('button', { name: /^Ajouter/ }).last().click();
    await expect(page).toHaveURL(/#\/workout$/);

    await page.getByRole('textbox', { name: 'Série 1 — kg' }).fill('60');
    await page.getByRole('textbox', { name: 'Série 1 — reps' }).fill('8');
    await page.getByRole('button', { name: 'Valider la série 1' }).click();
    // La série validée ouvre le repos : elle est écrite en base.
    await expect(page.getByText(/^Repos \d+:\d\d$/)).toBeVisible();

    await page.getByRole('button', { name: 'Terminer la séance' }).click();
    await expect(page).toHaveURL(/#\/workout\/finish$/);
    await page.getByRole('button', { name: 'Enregistrer la séance' }).click();

    await page.getByRole('link', { name: 'Historique' }).click();
    await expect(page.getByText('Séance libre').first()).toBeVisible();
  });

  test('« Créer une routine » ouvre la feuille de création, pas la liste', async ({ page }) => {
    await openApp(page);

    await page.getByRole('button', { name: 'Créer une routine' }).click();

    await expect(page).toHaveURL(/#\/routines$/);
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Partir d’un modèle', exact: true })).toBeVisible();
  });
});
