import { expect, test, type Page } from '@playwright/test';
import { openApp, seedMuscleSessions } from './support';

/**
 * Le volume par muscle (R6) : poser un plancher, voir la carte de l'accueil quand un muscle est dessous
 * deux semaines complètes de suite, la faire taire en retirant le plancher.
 *
 * L'historique est écrit directement dans la base — six semaines de dos, et deux semaines d'ischios sous
 * un plancher de huit — pour ne tester que ce que la personne voit.
 */

async function seedHistory(page: Page): Promise<void> {
  await seedMuscleSessions(page, [
    ...[6, 5, 4, 3, 2, 1].map((weeksAgo) => ({ weeksAgo, muscle: 'lats', sets: 6 })),
    { weeksAgo: 2, muscle: 'hamstrings', sets: 3 },
    { weeksAgo: 1, muscle: 'hamstrings', sets: 4 },
  ]);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

/** Réglages › Volume par muscle, par les écrans et non par l'adresse : c'est la porte d'entrée. */
async function openVolume(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Réglages' }).click();
  await page.getByRole('button', { name: /Volume par muscle/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Volume par muscle' })).toBeVisible();
}

test.describe('le volume par muscle', () => {
  test.beforeEach(async ({ page }) => {
    await openApp(page);
    await seedHistory(page);
  });

  test('un plancher posé fait parler l’accueil, le retirer le fait taire', async ({ page }) => {
    // Sans plancher posé, l'app ne dit rien : trois séries d'ischios, c'est peut-être un choix.
    await expect(page.getByRole('heading', { name: 'Volume bas' })).toHaveCount(0);

    await openVolume(page);
    const hamstrings = page.getByRole('button', { name: /^Ischio-jambiers/ });
    await expect(hamstrings).toContainText('Plancher —');
    await expect(page.getByRole('button', { name: /^Grand dorsal/ })).toContainText('max 6');

    await hamstrings.click();
    const sheet = page.getByRole('dialog', { name: 'Ischio-jambiers' });
    await sheet.getByRole('textbox', { name: 'Plancher' }).fill('8');
    await sheet.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(sheet).toBeHidden();
    await expect(hamstrings).toContainText('Plancher 8');

    await page.getByRole('link', { name: 'Accueil' }).click();
    const card = page.getByRole('region', { name: 'Volume bas' });
    await expect(card).toContainText('Ischio-jambiers : 3 puis 4 séries — ton plancher est 8.');

    // « Régler » ramène aux bornes ; « Aucun plancher » les retire, et la carte s'en va.
    await card.getByRole('button', { name: 'Régler' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Volume par muscle' })).toBeVisible();
    await page.getByRole('button', { name: /^Ischio-jambiers/ }).click();
    const again = page.getByRole('dialog', { name: 'Ischio-jambiers' });
    await again.getByRole('button', { name: 'Aucun plancher' }).click();
    await again.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(again).toBeHidden();

    await page.getByRole('link', { name: 'Accueil' }).click();
    await expect(page.getByRole('heading', { name: 'Volume bas' })).toHaveCount(0);
  });

  test('un plancher tenu ne dit rien, et les bornes survivent à un rechargement', async ({ page }) => {
    await openVolume(page);
    await page.getByRole('button', { name: /^Grand dorsal/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Grand dorsal' });
    await sheet.getByRole('textbox', { name: 'Plancher' }).fill('6');
    await sheet.getByRole('textbox', { name: 'Plafond' }).fill('9');
    await sheet.getByRole('button', { name: 'Enregistrer' }).click();
    await expect(sheet).toBeHidden();

    await page.reload();
    await expect(page.getByRole('button', { name: /^Grand dorsal/ })).toContainText('Plancher 6');
    await expect(page.getByRole('button', { name: /^Grand dorsal/ })).toContainText('Plafond 9');
    await page.getByRole('link', { name: 'Accueil' }).click();
    // Six séries par semaine pour un plancher de six : être au plancher, ce n'est pas être dessous.
    await expect(page.getByRole('heading', { name: 'Volume bas' })).toHaveCount(0);
  });

  test('refuse un plancher au-dessus du plafond, en disant pourquoi', async ({ page }) => {
    await openVolume(page);
    await page.getByRole('button', { name: /^Pectoraux/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Pectoraux' });

    await sheet.getByRole('textbox', { name: 'Plancher' }).fill('12');
    await sheet.getByRole('textbox', { name: 'Plafond' }).fill('8');

    await expect(sheet.getByText('Le plancher ne peut pas dépasser le plafond.')).toBeVisible();
    await expect(sheet.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  });

  test('les commandes des bornes font au moins 48 px', async ({ page }) => {
    await openVolume(page);
    await page.getByRole('button', { name: /^Pectoraux/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Pectoraux' });

    for (const control of [
      sheet.getByRole('textbox', { name: 'Plancher' }),
      sheet.getByRole('textbox', { name: 'Plafond' }),
      sheet.getByRole('button', { name: 'Aucun plancher' }),
      sheet.getByRole('button', { name: /^Plafond automatique/ }),
      sheet.getByRole('button', { name: 'Enregistrer' }),
    ]) {
      const box = await control.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(47.5);
    }
  });
});
