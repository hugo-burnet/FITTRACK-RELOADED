import {
  EQUIPMENT,
  MEASUREMENT_TYPES,
  type Equipment,
  type Exercise,
  type MeasurementType,
} from '@/data/types';
import { defaultBodyweightLoadFactor } from '@/lib/bodyweightLoad';
import { snapshotOf } from '@/lib/exerciseSnapshot';
import { localOffsetMinutes } from '@/lib/timezone';
import type { BackupRow, BackupTable } from './types';

/**
 * Bringing a restored file up to the schema the running app expects.
 *
 * **Why this module has to exist at all.** Dexie's `upgrade()` blocks run when
 * the database's *version number* changes — and a restore does not change it.
 * `restoreBackup` empties each table and puts the file's rows back verbatim, so
 * a file written under an older schema lands in a current database carrying
 * fields that every migration since has been busy adding. The rows are simply
 * never seen by any `upgrade()`, then or later.
 *
 * The consequence was not theoretical. A backup taken before version 9 holds
 * self-made bodyweight exercises with no `bodyweightLoadFactor`, and
 * `effectiveLoadKg` reads an absent coefficient as "no body involved" — zero.
 * Restoring one put back, in silence, the exact defect version 9 exists to fix:
 * fourteen repetitions, no tonnage, no record, and nothing on any screen
 * printing the zero to be suspicious about. `seedDatabase` cannot save it
 * either: version 9 targets `isCustom: 1`, which the seed refuses to touch on
 * principle.
 *
 * **Pure, and it does not touch `db.ts`.** The migration rule of the project is
 * absolute — a version that has shipped is never edited — so nothing here is
 * extracted from those blocks. These are separate, self-contained restatements
 * of the same backfills, working on the file's own rows before they are
 * written. The file carries its whole library in `tables.exercises`, so
 * resolving an identity needs no database at all.
 *
 * **Guarded rather than replayed.** Each step fills what is *absent* and never
 * overwrites what is there — which is a stricter rule than the original
 * migrations needed, because they ran exactly once on rows that could not yet
 * hold the field. Here the same step may meet a row that already carries a
 * correct answer, and overwriting a frozen snapshot with today's catalogue is
 * precisely the rewriting of history the snapshots exist to prevent. The
 * guards also make every step idempotent, which is what lets a file that does
 * not say where it came from be brought through all of them safely.
 */

/**
 * The Dexie version this build opens the database at.
 *
 * Restated here because `lib/` may not import `data/db` — that module already
 * imports this layer, and the cycle would be real. `schemaVersion.test.ts` in
 * `data/` asserts the two agree, so the constant cannot drift in silence.
 */
export const CURRENT_SCHEMA_VERSION = 11;

/** `0` is what `parseBackup` writes when a file names no schema at all. */
const UNKNOWN_SCHEMA_VERSION = 0;

type Tables = Record<BackupTable, BackupRow[]>;

/** Maps one table, sharing the rows a step did not change. */
function mapTable(tables: Tables, name: BackupTable, step: (row: BackupRow) => BackupRow): Tables {
  return { ...tables, [name]: tables[name].map(step) };
}

/** A row without the named keys. Spelled out rather than destructured-and-dropped:
 *  the unused bindings that pattern leaves behind are exactly what the lint rule
 *  is right to complain about. */
function omit(row: BackupRow, keys: readonly string[]): BackupRow {
  const rest: BackupRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (!keys.includes(key)) rest[key] = value;
  }
  return rest;
}

/** The file's own library, which is the only one a restore may consult. */
function libraryOf(tables: Tables): Map<string, Exercise> {
  return new Map(
    tables.exercises.flatMap((row) =>
      typeof row.id === 'string' ? [[row.id, row as unknown as Exercise] as const] : [],
    ),
  );
}

const isMeasurementType = (value: unknown): value is MeasurementType =>
  MEASUREMENT_TYPES.includes(value as MeasurementType);

const isEquipment = (value: unknown): value is Equipment => EQUIPMENT.includes(value as Equipment);

/**
 * `snapshotOf` reads `exercise.secondaryMuscles.length` unguarded, which is
 * right for a live entity and wrong for a row out of a file that may predate
 * the field. Normalised here rather than softened there.
 */
function snapshotSourceOf(exercise: Exercise | undefined): Exercise | undefined {
  if (exercise === undefined) return undefined;
  return Array.isArray(exercise.secondaryMuscles)
    ? exercise
    : { ...exercise, secondaryMuscles: [] };
}

/**
 * Version 2 — the exercise snapshot, and the session's own UTC offset.
 *
 * Only rows carrying no snapshot at all: a row that already froze a name kept
 * the name it was performed under, and the catalogue has no business answering
 * for it now.
 */
function toVersion2(tables: Tables): Tables {
  const library = libraryOf(tables);

  const withSnapshots = mapTable(tables, 'workoutExercises', (row) => {
    if (row.exerciseName !== undefined || row.exercisePrimaryMuscle !== undefined) return row;
    if (typeof row.exerciseId !== 'string') return row;
    const snapshot = snapshotOf(snapshotSourceOf(library.get(row.exerciseId)));
    return Object.keys(snapshot).length === 0 ? row : { ...row, ...snapshot };
  });

  // The restoring phone's zone database, not the one the session was logged in —
  // the same trade version 2 made and documented, and the only one available to
  // a file that never recorded the offset.
  return mapTable(withSnapshots, 'workouts', (row) => {
    if (row.startedTimezoneOffsetMinutes !== undefined) return row;
    if (typeof row.startedAt !== 'number' || !Number.isFinite(row.startedAt)) return row;
    return { ...row, startedTimezoneOffsetMinutes: localOffsetMinutes(row.startedAt) };
  });
}

/**
 * Version 4 — the snapshot's secondary muscles.
 *
 * Only rows that were already snapshotted, exactly as the migration had it: a
 * row with no snapshot falls through to the library as a whole, and handing it
 * a lone list of secondaries would break that fallback.
 */
function toVersion4(tables: Tables): Tables {
  const library = libraryOf(tables);

  return mapTable(tables, 'workoutExercises', (row) => {
    if (row.exercisePrimaryMuscle === undefined) return row;
    if (row.exerciseSecondaryMuscles !== undefined) return row;
    if (typeof row.exerciseId !== 'string') return row;
    const secondaries = library.get(row.exerciseId)?.secondaryMuscles;
    if (!Array.isArray(secondaries) || secondaries.length === 0) return row;
    return { ...row, exerciseSecondaryMuscles: [...secondaries] };
  });
}

/** Version 7 — `loadIndex` + `phase` replace %1RM / RPE / `isDeload`. */
function toVersion7(tables: Tables): Tables {
  return mapTable(tables, 'programWeeks', (row) => {
    if (row.loadIndex !== undefined) return row;

    const { prescriptionKind, prescriptionValue, isDeload } = row;
    const loadIndex =
      prescriptionKind === 'target_rpe' || typeof prescriptionValue !== 'number'
        ? 100
        : prescriptionValue;
    const phase = prescriptionKind !== 'target_rpe' && isDeload === 1 ? 'deload' : 'construction';

    return {
      ...omit(row, ['prescriptionKind', 'prescriptionValue', 'isDeload']),
      loadIndex,
      phase,
    };
  });
}

/** Version 8 — blocks stopped governing routines; the three fields went with them. */
function toVersion8(tables: Tables): Tables {
  return mapTable(tables, 'routines', (row) => {
    if (
      row.version === undefined &&
      row.versionState === undefined &&
      row.originRoutineId === undefined
    ) {
      return row;
    }
    return omit(row, ['version', 'versionState', 'originRoutineId']);
  });
}

/**
 * Version 9 — the bodyweight coefficient of the exercises you made yourself.
 *
 * Only rows with no coefficient at all, only `isCustom: 1`, and only where the
 * body genuinely is the load. `lib/bodyweightLoad` owns that last judgement and
 * this restates none of it.
 */
function toVersion9(tables: Tables): Tables {
  return mapTable(tables, 'exercises', (row) => {
    if (row.isCustom !== 1 || row.bodyweightLoadFactor !== undefined) return row;
    if (!isMeasurementType(row.measurementType) || !isEquipment(row.equipment)) return row;
    const factor = defaultBodyweightLoadFactor(row.measurementType, row.equipment);
    return factor === undefined ? row : { ...row, bodyweightLoadFactor: factor };
  });
}

/**
 * Version 10 — le drapeau unilatéral de l'instantané.
 *
 * Mêmes gardes que la version 4 : uniquement les lignes déjà instantanées, et
 * jamais par-dessus un drapeau que le fichier porte déjà. Écraser un instantané
 * gelé avec le catalogue d'aujourd'hui est précisément la réécriture de
 * l'histoire que les instantanés empêchent.
 */
function toVersion10(tables: Tables): Tables {
  const library = libraryOf(tables);

  return mapTable(tables, 'workoutExercises', (row) => {
    if (row.exercisePrimaryMuscle === undefined) return row;
    if (row.exerciseIsUnilateral !== undefined) return row;
    if (typeof row.exerciseId !== 'string') return row;
    const flag = library.get(row.exerciseId)?.isUnilateral;
    return flag === undefined ? row : { ...row, exerciseIsUnilateral: flag };
  });
}

/**
 * Version 11 — l'allègement à zéro écrit au journal du coach.
 *
 * Même geste que la migration Dexie, et pour la même raison : une ligne « en
 * attente » qui propose 0 kg s'applique d'un doigt aux séries restantes.
 * Restreint à `range_missed` — un `range_ceiling_reached` à 0 kg sur machine
 * assistée est l'étape où l'assistance disparaît, pas un défaut.
 */
function toVersion11(tables: Tables): Tables {
  return mapTable(tables, 'coachRecommendations', (row) => {
    if (row.code !== 'range_missed' || row.nextLoadKg !== 0) return row;
    const cleaned = omit(row, ['nextLoadKg']);
    if (!Array.isArray(cleaned.evidence)) return cleaned;
    return {
      ...cleaned,
      evidence: (cleaned.evidence as { label?: unknown }[]).filter(
        (item) => item?.label !== 'next_load_kg',
      ),
    };
  });
}

/** Each backfill, and the schema version that first shipped it. */
const BACKFILLS: readonly { version: number; apply: (tables: Tables) => Tables }[] = [
  { version: 2, apply: toVersion2 },
  { version: 4, apply: toVersion4 },
  { version: 7, apply: toVersion7 },
  { version: 8, apply: toVersion8 },
  { version: 9, apply: toVersion9 },
  { version: 10, apply: toVersion10 },
  { version: 11, apply: toVersion11 },
];

/**
 * The file's tables, brought forward from the schema it was written under.
 *
 * A file that names no schema (`0`) goes through every step: the guards make
 * that safe, and refusing to rattrap a file for lack of a version number would
 * punish exactly the oldest backups, which are the ones that need it most.
 */
export function backfillBackupTables(tables: Tables, fromSchemaVersion: number): Tables {
  const from =
    Number.isFinite(fromSchemaVersion) && fromSchemaVersion > UNKNOWN_SCHEMA_VERSION
      ? fromSchemaVersion
      : UNKNOWN_SCHEMA_VERSION;

  return BACKFILLS.reduce(
    (current, backfill) => (from < backfill.version ? backfill.apply(current) : current),
    tables,
  );
}
