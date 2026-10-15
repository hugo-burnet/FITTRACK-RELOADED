import { expect, test } from '@playwright/test';
import {
  createRoutineFromTemplate,
  findHorizontalOverflow,
  openApp,
  settleLayout,
  startSuggestedWorkout,
} from './support';

/**
 * Le benchmark, d'une routine à la séance suivante : une série à l'échec par exercice, le bilan,
 * la charge écrite dans la routine — et la preuve que la série menée à l'échec ne devient pas la
 * « dernière fois » de la séance d'après.
 *
 * Une séance « 5×5 — A » : squat, développé couché, rowing. On ne fait que le squat : les exercices
 * sans série validée sont écartés à l'enregistrement, comme dans toute séance.
 */
test.describe('benchmark', () => {
  test('d’une routine au bilan, puis à la séance suivante', async ({ page }) => {
    await openApp(page);
    await createRoutineFromTemplate(page, /5×5 — A/);

    // Le menu de la routine, puis ce que le benchmark demande — rien n'est lancé avant de l'avoir lu.
    await page.getByRole('link', { name: 'Planifier' }).click();
    await page.getByRole('button', { name: 'Routine — 5×5 — A' }).click();
    await page.getByRole('button', { name: /Benchmark de cette routine/ }).click();
    await expect(page.getByText(/Une seule série par exercice, menée jusqu’à l’échec/)).toBeVisible();
    await expect(page).toHaveURL(/#\/routines$/);
    await page.getByRole('button', { name: 'Lancer le benchmark' }).click();

    // Trois exercices, une série chacun ; aucune répétition visée — on va au bout.
    await expect(page).toHaveURL(/#\/workout$/);
    await expect(page.getByText(/une série à l’échec par exercice/)).toBeVisible();
    await expect(page.getByText('0 série sur 3')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Série 2 — kg' })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Série 1 — reps' })).toHaveAttribute(
      'placeholder',
      '',
    );

    // Sans répétitions la coche reste fermée : un maximum sans son nombre n'est pas un maximum.
    await page.getByRole('textbox', { name: 'Série 1 — kg' }).fill('100');
    await expect(page.getByRole('button', { name: 'Valider la série 1' })).toBeDisabled();
    await page.getByRole('textbox', { name: 'Série 1 — reps' }).fill('9');
    await page.getByRole('button', { name: 'Valider la série 1' }).click();
    await expect(page.getByText('1 série sur 3')).toBeVisible();

    await page.getByRole('button', { name: 'Terminer la séance' }).click();
    await expect(page.getByText(/C’est un benchmark/)).toBeVisible();
    // Pas de carte du coach : un maximum n'est pas une séance de travail à juger.
    await expect(page.getByRole('article', { name: 'Coach' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Enregistrer la séance' }).click();

    // Le bilan : 100 kg × 9 est un 1RM de 130 kg (Epley) ; avec deux répétitions en réserve au bas
    // d'une fourchette de 5, la charge de travail est celle de 7 répétitions, soit 105 kg.
    await expect(page).toHaveURL(/#\/benchmark\/[^/]+$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Bilan du benchmark' })).toBeVisible();
    const squat = page.getByRole('region', { name: 'Squat (barre, nuque)' });
    await expect(squat).toContainText('Fourchette de la routine : 5 reps');
    await expect(squat).toContainText('Fait : 9 reps · 100 kg');
    await expect(squat).toContainText('1RM estimé : 130 kg');
    await expect(squat).toContainText('Charge de travail conseillée : 105 kg');
    await expect(squat).toContainText('Aucune charge dans la routine.');
    // Les exercices qu'on n'a pas faits n'y figurent pas.
    await expect(page.getByRole('region', { name: /Développé couché/ })).toHaveCount(0);

    // Les commandes du bilan se touchent d'une main, et rien ne déborde — même à 200 % de police.
    const apply = page.getByRole('button', { name: 'Appliquer à la routine · 1' });
    const toggle = squat.getByRole('switch');
    for (const control of [apply, toggle, page.getByRole('button', { name: 'Retour' })]) {
      const box = await control.boundingBox();
      expect(box, 'la commande doit être à l’écran').not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(47.5);
    }
    for (const percent of [100, 200]) {
      await page.evaluate((value) => {
        document.documentElement.style.fontSize = `${value}%`;
      }, percent);
      await settleLayout(page);
      expect(await findHorizontalOverflow(page), `police à ${percent} %`).toEqual([]);
    }
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '';
    });

    // Appliquer écrit la routine ; le bilan se relit et n'a plus rien à proposer.
    await apply.click();
    await expect(page.getByText('1 exercice mis à jour dans la routine.')).toBeVisible();
    await expect(squat).toContainText('La routine est déjà à ce niveau.');
    await expect(squat.getByRole('switch')).toHaveCount(0);
    await page.getByRole('button', { name: 'Terminé' }).click();
    await expect(page).toHaveURL(/#\/$/);

    // La séance suivante part de la charge calibrée — et non des 100 kg du benchmark, qui n'est
    // pas « la dernière fois » : une série à l'échec n'est pas un modèle de série de travail.
    await startSuggestedWorkout(page, '5×5 — A');
    await expect(page.getByText(/une série à l’échec par exercice/)).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'Série 1 — kg' })).toHaveAttribute(
      'placeholder',
      '105',
    );
    // La colonne « Précédent » est vide : sans cela, un appui y reprendrait « 9 reps · 100 kg »,
    // le maximum d'un autre jour, comme la série d'hier.
    await expect(page.getByRole('button', { name: 'Précédent' }).first()).toBeDisabled();
  });

  test('il se lance aussi depuis l’éditeur de la routine, et survit à un rechargement (règle n° 4)', async ({
    page,
  }) => {
    await openApp(page);
    // Partir d'un modèle ouvre l'éditeur de la routine qu'on vient de créer : c'est là qu'on la
    // regarde, et la porte du benchmark y est visible, sans passer par le menu ⋮ de la liste.
    await page.getByRole('link', { name: 'Planifier' }).click();
    await page.getByRole('button', { name: 'Partir d’un modèle' }).click();
    await page.getByRole('button', { name: /5×5 — A/ }).click();
    await expect(page).toHaveURL(/#\/routines\/[^/]+$/);

    const door = page.getByRole('button', { name: /Benchmark de cette routine/ });
    await expect(door).toBeVisible();
    const box = await door.boundingBox();
    expect(box, 'la porte doit être à l’écran').not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(47.5);
    for (const percent of [100, 200]) {
      await page.evaluate((value) => {
        document.documentElement.style.fontSize = `${value}%`;
      }, percent);
      await settleLayout(page);
      expect(await findHorizontalOverflow(page), `police à ${percent} %`).toEqual([]);
    }
    await page.evaluate(() => {
      document.documentElement.style.fontSize = '';
    });

    await door.click();
    await expect(page.getByText(/Une seule série par exercice, menée jusqu’à l’échec/)).toBeVisible();
    await page.getByRole('button', { name: 'Lancer le benchmark' }).click();
    await expect(page).toHaveURL(/#\/workout$/);
    await page.getByRole('textbox', { name: 'Série 1 — kg' }).fill('100');
    await page.getByRole('textbox', { name: 'Série 1 — reps' }).fill('9');
    await page.getByRole('button', { name: 'Valider la série 1' }).click();
    await expect(page.getByText('1 série sur 3')).toBeVisible();

    await page.reload();

    await expect(page).toHaveURL(/#\/workout$/);
    await expect(page.getByText(/une série à l’échec par exercice/)).toBeVisible();
    await expect(page.getByText('1 série sur 3')).toBeVisible();
    // Le squat s'est replié sur sa série faite, et le développé couché s'est ouvert à sa place :
    // on rouvre le squat — le premier exercice — pour relire ce qui a été écrit.
    await page.getByRole('button', { name: /^Squat \(barre, nuque\)/ }).first().click();
    await expect(page.getByRole('textbox', { name: 'Série 1 — kg' }).first()).toHaveValue('100');
    await expect(page.getByRole('textbox', { name: 'Série 1 — reps' }).first()).toHaveValue('9');
  });

  test('avec un historique : la coche attend les répétitions, puis le coach lit le benchmark', async ({
    page,
  }) => {
    await openApp(page);
    await createRoutineFromTemplate(page, /5×5 — A/);

    // Une première séance ordinaire : 100 kg, cinq répétitions proposées par la routine. C'est la
    // « dernière fois » du squat, et c'est elle que la coche reprendrait pour le maximum.
    await startSuggestedWorkout(page, '5×5 — A');
    await page.getByRole('textbox', { name: 'Série 1 — kg' }).fill('100');
    await page.getByRole('button', { name: 'Valider la série 1' }).click();
    await expect(page.getByText('1 série sur 15')).toBeVisible();
    await page.getByRole('button', { name: 'Terminer la séance' }).click();
    await page.getByRole('button', { name: 'Enregistrer la séance' }).click();
    await expect(page).toHaveURL(/#\/$/);

    await page.getByRole('link', { name: 'Planifier' }).click();
    await page.getByRole('button', { name: 'Routine — 5×5 — A' }).click();
    await page.getByRole('button', { name: /Benchmark de cette routine/ }).click();
    await page.getByRole('button', { name: 'Lancer le benchmark' }).click();
    await expect(page).toHaveURL(/#\/workout$/);

    // « Précédent » offre la dernière fois, mais rien ne la valide à la place du maximum.
    await expect(page.getByRole('button', { name: 'Précédent' }).first()).toBeEnabled();
    await page.getByRole('textbox', { name: 'Série 1 — kg' }).fill('100');
    await expect(page.getByRole('textbox', { name: 'Série 1 — reps' })).toHaveAttribute('placeholder', '');
    await expect(page.getByRole('button', { name: 'Valider la série 1' })).toBeDisabled();
    await page.getByRole('textbox', { name: 'Série 1 — reps' }).fill('9');
    await page.getByRole('button', { name: 'Valider la série 1' }).click();
    await expect(page.getByText('1 série sur 3')).toBeVisible();

    await page.getByRole('button', { name: 'Terminer la séance' }).click();
    await page.getByRole('button', { name: 'Enregistrer la séance' }).click();
    await expect(page).toHaveURL(/#\/benchmark\/[^/]+$/);
    const squat = page.getByRole('region', { name: 'Squat (barre, nuque)' });
    await expect(squat).toContainText('Fait : 9 reps · 100 kg');

    // On n'écrit rien dans la routine : le coach, lui, a lu le benchmark.
    await squat.getByRole('switch').click();
    await page.getByRole('button', { name: 'Terminé' }).click();
    await expect(page).toHaveURL(/#\/$/);

    await startSuggestedWorkout(page, '5×5 — A');
    const coach = page.getByRole('article', { name: 'Coach' }).first();
    await expect(coach).toContainText(
      'Benchmark : 9 répétitions à 100 kg, soit un max d’environ 130 kg. Pour ta fourchette (5 reps), démarre à 105 kg.',
    );
    // Un geste écrit la charge sur les séries restantes, comme tout objectif du coach.
    await coach.getByRole('button', { name: 'Appliquer 105 kg' }).click();
    await expect(page.getByRole('textbox', { name: 'Série 2 — kg' })).toHaveAttribute('placeholder', '105');
  });
});
