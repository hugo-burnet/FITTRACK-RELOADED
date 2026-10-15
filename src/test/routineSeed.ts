import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { Exercise, Routine, RoutineExercise, RoutineSet, SetType } from '@/data/types';

/**
 * Une routine toute faite pour les tests qui ont besoin de ses lignes et de ses séries elles-mêmes
 * (leurs identifiants), pas seulement de « une routine qui existe ». Les tests du benchmark en portaient
 * chacun une copie ; celle-ci sert aux nouveaux.
 */

export interface SeedSet {
  setType?: SetType;
  targetWeight?: number;
  targetReps?: number;
  targetRepsMax?: number;
}

export async function seedExercise(
  partial: Partial<Exercise> & Pick<Exercise, 'name'>,
): Promise<Exercise> {
  const exercise = newEntity<Exercise>({
    primaryMuscle: 'chest',
    secondaryMuscles: ['triceps', 'shoulders'],
    movementPattern: 'poussee_horizontale',
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
    ...partial,
  });
  await db.exercises.add(exercise);
  return exercise;
}

export async function seedRoutine(
  name: string,
  lines: { exercise: Exercise; sets: SeedSet[] }[],
): Promise<{ routine: Routine; rows: RoutineExercise[]; sets: RoutineSet[][] }> {
  const routine = newEntity<Routine>({ name, folderId: '', order: 0 });
  await db.routines.add(routine);

  const rows: RoutineExercise[] = [];
  const sets: RoutineSet[][] = [];
  for (const [index, line] of lines.entries()) {
    const row = newEntity<RoutineExercise>({
      routineId: routine.id,
      exerciseId: line.exercise.id,
      order: index,
      supersetGroup: 0,
      restSeconds: 0,
      notes: '',
    });
    await db.routineExercises.add(row);
    const planned = line.sets.map((set, order) =>
      newEntity<RoutineSet>({
        routineExerciseId: row.id,
        order,
        setType: set.setType ?? 'normal',
        ...(set.targetReps === undefined ? {} : { targetReps: set.targetReps }),
        ...(set.targetRepsMax === undefined ? {} : { targetRepsMax: set.targetRepsMax }),
        ...(set.targetWeight === undefined ? {} : { targetWeight: set.targetWeight }),
      }),
    );
    if (planned.length > 0) await db.routineSets.bulkAdd(planned);
    rows.push(row);
    sets.push(planned);
  }
  return { routine, rows, sets };
}

/** `count` séries identiques : « trois séries de 8 – 12 à 70 kg ». */
export const repeatSet = (count: number, set: SeedSet): SeedSet[] =>
  Array.from({ length: count }, () => ({ ...set }));
