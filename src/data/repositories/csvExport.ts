import { db } from '@/data/db';
import type { Exercise, Routine, WorkoutExercise, WorkoutSet } from '@/data/types';
import { t } from '@/i18n/fr';
import { resolveExerciseIdentity } from '@/lib/exerciseSnapshot';
import {
  serializeWorkoutsCsv,
  type CsvExportExercise,
  type CsvExportWorkout,
} from '@/lib/hevyCsvExport';
import { localOffsetMinutes } from '@/lib/timezone';
import { alive } from './base';

/**
 * L'export CSV de l'historique — le fichier que l'import de l'app relit.
 *
 * Un seul format pour sortir **et** rentrer : ce que FitTrack écrit, son propre
 * import le reprend (cf. `csvRoundTrip.test.ts`), et un outil qui lit du Hevy le
 * lit aussi. C'est la sauvegarde qu'on emporte sur son PC, pas seulement un
 * tableau à regarder.
 *
 * Ce qui n'y est pas, et ne peut pas y être : une routine **jamais réalisée**
 * (le format décrit des séances, elle n'en a aucune), les réglages, et les
 * secondes des horaires — le format de Hevy s'arrête à la minute.
 */

/** Le nom d'un fichier daté : `fittrack-2026-08-02.csv`. */
export function csvExportFileName(at: number): string {
  const local = new Date(at - new Date(at).getTimezoneOffset() * 60_000);
  return `fittrack-${local.toISOString().slice(0, 10)}.csv`;
}

const byOrder = <T extends { order: number }>(left: T, right: T): number =>
  left.order - right.order;

function exerciseOf(
  row: WorkoutExercise,
  library: ReadonlyMap<string, Exercise>,
  sets: readonly WorkoutSet[],
): CsvExportExercise {
  const identity = resolveExerciseIdentity(row, library.get(row.exerciseId));
  return {
    title: identity.name ?? t('workout.deletedExercise'),
    supersetGroup: row.supersetGroup,
    ...(row.notes === undefined ? {} : { notes: row.notes }),
    restSeconds: row.restSeconds,
    // Un exercice dont ni le relevé ni la bibliothèque ne disent plus rien :
    // les valeurs par défaut du modèle, pour que la ligne reste relisible.
    measurementType: identity.measurementType ?? 'weight_reps',
    equipment: identity.equipment ?? 'other',
    sets: [...sets].sort(byOrder).map((set) => ({
      order: set.order,
      setType: set.setType,
      side: set.side,
      ...(set.weight === undefined ? {} : { weight: set.weight }),
      ...(set.reps === undefined ? {} : { reps: set.reps }),
      ...(set.durationSeconds === undefined
        ? {}
        : { durationSeconds: set.durationSeconds }),
      ...(set.distanceMeters === undefined
        ? {}
        : { distanceMeters: set.distanceMeters }),
      ...(set.rpe === undefined ? {} : { rpe: set.rpe }),
    })),
  };
}

export async function buildCsvExport(): Promise<string> {
  const workouts = alive(
    await db.workouts.where('status').equals('completed').toArray(),
  ).sort((left, right) => left.startedAt - right.startedAt || left.id.localeCompare(right.id));
  if (workouts.length === 0) return serializeWorkoutsCsv([]);

  const workoutIds = workouts.map((workout) => workout.id);
  const [rows, sets, routines] = await Promise.all([
    db.workoutExercises.where('workoutId').anyOf(workoutIds).toArray(),
    db.workoutSets.where('workoutId').anyOf(workoutIds).toArray(),
    db.routines.bulkGet([
      ...new Set(workouts.map((workout) => workout.routineId).filter((id) => id !== '')),
    ]),
  ]);

  const found = await db.exercises.bulkGet([
    ...new Set(rows.map((row) => row.exerciseId)),
  ]);
  const library = new Map<string, Exercise>(
    found.flatMap((exercise) => (exercise === undefined ? [] : [[exercise.id, exercise]])),
  );
  // Une routine supprimée garde son nom ici : la séance en vient bel et bien, et
  // c'est ce qui permet à l'import de la reconstruire — dans le dossier
  // d'archive si plus personne ne la fait.
  const routinesById = new Map<string, Routine>(
    routines.flatMap((routine) => (routine === undefined ? [] : [[routine.id, routine]])),
  );

  const rowsPerWorkout = new Map<string, WorkoutExercise[]>();
  for (const row of alive(rows)) {
    rowsPerWorkout.set(row.workoutId, [...(rowsPerWorkout.get(row.workoutId) ?? []), row]);
  }
  const setsPerRow = new Map<string, WorkoutSet[]>();
  for (const set of alive(sets)) {
    // Seules les séries validées : une case laissée vide en séance n'a jamais
    // été soulevée, elle n'a rien à faire dans un historique.
    if (set.isCompleted !== 1) continue;
    setsPerRow.set(set.workoutExerciseId, [
      ...(setsPerRow.get(set.workoutExerciseId) ?? []),
      set,
    ]);
  }

  const exported: CsvExportWorkout[] = workouts.map((workout) => ({
    title: workout.name === '' ? t('workout.emptyName') : workout.name,
    ...(routinesById.get(workout.routineId) === undefined
      ? {}
      : { routineName: routinesById.get(workout.routineId)!.name }),
    startedAt: workout.startedAt,
    // Une séance terminée a toujours une fin ; la durée sert de filet pour les
    // lignes anciennes ou réparées à la main.
    endedAt:
      workout.endedAt > workout.startedAt
        ? workout.endedAt
        : workout.startedAt + workout.durationSeconds * 1000,
    /*
     * Le fuseau de l'appareil **aujourd'hui**, et non celui que la séance a
     * gardé (`startedTimezoneOffsetMinutes`).
     *
     * Le format n'écrit qu'une heure murale, et l'import la relit dans le
     * fuseau de l'appareil : écrire l'heure d'une séance faite à l'étranger la
     * ferait revenir décalée de la différence entre les deux fuseaux. Entre
     * conserver l'instant et conserver l'heure affichée, une sauvegarde
     * conserve l'instant — d'autant que l'import réécrit de toute façon
     * l'offset avec celui de l'appareil, donc l'heure affichée bougerait aussi.
     *
     * Sur un téléphone qui n'a pas voyagé — le cas normal — les deux sont la
     * même valeur, changements d'heure d'été compris : `localOffsetMinutes` est
     * lu à l'instant de la séance, pas à celui de l'export.
     */
    timezoneOffsetMinutes: localOffsetMinutes(workout.startedAt),
    ...(workout.notes === undefined ? {} : { notes: workout.notes }),
    exercises: [...(rowsPerWorkout.get(workout.id) ?? [])]
      .sort(byOrder)
      .map((row) => exerciseOf(row, library, setsPerRow.get(row.id) ?? [])),
  }));

  return serializeWorkoutsCsv(exported);
}
