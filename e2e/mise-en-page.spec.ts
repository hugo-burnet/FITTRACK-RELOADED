import { expect, test } from '@playwright/test';
import {
  createRoutineFromTemplate,
  findHorizontalOverflow,
  openApp,
  seedCompletedWorkouts,
  seedMeasurements,
  settleLayout,
  startSuggestedWorkout,
  type ThemeName,
} from './support';

/**
 * Rien ne déborde de l'écran, dans les trois thèmes, à la taille de police du système.
 *
 * La taille de police d'Android s'applique à `rem` : une cible en `size-12` (3 rem) passe de 48 à
 * 96 px à 200 %, et trois d'entre elles repoussaient le bouton d'aide hors de l'en-tête de la
 * séance. On émule ce réglage en posant la taille de la racine, ce que Chrome fait avec le
 * facteur d'échelle du système.
 *
 * **TTY1 s'arrête à 130 %.** Son texte est une police bitmap à tailles fixes (12, 16, 24, 32 px) :
 * à 200 % elle est étirée et la barre du bas ne tient plus (« Progression » et « Exercices »
 * débordent de 160 px). Un thème rétro dont le charme est la grille de pixels n'a pas de sens à
 * deux fois sa taille — consigné dans `docs/progress/decisions-et-pieges.md`, pas corrigé.
 */
const ROUTES = [
  '/',
  '/routines',
  '/history',
  '/analytics',
  '/exercises',
  '/settings',
  '/programs',
  '/workout',
  '/analytics/measurements',
  '/analytics/measurements/waist',
  // Un nom libre long, avec des espaces et un deux-points : le titre et les lignes ne doivent
  // ni déborder ni pousser les commandes hors de l'écran.
  `/analytics/measurements/${encodeURIComponent('custom:Tour de poignet gauche, au repos')}`,
] as const;

const CASES: { theme: ThemeName; scale: number }[] = [
  { theme: 'dark', scale: 100 },
  { theme: 'dark', scale: 130 },
  { theme: 'dark', scale: 200 },
  { theme: 'light', scale: 100 },
  { theme: 'light', scale: 130 },
  { theme: 'light', scale: 200 },
  { theme: 'tty1', scale: 100 },
  { theme: 'tty1', scale: 130 },
];

for (const { theme, scale } of CASES) {
  test(`thème ${theme}, police à ${scale} % : aucun écran ne déborde`, async ({ page }) => {
    await openApp(page);
    await createRoutineFromTemplate(page, /5×5 — A/);
    // Trois séances derrière soi : l'historique n'est pas vide et l'accueil porte le rappel de
    // sauvegarde — les écrans les plus chargés, pas leur état vide.
    await seedCompletedWorkouts(page, 3);
    // Deux mesures par courbe : la carte complète (échelle, dates, écart), pas son état vide.
    await seedMeasurements(page, [
      { type: 'waist', value: 84, unit: 'cm', daysAgo: 30 },
      { type: 'waist', value: 82.5, unit: 'cm', daysAgo: 2 },
      { type: 'custom:Tour de poignet gauche, au repos', value: 17, unit: 'cm', daysAgo: 20 },
      { type: 'custom:Tour de poignet gauche, au repos', value: 17.5, unit: 'cm', daysAgo: 3 },
    ]);
    // Une séance en cours : l'écran qui compte le plus, et le rideau d'ouverture TTY1 (cinq
    // secondes) saute quand une séance tourne.
    await startSuggestedWorkout(page, '5×5 — A');

    await page.evaluate((chosen) => {
      localStorage.setItem('fittrack.tty1Unlocked', '1');
      localStorage.setItem('fittrack:theme', chosen);
    }, theme);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.evaluate((percent) => {
      document.documentElement.style.fontSize = `${percent}%`;
    }, scale);

    const failures: string[] = [];
    for (const route of ROUTES) {
      await page.evaluate((hash) => {
        window.location.hash = `#${hash}`;
      }, route);
      // Un titre invisible, c'est un en-tête écrasé par des commandes trop larges : le même
      // défaut que le débordement, vu de l'autre côté.
      await expect(
        page.getByRole('heading', { level: 1 }),
        `${route} : le titre de l'écran n'est plus visible`,
      ).toBeVisible();
      await settleLayout(page);
      for (const problem of await findHorizontalOverflow(page)) {
        failures.push(`${route} — ${problem}`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });
}
