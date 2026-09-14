import type { Exercise, Routine, RoutineExercise, RoutineSet } from '@/data/types';
import type {
  ExportOptions,
  ExportRoutine,
  ExportRoutineExercise,
  ExportRoutineSet,
  RoutineExport,
  RoutineExportScope,
} from './types';

/**
 * Les routines telles qu'un document les décrira, sans Dexie et sans français.
 *
 * Le pendant exact de `projectCoachExport`, et pour la même raison : le
 * sérialiseur ne doit jamais parcourir des tables lui-même, sinon un second
 * format (CSV, JSON) les parcourrait à sa façon et les deux documents
 * finiraient par ne plus dire la même chose de la même routine.
 *
 * **Ce qu'elle ne fait pas.** Aucune agrégation : les séries sortent une par
 * une, avec leurs cibles. Résumer « 4 × 8–12 à 40 kg » est une décision de
 * lecture, elle appartient au sérialiseur — et c'est là qu'on peut la changer
 * sans toucher à ce qui est lu.
 *
 * **Les lignes mortes n'entrent pas.** Une routine, un exercice ou une série
 * supprimés n'ont rien à faire dans un document qu'on fait relire ; c'est la
 * différence entre ce module et la sauvegarde, qui copie tout, `deletedAt`
 * compris, parce qu'elle doit pouvoir restaurer une suppression.
 */

/** La routine et son graphe, tels qu'un dépôt les lit — sans dépendre de lui. */
export interface RoutineSource {
  routine: Routine;
  /** Résolu par l'appelant : `lib/` ne connaît pas la table des dossiers. */
  folderName?: string;
  exercises: {
    row: RoutineExercise;
    /** `undefined` quand l'exercice a quitté la bibliothèque. */
    exercise: Exercise | undefined;
    sets: RoutineSet[];
  }[];
}

const alive = <T extends { deletedAt: number }>(rows: readonly T[]): T[] =>
  rows.filter((row) => row.deletedAt === 0);

const byOrder = <T extends { order: number }>(a: T, b: T): number => a.order - b.order;

function projectSet(set: RoutineSet, number: number): ExportRoutineSet {
  return {
    number,
    type: set.setType,
    ...(set.targetReps === undefined ? {} : { targetReps: set.targetReps }),
    ...(set.targetRepsMax === undefined ? {} : { targetRepsMax: set.targetRepsMax }),
    ...(set.targetWeight === undefined ? {} : { targetWeight: set.targetWeight }),
    ...(set.targetDurationSeconds === undefined
      ? {}
      : { targetDurationSeconds: set.targetDurationSeconds }),
    ...(set.targetDistanceMeters === undefined
      ? {}
      : { targetDistanceMeters: set.targetDistanceMeters }),
  };
}

function projectExercise(
  line: RoutineSource['exercises'][number],
  options: ExportOptions,
): ExportRoutineExercise {
  // `includeWarmups` a le même sens que dans l'export d'historique : les gardées
  // par défaut, parce que la rampe fait partie de ce qu'on fait relire. Quand
  // elles sautent, les rangs se renumérotent — le document ne doit pas parler
  // d'une « série 3 » qu'il ne contient pas.
  const kept = options.includeWarmups
    ? alive(line.sets)
    : alive(line.sets).filter((set) => set.setType !== 'warmup');

  const { exercise } = line;

  return {
    ...(options.includeIds ? { id: line.row.exerciseId } : {}),
    ...(exercise === undefined ? {} : { name: exercise.name }),
    ...(exercise === undefined ? {} : { measurementType: exercise.measurementType }),
    ...(exercise === undefined ? {} : { primaryMuscle: exercise.primaryMuscle }),
    ...(exercise === undefined ? {} : { equipment: exercise.equipment }),
    // `''` est la valeur par défaut du champ depuis le schéma 13 : une note vide
    // n'est pas une note, et la porter jusqu'au document ferait une colonne de
    // tirets sur toutes les routines qui ne s'en servent pas.
    ...(options.includeNotes && line.row.notes !== undefined && line.row.notes.trim() !== ''
      ? { notes: line.row.notes }
      : {}),
    supersetGroup: line.row.supersetGroup,
    restSeconds: line.row.restSeconds,
    sets: [...kept].sort(byOrder).map((set, index) => projectSet(set, index + 1)),
  };
}

function projectRoutine(source: RoutineSource, options: ExportOptions): ExportRoutine {
  const subtitle = source.routine.subtitle?.trim();

  return {
    ...(options.includeIds ? { id: source.routine.id } : {}),
    name: source.routine.name,
    ...(subtitle === undefined || subtitle === '' ? {} : { subtitle }),
    ...(source.folderName === undefined || source.folderName === ''
      ? {}
      : { folderName: source.folderName }),
    exercises: source.exercises
      .filter(({ row }) => row.deletedAt === 0)
      .sort((left, right) => byOrder(left.row, right.row))
      .map((line) => projectExercise(line, options)),
  };
}

export function projectRoutineExport(
  scope: RoutineExportScope,
  sources: readonly RoutineSource[],
  options: ExportOptions,
  exportedAt: number,
  folderName?: string,
): RoutineExport {
  const routines = [...sources]
    .filter(({ routine }) => routine.deletedAt === 0)
    .sort((left, right) => byOrder(left.routine, right.routine))
    .map((source) => projectRoutine(source, options));

  return {
    format: 'fittrack-routine-export',
    schemaVersion: 1,
    exportedAt: new Date(exportedAt).toISOString(),
    scope,
    ...(folderName === undefined || folderName === '' ? {} : { folderName }),
    routineCount: routines.length,
    routines,
  };
}
