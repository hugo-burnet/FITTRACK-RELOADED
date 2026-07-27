import type {
  Exercise,
  Routine,
  RoutineExercise,
  RoutineFolder,
  RoutineSet,
} from '@/data/types';
import { hevyExerciseSourceKey } from '@/lib/hevyExerciseMatch';
import type { HevyRoutineSource } from '@/lib/hevyRoutineSelection';
import { newEntity } from './base';

export interface HevyRoutineEntities {
  folder: RoutineFolder;
  routines: Routine[];
  rows: RoutineExercise[];
  sets: RoutineSet[];
}

export function hevyImportFolderBaseName(importedAt: number): string {
  const date = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(importedAt);
  return `Import Hevy — ${date}`;
}

export function nextHevyImportFolderName(
  importedAt: number,
  aliveFolderNames: readonly string[],
): string {
  const base = hevyImportFolderBaseName(importedAt);
  const occupied = new Set(aliveFolderNames);
  if (!occupied.has(base)) return base;

  let suffix = 2;
  while (occupied.has(`${base} (${suffix})`)) suffix += 1;
  return `${base} (${suffix})`;
}

export function buildHevyRoutineEntities(
  sources: readonly HevyRoutineSource[],
  exercisesBySourceKey: ReadonlyMap<string, Exercise>,
  folderName: string,
  folderOrder: number,
  firstRoutineOrder: number,
): HevyRoutineEntities {
  const folder = newEntity<RoutineFolder>({
    name: folderName,
    order: folderOrder,
  });
  const routines: Routine[] = [];
  const rows: RoutineExercise[] = [];
  const sets: RoutineSet[] = [];

  for (const [routineIndex, source] of sources.entries()) {
    const routine = newEntity<Routine>({
      name: source.name,
      folderId: folder.id,
      order: firstRoutineOrder + routineIndex,
      version: 1,
    });
    routines.push(routine);

    for (const parsedExercise of source.workout.exercises) {
      const sourceKey = hevyExerciseSourceKey(
        parsedExercise.sourceTitle,
      );
      const exercise = exercisesBySourceKey.get(sourceKey);
      if (exercise === undefined) {
        throw new Error(
          `Missing resolved Hevy routine exercise: ${sourceKey}`,
        );
      }
      const row = newEntity<RoutineExercise>({
        routineId: routine.id,
        exerciseId: exercise.id,
        order: parsedExercise.order,
        supersetGroup: 0,
        restSeconds: 0,
      });
      rows.push(row);

      for (const parsedSet of parsedExercise.sets) {
        sets.push(
          newEntity<RoutineSet>({
            routineExerciseId: row.id,
            order: parsedSet.order,
            setType: parsedSet.setType,
            ...(parsedSet.reps === undefined
              ? {}
              : { targetReps: parsedSet.reps }),
            ...(parsedSet.durationSeconds === undefined
              ? {}
              : {
                  targetDurationSeconds:
                    parsedSet.durationSeconds,
                }),
            ...(parsedSet.distanceMeters === undefined
              ? {}
              : { targetDistanceMeters: parsedSet.distanceMeters }),
          }),
        );
      }
    }
  }

  return { folder, routines, rows, sets };
}
