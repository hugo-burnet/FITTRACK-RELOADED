import { db } from '@/data/db';
import { workoutTotals } from '@/lib/volumeSource';
import { alive } from './base';
import { listHistoricalWorkouts } from './historicalWorkouts';

/** Une séance terminée d'un programme, avec de quoi la situer et la rouvrir. */
export interface ProgramWorkoutReading {
  /** L'identifiant de la séance : la fiche d'historique est `/history/:workoutId`. */
  workoutId: string;
  name: string;
  startedAt: number;
  /** Semaine du programme, à partir de 0. */
  weekIndex: number;
  /** Le créneau du split qu'elle a joué ; absent sur une séance sans créneau. */
  entryId: string | undefined;
  tonnage: number;
}

/**
 * Les séances terminées d'un programme, de la plus ancienne à la plus récente.
 *
 * Un filtre sur `programId` et non un index : la table `workouts` n'en a pas, et
 * ce volume (quelques séances par semaine, sur au plus douze semaines) ne le
 * justifie pas — `getActiveProgramDetail` fait déjà le même filtre. Le tonnage
 * vient de `workoutTotals`, comme partout ailleurs : un programme ne redéfinit
 * pas ce qu'est un tonnage.
 */
export async function listProgramWorkouts(programId: string): Promise<ProgramWorkoutReading[]> {
  const workouts = alive(await db.workouts.where('status').equals('completed').toArray())
    .filter((workout) => workout.programId === programId && workout.programWeekIndex !== undefined)
    .sort((left, right) => left.startedAt - right.startedAt || left.id.localeCompare(right.id));
  if (workouts.length === 0) return [];

  // Une lecture par période plutôt qu'une par séance ; les séances libres qui s'y glissent sont écartées.
  const historical = await listHistoricalWorkouts({
    kind: 'period',
    from: workouts[0]!.startedAt,
    to: workouts[workouts.length - 1]!.startedAt + 1,
  });
  const tonnageById = new Map(
    historical.map((workout) => [workout.workoutId, workoutTotals(workout).tonnage]),
  );

  return workouts.map((workout) => ({
    workoutId: workout.id,
    name: workout.name,
    startedAt: workout.startedAt,
    weekIndex: workout.programWeekIndex!,
    entryId: workout.programScheduleEntryId,
    tonnage: tonnageById.get(workout.id) ?? 0,
  }));
}
