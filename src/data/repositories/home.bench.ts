/**
 * Ce que coûte l'accueil sur une grosse base.
 *
 * L'accueil est l'écran le plus souvent ouvert de l'app et le seul que le banc
 * d'essai ne regardait pas. Il lit **toutes** les séances terminées pour en
 * afficher trois, et il relit les trois tables de routines en entier ; la
 * question à laquelle ce fichier répond est de savoir si ça se voit.
 *
 * Les routines sont semées ici et pas dans `largeHistory` : sans elles
 * `pickSuggestedRoutine` sort sur `candidates.length === 0` sans rien parcourir,
 * et le banc mesurerait un accueil qui ne fait pas son travail. Même raison pour
 * l'objectif hebdomadaire — sans objectif, `calculateWeeklyRegularity` rend une
 * série nulle sans dérouler sa boucle.
 */

import { beforeAll, bench } from 'vitest';
import { db } from '@/data/db';
import { buildWorkoutSummaries, listCompletedWorkouts } from '@/data/repositories/history';
import { getHomeDashboard } from '@/data/repositories/home';
import { listRoutineSummaries } from '@/data/repositories/routines';
import { setWeeklyTrainingGoal } from '@/data/repositories/settings';
import {
  calculateWeeklyRegularity,
  type WeeklyTrainingGoal,
} from '@/lib/history';
import {
  pickSuggestedRoutine,
  type SuggestionCandidate,
  type SuggestionWorkout,
} from '@/lib/home';
import type {
  Routine,
  RoutineExercise,
  RoutineSet,
  Syncable,
  Workout,
} from '@/data/types';
import { LARGE_HISTORY_PROFILE, seedLargeHistory } from '@/test/largeHistory';
import { resetDb } from '@/test/resetDb';

/** Ce qu'une bibliothèque de routines bien remplie ressemble. */
const ROUTINE_COUNT = 8;
const EXERCISES_PER_ROUTINE = 8;
const SETS_PER_ROUTINE_EXERCISE = 4;
/** Sous les ~4,7 séances/semaine de la fixture : la série remonte donc loin. */
const WEEKLY_GOAL = 3;

// Plus large que le banc de l'Historique : le semis coûte ~95 s à lui seul, une
// itération de plus est gratuite en comparaison, et à 3 échantillons la marge
// d'erreur dépassait 60 % — de quoi conclure n'importe quoi.
const OPTIONS = {
  iterations: 15,
  time: 0,
  warmupIterations: 3,
  warmupTime: 0,
};

const pad = (value: number): string => value.toString().padStart(5, '0');

function syncable(id: string, at: number): Syncable {
  return { id, createdAt: at, updatedAt: at, deletedAt: 0 };
}

async function seedRoutines(at: number): Promise<void> {
  const routines: Routine[] = [];
  const rows: RoutineExercise[] = [];
  const sets: RoutineSet[] = [];

  for (let routineIndex = 0; routineIndex < ROUTINE_COUNT; routineIndex += 1) {
    const routineId = `bench-routine-${pad(routineIndex)}`;
    routines.push({
      ...syncable(routineId, at),
      name: `Benchmark routine ${routineIndex + 1}`,
      folderId: '',
      order: routineIndex,
      version: 1,
    });

    for (let rowIndex = 0; rowIndex < EXERCISES_PER_ROUTINE; rowIndex += 1) {
      const rowId = `bench-routine-row-${pad(routineIndex)}-${pad(rowIndex)}`;
      rows.push({
        ...syncable(rowId, at),
        routineId,
        exerciseId: `large-exercise-${pad(rowIndex)}`,
        order: rowIndex,
        supersetGroup: 0,
        restSeconds: 120,
      });

      for (let setIndex = 0; setIndex < SETS_PER_ROUTINE_EXERCISE; setIndex += 1) {
        sets.push({
          ...syncable(
            `bench-routine-set-${pad(routineIndex)}-${pad(rowIndex)}-${pad(setIndex)}`,
            at,
          ),
          routineExerciseId: rowId,
          order: setIndex,
          setType: 'normal',
          targetReps: 10,
          targetWeight: 40,
        });
      }
    }
  }

  await db.transaction('rw', db.routines, db.routineExercises, db.routineSets, async () => {
    await db.routines.bulkAdd(routines);
    await db.routineExercises.bulkAdd(rows);
    await db.routineSets.bulkAdd(sets);
  });
}

/**
 * Rattache les 2 000 séances aux routines, à tour de rôle.
 *
 * Le tour de rôle est le cas favorable à la suggestion : chaque routine a une
 * date récente, donc un futur parcours arrière avec arrêt anticipé s'arrêterait
 * vite. Mesurer là-dessus évite de se donner raison avec une fixture complaisante.
 */
async function attachWorkoutsToRoutines(): Promise<void> {
  let index = 0;
  await db.workouts.toCollection().modify((workout) => {
    workout.routineId = `bench-routine-${pad(index % ROUTINE_COUNT)}`;
    index += 1;
  });
}

let timestamps: number[] = [];
let goalHistory: WeeklyTrainingGoal[] = [];
let now = 0;
let candidates: SuggestionCandidate[] = [];
let suggestionWorkouts: SuggestionWorkout[] = [];
let recentWorkouts: Workout[] = [];

beforeAll(async () => {
  await resetDb();
  const counts = await seedLargeHistory(LARGE_HISTORY_PROFILE);
  await seedRoutines(LARGE_HISTORY_PROFILE.startedAt);
  await attachWorkoutsToRoutines();
  goalHistory = await setWeeklyTrainingGoal(WEEKLY_GOAL);

  const startedAt = performance.now();
  const dashboard = await getHomeDashboard();
  const elapsedMs = performance.now() - startedAt;

  timestamps = dashboard.completedWorkoutTimestamps;
  now = Math.max(...timestamps);

  // Les mêmes entrées que celles que `getHomeDashboard` fabrique, relues une
  // fois pour pouvoir mesurer la suggestion sans la lecture qui la précède.
  candidates = (await listRoutineSummaries()).map(({ routine }) => ({
    routineId: routine.id,
    name: routine.name,
    order: routine.order,
  }));
  const completed = await listCompletedWorkouts();
  suggestionWorkouts = completed.map(({ routineId, name, startedAt }) => ({
    routineId,
    name,
    startedAt,
  }));
  recentWorkouts = completed.slice(0, 3);

  if (dashboard.suggestedRoutine === null || dashboard.recentWorkouts.length !== 3) {
    throw new Error(
      `Home dashboard did not do its work: ${JSON.stringify({
        suggested: dashboard.suggestedRoutine,
        recent: dashboard.recentWorkouts.length,
      })}`,
    );
  }

  const regularity = calculateWeeklyRegularity(timestamps, goalHistory, now);

  console.info(
    `home dashboard: ${elapsedMs.toFixed(1)} ms for ${counts.workouts} workouts ` +
      `→ ${timestamps.length} timestamps loaded, ${dashboard.recentWorkouts.length} rendered, ` +
      `${dashboard.routineCount} routines, streak ${regularity.streak} weeks`,
  );
}, 360_000);

bench(
  'home dashboard read from 2,000 workouts',
  async () => {
    await getHomeDashboard();
  },
  OPTIONS,
);

// La lecture non bornée, isolée : 2 000 lignes chargées et triées pour en
// afficher 3. C'est le chiffre qui décide si l'index composé vaut sa migration.
bench(
  'all completed workouts alone (unbounded read)',
  async () => {
    await listCompletedWorkouts();
  },
  OPTIONS,
);

// Les compteurs des 3 lignes affichées : `anyOf` sur 3 identifiants, mais dans
// des tables de 16 000 et 64 000 lignes. Le reste du tableau ne l'explique pas.
bench(
  'summaries for the 3 rendered rows',
  async () => {
    await buildWorkoutSummaries(recentWorkouts);
  },
  OPTIONS,
);

bench(
  'routine summaries alone (three full table scans)',
  async () => {
    await listRoutineSummaries();
  },
  OPTIONS,
);

// La part que le rendu rejouait : pure, sans base, donc c'est exactement le coût
// qu'un `useMemo` sur l'accueil supprime à chaque rendu qui ne change rien.
bench(
  'weekly regularity over 2,000 timestamps',
  () => {
    calculateWeeklyRegularity(timestamps, goalHistory, now);
  },
  OPTIONS,
);

// L'autre parcours complet, celui qu'aucun index ne peut borner : c'est lui qui
// décide entre l'arrêt anticipé et un `lastPerformedAt` dénormalisé.
bench(
  'suggested routine over 2,000 workouts',
  () => {
    pickSuggestedRoutine(candidates, suggestionWorkouts);
  },
  OPTIONS,
);
