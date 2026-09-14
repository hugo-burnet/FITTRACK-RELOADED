import { db } from '@/data/db';
import type { Exercise, Routine, RoutineExercise, RoutineSet } from '@/data/types';
import type { RoutineSource } from '@/lib/export/projectRoutineExport';
import type { RoutineExportScope } from '@/lib/export/types';
import { alive } from './base';

/**
 * Ce qu'un périmètre d'export de routines contient, en une lecture.
 *
 * **Pourquoi pas `getRoutineDetail` en boucle.** L'éditeur lit une routine à la
 * fois et c'est la bonne forme pour lui ; un dossier de huit routines en ferait
 * huit fois quatre requêtes. `listRoutineSummaries` a déjà tranché la même
 * question dans l'autre sens, et pour la même raison : « le N+1 est le réflexe
 * naturel ici et il devient visible vers dix routines ».
 *
 * **Le nom du dossier est résolu ici.** `lib/export` ne connaît pas la table des
 * dossiers et n'a aucune raison de la connaître — c'est exactement la frontière
 * que `RoutineSource` décrit : le dépôt lit, la projection met en forme.
 */

const byOrder = <T extends { order: number }>(a: T, b: T): number => a.order - b.order;

export interface RoutineExportSources {
  sources: RoutineSource[];
  /** Le nom du dossier d'un périmètre `folder` ; absent à la racine. */
  folderName?: string;
}

/** Les routines vivantes du périmètre, chacune avec son graphe complet. */
export async function readRoutineExportSources(
  scope: RoutineExportScope,
): Promise<RoutineExportSources> {
  const [allRoutines, allRows, allSets, folders] = await Promise.all([
    db.routines.toArray(),
    db.routineExercises.toArray(),
    db.routineSets.toArray(),
    db.routineFolders.toArray(),
  ]);

  const routines = alive(allRoutines)
    .filter((routine: Routine) =>
      scope.kind === 'routine'
        ? routine.id === scope.routineId
        : routine.folderId === scope.folderId,
    )
    .sort(byOrder);

  const rowsByRoutine = new Map<string, RoutineExercise[]>();
  for (const row of alive(allRows)) {
    const list = rowsByRoutine.get(row.routineId);
    if (list === undefined) rowsByRoutine.set(row.routineId, [row]);
    else list.push(row);
  }

  const setsByRow = new Map<string, RoutineSet[]>();
  for (const set of alive(allSets)) {
    const list = setsByRow.get(set.routineExerciseId);
    if (list === undefined) setsByRow.set(set.routineExerciseId, [set]);
    else list.push(set);
  }

  const rows = routines.flatMap((routine) => rowsByRoutine.get(routine.id) ?? []);
  const found = await db.exercises.bulkGet([...new Set(rows.map((row) => row.exerciseId))]);
  const library = new Map<string, Exercise>();
  // Un exercice supprimé se lit comme absent, exactement comme dans
  // `getRoutineDetail` : le document dira « exercice inconnu » plutôt que de
  // ressusciter un nom que la bibliothèque ne porte plus.
  for (const exercise of found) {
    if (exercise !== undefined && exercise.deletedAt === 0) library.set(exercise.id, exercise);
  }

  const folderName =
    scope.kind === 'folder'
      ? folders.find((folder) => folder.id === scope.folderId && folder.deletedAt === 0)?.name
      : undefined;

  return {
    sources: routines.map((routine) => ({
      routine,
      // Résolu routine par routine, y compris sur un périmètre « dossier » où
      // elles le partagent : c'est une information de la routine, pas du
      // périmètre, et la faire descendre du périmètre obligerait le document à
      // savoir d'où il vient pour savoir quoi écrire.
      ...folderNameOf(routine, folders),
      exercises: (rowsByRoutine.get(routine.id) ?? []).sort(byOrder).map((row) => ({
        row,
        exercise: library.get(row.exerciseId),
        sets: (setsByRow.get(row.id) ?? []).sort(byOrder),
      })),
    })),
    ...(folderName === undefined ? {} : { folderName }),
  };
}

function folderNameOf(
  routine: Routine,
  folders: readonly { id: string; name: string; deletedAt: number }[],
): { folderName?: string } {
  const name = folders.find(
    (folder) => folder.id === routine.folderId && folder.deletedAt === 0,
  )?.name;
  return name === undefined ? {} : { folderName: name };
}
