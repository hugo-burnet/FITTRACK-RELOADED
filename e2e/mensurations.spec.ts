import { expect, test, type Page } from '@playwright/test';
import { isoDaysAgo, openApp } from './support';

/**
 * Les mensurations (RF-37, RF-38) : une mesure saisie à une date passée, sa courbe, sa suppression.
 * Le checkpoint de la feuille de route — « tu saisis ton poids sur 5 dates, le graphique se
 * dessine » — dit ce que la personne fait ; ce fichier le fait dans un vrai navigateur à 390 px.
 */

/** Progression › Mensurations, par les écrans et non par l'adresse : c'est la porte d'entrée. */
async function openMeasurements(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Progression' }).click();
  await page.getByRole('button', { name: /^Mensurations/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Mensurations' })).toBeVisible();
}

/** « Ajouter une mesure » › la mesure › la valeur (et la date, si elle n'est pas aujourd'hui). */
async function addMeasurement(
  page: Page,
  options: { measure: string; value: string; date?: string },
): Promise<void> {
  await page.getByRole('button', { name: 'Ajouter une mesure' }).click();
  await page.getByRole('radio', { name: options.measure }).click();
  const sheet = page.getByRole('dialog', { name: 'Nouvelle mesure' });
  await sheet.getByLabel('Valeur').fill(options.value);
  if (options.date !== undefined) await sheet.getByLabel('Date').fill(options.date);
  await sheet.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(sheet).toBeHidden();
}

test.describe('les mensurations', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
  });

  test('une mesure rétrodatée se lit sur sa courbe, et survit à un rechargement', async ({
    page,
  }) => {
    await openMeasurements(page);
    await expect(page.getByText(/Aucune mesure pour l’instant/)).toBeVisible();

    // Un mois en arrière, puis aujourd'hui : l'ordre de saisie n'est pas l'ordre du temps.
    await addMeasurement(page, {
      measure: 'Tour de taille',
      value: '82,5',
    });
    await addMeasurement(page, {
      measure: 'Tour de taille',
      value: '84',
      date: await isoDaysAgo(page, 30),
    });

    const row = page.getByRole('button', { name: /Tour de taille/ });
    await expect(row).toContainText('82,5 cm');
    // L'écart se lit sous le nom, avec un vrai signe moins : la saisie la plus récente est la plus basse.
    await expect(row).toContainText('−1,5 cm');

    await row.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Tour de taille' })).toBeVisible();
    await expect(page.getByRole('img', { name: /Tour de taille sur 2 mesures/ })).toBeVisible();
    await expect(page.getByText(/−1,5 cm depuis le/)).toBeVisible();

    // Le trait est tracé : la courbe n'est pas un cadre vide.
    const curve = page.getByRole('img', { name: /sur 2 mesures/ }).locator('path');
    await expect(curve).toHaveCount(1);

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Tour de taille' })).toBeVisible();
    await expect(page.getByText(/−1,5 cm depuis le/)).toBeVisible();
    const history = page.getByRole('heading', { name: 'Historique' }).locator('..');
    await expect(history.getByRole('button')).toHaveCount(2);
  });

  test('corriger puis supprimer une mesure refait la courbe', async ({ page }) => {
    await openMeasurements(page);
    await addMeasurement(page, { measure: 'Tour de taille', value: '84', date: await isoDaysAgo(page, 20) });
    await addMeasurement(page, { measure: 'Tour de taille', value: '82,5' });
    await page.getByRole('button', { name: /Tour de taille/ }).click();
    const history = page.getByRole('heading', { name: 'Historique' }).locator('..');

    // Corriger : la date reste, la valeur change.
    await history.getByRole('button', { name: /84 cm/ }).click();
    await page.getByRole('button', { name: /Corriger la valeur/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Corriger la mesure' });
    await sheet.getByLabel('Valeur').fill('83,5');
    await sheet.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(sheet).toBeHidden();
    await expect(history.getByRole('button', { name: /83,5 cm/ })).toBeVisible();
    await expect(page.getByText(/−1 cm depuis le/)).toBeVisible();

    // Supprimer : une confirmation d'abord, puis une seule mesure et plus de courbe à comparer.
    await history.getByRole('button', { name: /83,5 cm/ }).click();
    await page.getByRole('button', { name: /Supprimer cette mesure/ }).click();
    const confirm = page.getByRole('dialog', { name: 'Supprimer cette mesure ?' });
    await expect(confirm).toContainText('83,5 cm');
    await confirm.getByRole('button', { name: 'Supprimer', exact: true }).click();

    await expect(history.getByRole('button')).toHaveCount(1);
    await expect(page.getByText(/Une seule mesure sur cette période/)).toBeVisible();
  });

  test('le poids de l’accueil et celui des mensurations sont la même mesure', async ({ page }) => {
    await page.getByRole('button', { name: 'Renseigner le poids du jour' }).click();
    const home = page.getByRole('dialog', { name: 'Poids du jour' });
    await home.getByLabel('Poids du corps').fill('82,4');
    await home.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(home).toBeHidden();

    await openMeasurements(page);
    const row = page.getByRole('button', { name: /Poids de corps/ });
    await expect(row).toContainText('82,4 kg');

    // Une pesée oubliée, saisie après coup : la plus récente reste celle de l'accueil.
    await addMeasurement(page, {
      measure: 'Poids de corps',
      value: '84,1',
      date: await isoDaysAgo(page, 12),
    });
    await expect(row).toContainText('82,4 kg');
    await expect(row).toContainText('−1,7 kg');

    // Et l'accueil n'a pas bougé : sa tuile lit toujours la dernière pesée.
    await page.getByRole('link', { name: 'Accueil' }).click();
    await expect(page.getByRole('button', { name: 'Renseigner le poids du jour' })).toContainText(
      '82,4',
    );
  });

  test('la feuille du poids, à l’accueil, mène à sa courbe', async ({ page }) => {
    await page.getByRole('button', { name: 'Renseigner le poids du jour' }).click();
    const sheet = page.getByRole('dialog', { name: 'Poids du jour' });
    // Pas de pesée, pas de courbe à proposer : le lien ouvrirait une page vide.
    await expect(sheet.getByRole('button', { name: 'Voir la courbe et l’historique' })).toHaveCount(0);

    await sheet.getByLabel('Poids du corps').fill('82,4');
    await sheet.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(sheet).toBeHidden();

    await page.getByRole('button', { name: 'Renseigner le poids du jour' }).click();
    await sheet.getByRole('button', { name: 'Voir la courbe et l’historique' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Poids de corps' })).toBeVisible();
    // Le titre de la section, pas le mot de la barre du bas qui s'écrit pareil.
    await expect(page.getByRole('heading', { name: 'Historique' })).toBeVisible();
  });

  test('refuse une faute de frappe et un jour à venir, en disant pourquoi', async ({ page }) => {
    await openMeasurements(page);
    await page.getByRole('button', { name: 'Ajouter une mesure' }).click();
    await page.getByRole('radio', { name: 'Tour de taille' }).click();
    const sheet = page.getByRole('dialog', { name: 'Nouvelle mesure' });
    const save = sheet.getByRole('button', { name: 'Enregistrer' });

    await sheet.getByLabel('Valeur').fill('825');
    await expect(sheet.getByText(/ne semble pas juste/)).toBeVisible();
    await expect(save).toBeDisabled();

    await sheet.getByLabel('Valeur').fill('82,5');
    await expect(save).toBeEnabled();
    await sheet.getByLabel('Date').fill('2999-01-01');
    await expect(sheet.getByText('Choisis un jour qui n’est pas dans le futur.')).toBeVisible();
    await expect(save).toBeDisabled();
  });

  test('un champ libre garde son nom et son unité', async ({ page }) => {
    await openMeasurements(page);
    await page.getByRole('button', { name: 'Ajouter une mesure' }).click();
    await page.getByRole('radio', { name: 'Autre mesure…' }).click();
    const sheet = page.getByRole('dialog', { name: 'Nouvelle mesure' });

    await sheet.getByLabel('Nom de la mesure').fill('Tour de poignet');
    await sheet.getByLabel('Valeur').fill('17,5');
    await sheet.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(sheet).toBeHidden();

    const row = page.getByRole('button', { name: /Tour de poignet/ });
    await expect(row).toContainText('17,5 cm');
    await row.click();
    await expect(page.getByRole('heading', { level: 1, name: 'Tour de poignet' })).toBeVisible();
  });

  test('les commandes de saisie font au moins 48 px', async ({ page }) => {
    await openMeasurements(page);
    const add = await page.getByRole('button', { name: 'Ajouter une mesure' }).boundingBox();
    expect(add!.height).toBeGreaterThanOrEqual(47.5);

    await page.getByRole('button', { name: 'Ajouter une mesure' }).click();
    await page.getByRole('radio', { name: 'Tour de taille' }).click();
    const sheet = page.getByRole('dialog', { name: 'Nouvelle mesure' });
    for (const control of [
      sheet.getByLabel('Valeur'),
      sheet.getByLabel('Date'),
      sheet.getByRole('button', { name: 'Enregistrer' }),
    ]) {
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(47.5);
    }
  });
});
