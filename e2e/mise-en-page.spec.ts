import { expect, test, type Page } from '@playwright/test';
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
 * Rien ne déborde de l'écran, dans les quatre thèmes, à la taille de police du système.
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
const TRACKED_EXERCISE = 'e2e-tracked';

const ROUTES = [
  '/',
  '/routines',
  '/history',
  '/analytics',
  '/exercises',
  '/settings',
  '/programs',
  '/workout',
  '/settings/appearance',
  '/settings/session',
  '/settings/coach',
  '/settings/backup',
  '/settings/app',
  '/settings/volume',
  '/analytics/measurements',
  '/analytics/measurements/waist',
  // Un nom libre long, avec des espaces et un deux-points : le titre et les lignes ne doivent
  // ni déborder ni pousser les commandes hors de l'écran.
  `/analytics/measurements/${encodeURIComponent('custom:Tour de poignet gauche, au repos')}`,
  // La page d'un exercice avec de quoi remplir chaque groupe (repères, courbe, coach, séances) et
  // la vue plein écran qui y renvoie — pas leur état vide.
  `/exercises/${TRACKED_EXERCISE}`,
  `/analytics/exercises/${TRACKED_EXERCISE}`,
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
  // Cyber monte d'un cran toutes les tailles (Rajdhani est étroite) et met les titres en capitales :
  // les deux poussent vers le débordement, d'où les trois échelles.
  { theme: 'cyber', scale: 100 },
  { theme: 'cyber', scale: 130 },
  { theme: 'cyber', scale: 200 },
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
    await seedTrackedExercise(page);
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

/**
 * Le sommaire des Réglages et ses cinq pages : toute commande qu'on touche fait au moins 48 px
 * (règle n° 5). Les sélecteurs et les interrupteurs sont inclus : c'est là qu'une cible se glisse
 * sous le seuil sans qu'une ligne entière le fasse voir.
 */
test('Réglages : chaque commande des six écrans fait au moins 48 px', async ({ page }) => {
  await openApp(page);
  const failures: string[] = [];
  for (const route of [
    '/settings',
    '/settings/appearance',
    '/settings/session',
    '/settings/coach',
    '/settings/backup',
    '/settings/app',
  ]) {
    await page.evaluate((hash) => {
      window.location.hash = `#${hash}`;
    }, route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await settleLayout(page);
    const boxes = await page
      .locator('button, [role="radio"], [role="checkbox"], [role="switch"], a')
      .evaluateAll((elements) =>
        elements
          .filter((element) => {
            const style = getComputedStyle(element);
            return style.visibility !== 'hidden' && style.display !== 'none';
          })
          .map((element) => {
            const box = element.getBoundingClientRect();
            return {
              height: box.height,
              width: box.width,
              name: (element.getAttribute('aria-label') ?? element.textContent ?? '')
                .trim()
                .replace(/\s+/g, ' ')
                .slice(0, 40),
            };
          })
          .filter((box) => box.height > 0 && box.width > 0),
      );
    // Un titre de ligne tronqué (`truncate`) est un titre qu'on ne lit pas.
    for (const clipped of await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-part="row"] .truncate')]
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map((element) => (element.textContent ?? '').trim().slice(0, 40)),
    )) {
      failures.push(`${route} — titre tronqué : « ${clipped} »`);
    }
    for (const box of boxes) {
      if (box.height < 47.5) failures.push(`${route} — « ${box.name} » : ${box.height} px`);
    }
  }
  expect(failures, failures.join('\n')).toEqual([]);
});

/**
 * Un exercice au nom long, cinq séances qui montent, trois records et une entrée du coach rattachée à
 * une séance : de quoi dessiner tous les groupes de la page d'un exercice. Même méthode que
 * `seedCompletedWorkouts` — une seconde connexion à la base, puis le rechargement du test.
 */
async function seedTrackedExercise(page: Page): Promise<void> {
  await page.evaluate(async (exerciseId) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('fittrack');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction(
      [
        'exercises',
        'workouts',
        'workoutExercises',
        'workoutSets',
        'personalRecords',
        'coachRecommendations',
      ],
      'readwrite',
    );
    const day = 86_400_000;
    const name = 'Développé couché incliné aux haltères, prise neutre';
    const stamp = (at: number) => ({ createdAt: at, updatedAt: at, deletedAt: 0 });
    const now = Date.now();

    transaction.objectStore('exercises').put({
      id: exerciseId,
      ...stamp(now),
      name,
      primaryMuscle: 'chest',
      secondaryMuscles: ['triceps', 'shoulders'],
      equipment: 'dumbbell',
      measurementType: 'weight_reps',
      isCustom: 1,
      isUnilateral: 0,
    });

    const loads = [30, 32, 34, 36, 38];
    let lastWorkoutId = '';
    loads.forEach((weight, index) => {
      const startedAt = now - (loads.length - index) * 7 * day;
      const workoutId = crypto.randomUUID();
      const rowId = crypto.randomUUID();
      lastWorkoutId = workoutId;
      transaction.objectStore('workouts').put({
        id: workoutId,
        ...stamp(startedAt),
        routineId: '',
        name: `Poussée ${index + 1}`,
        status: 'completed',
        startedAt,
        endedAt: startedAt + 3_600_000,
        durationSeconds: 3600,
      });
      transaction.objectStore('workoutExercises').put({
        id: rowId,
        ...stamp(startedAt),
        workoutId,
        exerciseId,
        order: 0,
        supersetGroup: 0,
        restSeconds: 90,
        exerciseName: name,
        exerciseMeasurementType: 'weight_reps',
      });
      for (let order = 0; order < 4; order += 1) {
        transaction.objectStore('workoutSets').put({
          id: crypto.randomUUID(),
          ...stamp(startedAt),
          workoutExerciseId: rowId,
          exerciseId,
          workoutId,
          order,
          setType: 'normal',
          side: 'both',
          weight,
          reps: 8,
          isCompleted: 1,
          performedAt: startedAt + order * 120_000,
        });
      }
    });

    const achievedAt = now - 7 * day;
    const record = (type: string, value: number, extra: object) =>
      transaction.objectStore('personalRecords').put({
        id: crypto.randomUUID(),
        ...stamp(achievedAt),
        exerciseId,
        type,
        value,
        achievedAt,
        workoutId: lastWorkoutId,
        weight: 38,
        reps: 8,
        ...extra,
      });
    record('max_weight', 38, {});
    record('best_1rm', 48.1, { formula: 'epley' });
    record('max_volume_set', 304, {});

    transaction.objectStore('coachRecommendations').put({
      id: crypto.randomUUID(),
      ...stamp(achievedAt),
      exerciseId,
      code: 'range_ceiling_reached',
      recommendedAt: achievedAt,
      nextLoadKg: 40,
      evidence: [],
      status: 'followed',
      sourceWorkoutId: lastWorkoutId,
    });

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, TRACKED_EXERCISE);
}
