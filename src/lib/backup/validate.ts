import {
  EQUIPMENT,
  MEASUREMENT_TYPES,
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
  PLATE_LOADINGS,
  PROGRAM_PHASES,
  SET_TYPES,
  type CoachRecommendationStatus,
  type CoachSignalCode,
  type ExternalExerciseSource,
  type PersonalRecordType,
  type ProgramStatus,
  type Side,
  type WorkoutStatus,
} from '@/data/types';
import { BACKUP_TABLES, type BackupRow, type BackupTable } from './types';

/**
 * Ce qu'un fichier doit contenir pour avoir le droit d'effacer la base.
 *
 * **Pourquoi ce module existe.** `restoreBackup` vide chaque table puis écrit
 * les lignes du fichier telles quelles. Tant que la lecture *réparait* — table
 * absente lue comme vide, ligne non-objet jetée en silence — un fichier au bon
 * en-tête ne contenant qu'une préférence était accepté, et une séance réduite à
 * `{ id: 'broken' }` aussi. La transaction Dexie protège d'une erreur
 * d'écriture ; elle ne protège de rien quand le fichier incomplet s'insère très
 * bien. Le seul endroit où l'on peut encore dire non, c'est ici : avant.
 *
 * **Deux niveaux, et la différence compte.**
 *
 * - Un *défaut* (`BackupFlaw`) refuse le fichier. Il dit que le fichier n'est
 *   pas une sauvegarde cohérente : une table qui n'est pas une liste, une ligne
 *   à qui il manque ce qui la rend lisible, deux lignes sur le même
 *   identifiant — `bulkPut` en écraserait une sans un mot.
 * - Un *orphelin* (`BackupOrphan`) est signalé, compté, et laissé passer. Une
 *   série dont la séance a disparu est une ligne inerte ; refuser pour elle la
 *   seule sauvegarde de quelqu'un détruirait bien plus que ce qu'on prétend
 *   protéger. Le récapitulatif la dit, et l'utilisateur tranche.
 *
 * **Absent n'est pas manquant.** Une table introuvable est légitime quand le
 * schéma qui a écrit le fichier ne la connaissait pas encore (`since`) — les
 * blocs datent de la version 6, les paliers de la 12. Sous ce seuil, l'absence
 * est un trou dans les données essentielles, et se refuse.
 *
 * **Ce qui est exigé, et ce qui est seulement typé.** Un champ est requis quand
 * son absence casse une lecture (une identité, une référence, un
 * discriminant). Les autres ne sont vérifiés que s'ils sont là : la version 9
 * a ajouté un coefficient, la 10 un drapeau, et une sauvegarde antérieure n'a
 * aucune raison de les porter — `backfillBackupTables` est là pour ça.
 */

export type BackupFlaw =
  /** La table manquait, et le schéma du fichier la connaissait. */
  | { kind: 'missing-table'; table: BackupTable }
  | { kind: 'not-a-list'; table: BackupTable }
  | { kind: 'not-a-record'; table: BackupTable; index: number }
  | { kind: 'missing-field'; table: BackupTable; index: number; field: string }
  | { kind: 'invalid-field'; table: BackupTable; index: number; field: string }
  /** Deux lignes sur la même clé primaire. */
  | { kind: 'duplicate-key'; table: BackupTable; key: string };

/** Des lignes qui désignent un parent que le fichier ne contient pas. */
export interface BackupOrphan {
  table: BackupTable;
  field: string;
  count: number;
}

export type BackupStructure =
  | { ok: true; tables: Record<BackupTable, BackupRow[]>; orphans: BackupOrphan[] }
  | { ok: false; flaws: BackupFlaw[]; flawCount: number };

/**
 * Assez pour nommer le problème, pas assez pour transformer un message d'erreur
 * en journal illisible. `flawCount` porte le total.
 */
const MAX_REPORTED_FLAWS = 20;

type Check = (value: unknown) => boolean;

const isString: Check = (value) => typeof value === 'string';
const isId: Check = (value) => typeof value === 'string' && value.length > 0;
const isNumber: Check = (value) => typeof value === 'number' && Number.isFinite(value);
const isFlag: Check = (value) => value === 0 || value === 1;
const isList: Check = (value) => Array.isArray(value);

const oneOf =
  (values: readonly string[]): Check =>
  (value) =>
    typeof value === 'string' && values.includes(value);

const listOf =
  (values: readonly string[]): Check =>
  (value) =>
    Array.isArray(value) && value.every((item) => oneOf(values)(item));

/**
 * Les vocabulaires que `data/types.ts` n'expose qu'en type. Recopiés ici avec
 * un `satisfies` : la liste peut vieillir, mais pas mentir — une valeur retirée
 * du type ne compile plus.
 */
const WORKOUT_STATUSES = [
  'active',
  'completed',
  'discarded',
] as const satisfies readonly WorkoutStatus[];
const PROGRAM_STATUSES = [
  'draft',
  'active',
  'completed',
] as const satisfies readonly ProgramStatus[];
const SIDES = ['both', 'left', 'right'] as const satisfies readonly Side[];
const EXTERNAL_SOURCES = ['hevy_csv'] as const satisfies readonly ExternalExerciseSource[];
const RECORD_TYPES = [
  'max_weight',
  'max_added_weight',
  'min_assistance',
  'max_reps',
  'best_1rm',
  'max_volume_set',
  'max_volume_session',
  'max_duration',
  'max_distance',
] as const satisfies readonly PersonalRecordType[];
const COACH_CODES = [
  'range_satisfied',
  'range_ceiling_reached',
  'range_completed',
  'range_missed',
  'intra_session_drop',
  'plateau',
  'long_rest',
] as const satisfies readonly CoachSignalCode[];
const COACH_STATUSES = [
  'pending',
  'followed',
  'dismissed',
  'superseded',
] as const satisfies readonly CoachRecommendationStatus[];

interface TableSpec {
  /** Version du schéma Dexie qui a livré la table. En deçà, son absence est normale. */
  since: number;
  /** Clé primaire : c'est elle qui doit être unique, et `bulkPut` s'y fie. */
  key: string;
  required: Record<string, Check>;
  optional?: Record<string, Check>;
  /** Champs qui désignent une ligne d'une autre table. `''` = pas de parent. */
  links?: readonly { field: string; table: BackupTable }[];
}

/** `id`, `createdAt`, `updatedAt`, `deletedAt` — le contrat de `Syncable`. */
const SYNCABLE: Record<string, Check> = {
  id: isId,
  createdAt: isNumber,
  updatedAt: isNumber,
  deletedAt: isNumber,
};

const SPECS: Record<BackupTable, TableSpec> = {
  exercises: {
    since: 1,
    key: 'id',
    required: {
      ...SYNCABLE,
      name: isId,
      primaryMuscle: oneOf(MUSCLE_GROUPS),
      equipment: oneOf(EQUIPMENT),
      measurementType: oneOf(MEASUREMENT_TYPES),
      isCustom: isFlag,
    },
    optional: {
      secondaryMuscles: listOf(MUSCLE_GROUPS),
      isUnilateral: isFlag,
      movementPattern: oneOf(MOVEMENT_PATTERNS),
      plateLoading: oneOf(PLATE_LOADINGS),
      bodyweightLoadFactor: isNumber,
      loadIncrementKg: isNumber,
      plateBaseWeightKg: isNumber,
    },
  },
  externalExerciseBindings: {
    since: 3,
    key: 'id',
    required: {
      ...SYNCABLE,
      source: oneOf(EXTERNAL_SOURCES),
      identityKey: isString,
      exerciseId: isId,
      measurementType: oneOf(MEASUREMENT_TYPES),
    },
    links: [{ field: 'exerciseId', table: 'exercises' }],
  },
  routineFolders: {
    since: 1,
    key: 'id',
    required: { ...SYNCABLE, name: isString, order: isNumber },
  },
  routines: {
    since: 1,
    key: 'id',
    required: { ...SYNCABLE, name: isString, folderId: isString, order: isNumber },
    links: [{ field: 'folderId', table: 'routineFolders' }],
  },
  routineExercises: {
    since: 1,
    key: 'id',
    required: {
      ...SYNCABLE,
      routineId: isId,
      exerciseId: isId,
      order: isNumber,
      supersetGroup: isNumber,
      restSeconds: isNumber,
    },
    links: [
      { field: 'routineId', table: 'routines' },
      { field: 'exerciseId', table: 'exercises' },
    ],
  },
  routineSets: {
    since: 1,
    key: 'id',
    required: {
      ...SYNCABLE,
      routineExerciseId: isId,
      order: isNumber,
      setType: oneOf(SET_TYPES),
    },
    links: [{ field: 'routineExerciseId', table: 'routineExercises' }],
  },
  workouts: {
    since: 1,
    key: 'id',
    required: {
      ...SYNCABLE,
      routineId: isString,
      name: isString,
      status: oneOf(WORKOUT_STATUSES),
      startedAt: isNumber,
      endedAt: isNumber,
      durationSeconds: isNumber,
    },
    optional: { programPhase: oneOf(PROGRAM_PHASES), programIsDeload: isFlag },
    links: [{ field: 'routineId', table: 'routines' }],
  },
  workoutExercises: {
    since: 1,
    key: 'id',
    required: {
      ...SYNCABLE,
      workoutId: isId,
      exerciseId: isId,
      order: isNumber,
      supersetGroup: isNumber,
      restSeconds: isNumber,
    },
    optional: {
      exerciseMeasurementType: oneOf(MEASUREMENT_TYPES),
      exercisePrimaryMuscle: oneOf(MUSCLE_GROUPS),
      exerciseSecondaryMuscles: listOf(MUSCLE_GROUPS),
      exerciseEquipment: oneOf(EQUIPMENT),
      exerciseIsUnilateral: isFlag,
    },
    links: [
      { field: 'workoutId', table: 'workouts' },
      { field: 'exerciseId', table: 'exercises' },
    ],
  },
  workoutSets: {
    since: 1,
    key: 'id',
    required: {
      ...SYNCABLE,
      workoutExerciseId: isId,
      exerciseId: isId,
      workoutId: isId,
      order: isNumber,
      setType: oneOf(SET_TYPES),
      side: oneOf(SIDES),
      isCompleted: isFlag,
      performedAt: isNumber,
    },
    optional: { weight: isNumber, reps: isNumber, durationSeconds: isNumber, rpe: isNumber },
    links: [
      { field: 'workoutExerciseId', table: 'workoutExercises' },
      { field: 'workoutId', table: 'workouts' },
      { field: 'exerciseId', table: 'exercises' },
    ],
  },
  personalRecords: {
    since: 1,
    key: 'id',
    required: {
      ...SYNCABLE,
      exerciseId: isId,
      type: oneOf(RECORD_TYPES),
      value: isNumber,
      achievedAt: isNumber,
      workoutId: isString,
    },
    links: [
      { field: 'exerciseId', table: 'exercises' },
      { field: 'workoutId', table: 'workouts' },
    ],
  },
  milestones: {
    since: 12,
    key: 'id',
    required: {
      ...SYNCABLE,
      definitionId: isId,
      achievedAt: isNumber,
      workoutId: isString,
      value: isNumber,
      acknowledgedAt: isNumber,
    },
    links: [{ field: 'workoutId', table: 'workouts' }],
  },
  coachRecommendations: {
    since: 5,
    key: 'id',
    required: {
      ...SYNCABLE,
      exerciseId: isId,
      code: oneOf(COACH_CODES),
      recommendedAt: isNumber,
      evidence: isList,
      status: oneOf(COACH_STATUSES),
    },
    links: [{ field: 'exerciseId', table: 'exercises' }],
  },
  bodyMeasurements: {
    since: 1,
    key: 'id',
    required: { ...SYNCABLE, type: isId, value: isNumber, unit: isString, measuredAt: isNumber },
  },
  progressPhotos: {
    since: 1,
    key: 'id',
    required: { ...SYNCABLE, blobKey: isString, thumbnailDataUrl: isString, takenAt: isNumber },
  },
  programs: {
    since: 6,
    key: 'id',
    required: {
      ...SYNCABLE,
      name: isString,
      startsAt: isNumber,
      durationWeeks: isNumber,
      status: oneOf(PROGRAM_STATUSES),
    },
  },
  programWeeks: {
    since: 6,
    key: 'id',
    required: {
      ...SYNCABLE,
      programId: isId,
      weekIndex: isNumber,
      loadIndex: isNumber,
      phase: oneOf(PROGRAM_PHASES),
    },
    links: [{ field: 'programId', table: 'programs' }],
  },
  programScheduleRevisions: {
    since: 6,
    key: 'id',
    required: { ...SYNCABLE, programId: isId, effectiveFromWeekIndex: isNumber },
    links: [{ field: 'programId', table: 'programs' }],
  },
  programScheduleEntries: {
    since: 6,
    key: 'id',
    required: {
      ...SYNCABLE,
      revisionId: isId,
      routineId: isString,
      dayOfWeek: isNumber,
      order: isNumber,
    },
    links: [
      { field: 'revisionId', table: 'programScheduleRevisions' },
      { field: 'routineId', table: 'routines' },
    ],
  },
  /** Table clé/valeur : ni `id` ni horodatage de création. `value` est libre. */
  settings: {
    since: 1,
    key: 'key',
    required: { key: isId, updatedAt: isNumber },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Les tables du fichier, ou les défauts qui interdisent de s'en servir.
 *
 * `schemaVersion` vient de `app.schemaVersion` du fichier. `0` — un fichier qui
 * ne dit pas d'où il vient — est lu comme `1` : on n'exige alors que les tables
 * de la première version, ce qui est la lecture la plus indulgente possible
 * sans jamais laisser passer un trou dans les données essentielles.
 */
export function validateBackupTables(source: unknown, schemaVersion: number): BackupStructure {
  const flaws: BackupFlaw[] = [];
  let flawCount = 0;
  const note = (flaw: BackupFlaw) => {
    flawCount += 1;
    if (flaws.length < MAX_REPORTED_FLAWS) flaws.push(flaw);
  };

  const raw = isRecord(source) ? source : {};
  const floor = Number.isFinite(schemaVersion) && schemaVersion > 1 ? Math.floor(schemaVersion) : 1;

  const tables = {} as Record<BackupTable, BackupRow[]>;
  const keys = {} as Record<BackupTable, Set<string>>;

  for (const table of BACKUP_TABLES) {
    const spec = SPECS[table];
    tables[table] = [];
    keys[table] = new Set();

    const value = raw[table];
    if (value === undefined || value === null) {
      // Une table que le fichier ne pouvait pas connaître n'est pas un trou.
      if (spec.since <= floor) note({ kind: 'missing-table', table });
      continue;
    }
    if (!Array.isArray(value)) {
      note({ kind: 'not-a-list', table });
      continue;
    }

    const rows: BackupRow[] = [];
    value.forEach((row, index) => {
      if (!isRecord(row)) {
        note({ kind: 'not-a-record', table, index });
        return;
      }

      for (const [field, check] of Object.entries(spec.required)) {
        const held = row[field];
        if (held === undefined) note({ kind: 'missing-field', table, index, field });
        else if (!check(held)) note({ kind: 'invalid-field', table, index, field });
      }
      for (const [field, check] of Object.entries(spec.optional ?? {})) {
        const held = row[field];
        if (held !== undefined && !check(held)) {
          note({ kind: 'invalid-field', table, index, field });
        }
      }

      const key = row[spec.key];
      if (typeof key === 'string' && key.length > 0) {
        if (keys[table].has(key)) note({ kind: 'duplicate-key', table, key });
        else keys[table].add(key);
      }

      rows.push(row);
    });

    tables[table] = rows;
  }

  if (flawCount > 0) return { ok: false, flaws, flawCount };

  // Les références ne sont mesurées qu'une fois la structure sûre : sur des
  // lignes déjà refusées, un orphelin ne dirait rien de plus que le refus.
  const orphans: BackupOrphan[] = [];
  for (const table of BACKUP_TABLES) {
    for (const link of SPECS[table].links ?? []) {
      let count = 0;
      for (const row of tables[table]) {
        const held = row[link.field];
        // `''` est le « pas de parent » du modèle (routine à la racine, séance
        // libre) — pas une référence cassée.
        if (typeof held !== 'string' || held.length === 0) continue;
        if (!keys[link.table].has(held)) count += 1;
      }
      if (count > 0) orphans.push({ table, field: link.field, count });
    }
  }

  return { ok: true, tables, orphans };
}
