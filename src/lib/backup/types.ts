/**
 * The full backup: everything the app holds, in one file it can read back.
 *
 * **Next to the CSV, never instead of it.** The CSV describes *sessions*, in a
 * format Hevy and a spreadsheet both understand — it is the file you hand to
 * something else. This one is the file you hand back to FitTrack: routines
 * never performed, folders, programs and their weeks, records, the coach's
 * journal, body measurements, the plate rack, the weekly goal, the 1RM formula,
 * the theme and the announcer. A move to a new phone loses none of it.
 *
 * **Rows as they are stored, soft deletes included.** A backup is a copy, not a
 * projection: dropping `deletedAt !== 0` rows would resurrect a routine you
 * deleted the next time the two devices met, and would lose the undo of the
 * last five minutes. The tables are written exactly as Dexie holds them, which
 * is also what makes the restore a `bulkPut` and not an import.
 *
 * **What it does not carry: photo binaries.** `photoBlobs` holds `Blob`s, which
 * JSON cannot express without doubling their size in base64. No screen in the
 * app writes one today, so the honest thing is to say so here rather than to
 * ship a format that quietly drops megabytes. The `progressPhotos` rows
 * themselves are in the file.
 */

export const BACKUP_FORMAT = 'fittrack-backup';

/** Bumped when the *file layout* changes — not when the database schema does. */
export const BACKUP_VERSION = 1;

/**
 * Every Dexie table of `FitTrackDB`, in the order a human would read them.
 * `photoBlobs` is deliberately absent (see above).
 */
export const BACKUP_TABLES = [
  'exercises',
  'externalExerciseBindings',
  'routineFolders',
  'routines',
  'routineExercises',
  'routineSets',
  'workouts',
  'workoutExercises',
  'workoutSets',
  'personalRecords',
  'milestones',
  'coachRecommendations',
  'bodyMeasurements',
  'progressPhotos',
  'programs',
  'programWeeks',
  'programScheduleRevisions',
  'programScheduleEntries',
  'settings',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export type BackupRow = Record<string, unknown>;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** Epoch ms, like every other date in the app. */
  exportedAt: number;
  /**
   * Who wrote it, and against which Dexie schema. Read by a human deciding
   * which file to restore, and by any future migration of this format.
   */
  app: { name: string; schemaVersion: number };
  /**
   * The preferences that live in `localStorage` rather than in Dexie — theme,
   * announcer, effort strip, tutorial. Captured by namespace (`fittrack:`)
   * rather than by a list, so a preference added later is backed up without
   * anyone having to remember this file.
   */
  preferences: Record<string, string>;
  tables: Record<BackupTable, BackupRow[]>;
}

export type BackupCounts = Record<BackupTable, number>;

export function backupCounts(backup: BackupFile): BackupCounts {
  return Object.fromEntries(
    BACKUP_TABLES.map((table) => [table, backup.tables[table]?.length ?? 0]),
  ) as BackupCounts;
}

export function totalRows(counts: BackupCounts): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

/** `fittrack-sauvegarde-2026-08-21.json` — the date a human is looking for. */
export function backupFileName(at: number): string {
  const local = new Date(at - new Date(at).getTimezoneOffset() * 60_000);
  return `fittrack-sauvegarde-${local.toISOString().slice(0, 10)}.json`;
}

/**
 * No indentation: the file is read by the app, not by a person, and a session
 * table of forty thousand sets is not worth doubling in size for whitespace.
 */
export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup);
}
