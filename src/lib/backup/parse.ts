import { CURRENT_SCHEMA_VERSION } from './backfill';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  backupCounts,
  totalRows,
  type BackupCounts,
  type BackupFile,
} from './types';
import { validateBackupTables, type BackupFlaw, type BackupOrphan } from './validate';

/**
 * Reading a backup file back, and refusing the ones that are not.
 *
 * Pure and total: it never throws and never touches the database. A restore
 * wipes everything the app holds, so the decision to run one is taken on a
 * value that has already been read, checked and counted — never on a file that
 * is opened halfway through the write.
 *
 * **Refuses rather than repairs.** It used to do the opposite: a missing table
 * became an empty one, a row that was not an object was dropped, a date that
 * was not a number became zero. Each of those was a small kindness that added
 * up to one large lie — a file with the right header and nothing usable in it
 * was accepted, and the app was emptied for it. What a file does not say
 * correctly, it does not get to say at all.
 *
 * **The one thing still forgiven is age.** A table introduced after the schema
 * the file was written under is legitimately absent, and comes back empty;
 * `validate.ts` owns that judgement, and `backfill.ts` brings the rows forward
 * afterwards. Everything else — a newer file layout, a newer database schema, a
 * malformed table, a row missing its identity — is refused outright: guessing at
 * a layout this app does not know would restore a plausible-looking half of
 * someone's history.
 */
export type BackupProblem =
  | 'not-json'
  | 'not-a-backup'
  /** Written by a later version of the *file format* than this one. */
  | 'unsupported-version'
  /** Written against a later *database schema* than this build can read. */
  | 'unsupported-schema'
  /** The header is right, the contents are not. `flaws` says where. */
  | 'invalid-structure'
  | 'empty';

export type BackupParse =
  | {
      ok: true;
      backup: BackupFile;
      counts: BackupCounts;
      total: number;
      /** Rows pointing at a parent the file does not contain. Shown, not refused. */
      orphans: BackupOrphan[];
    }
  | {
      ok: false;
      problem: BackupProblem;
      /** Present on `invalid-structure`, capped; `flawCount` holds the total. */
      flaws?: BackupFlaw[];
      flawCount?: number;
    };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The preferences block, or `undefined` when it is not one.
 *
 * Every preference the app writes is a string. A block holding anything else
 * did not come from `buildBackup`, and silently dropping the odd entry would
 * restore a half-configured app that looks fine.
 */
function readPreferences(value: unknown): Record<string, string> | undefined {
  if (value === undefined) return {};
  if (!isRecord(value)) return undefined;
  const preferences: Record<string, string> = {};
  for (const [key, stored] of Object.entries(value)) {
    if (typeof stored !== 'string') return undefined;
    preferences[key] = stored;
  }
  return preferences;
}

/** A header number: absent is tolerated (older files), wrong is not. */
function readNumber(value: unknown): number | undefined {
  if (value === undefined) return 0;
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function parseBackup(text: string): BackupParse {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, problem: 'not-json' };
  }

  if (!isRecord(value) || value.format !== BACKUP_FORMAT) {
    return { ok: false, problem: 'not-a-backup' };
  }
  if (typeof value.version !== 'number' || value.version > BACKUP_VERSION) {
    return { ok: false, problem: 'unsupported-version' };
  }

  if (value.app !== undefined && !isRecord(value.app)) {
    return { ok: false, problem: 'not-a-backup' };
  }
  const app = isRecord(value.app) ? value.app : {};
  const exportedAt = readNumber(value.exportedAt);
  const schemaVersion = readNumber(app.schemaVersion);
  const preferences = readPreferences(value.preferences);
  if (
    exportedAt === undefined ||
    schemaVersion === undefined ||
    preferences === undefined ||
    (app.name !== undefined && typeof app.name !== 'string')
  ) {
    return { ok: false, problem: 'not-a-backup' };
  }

  // A file written against a schema this build has never seen carries fields no
  // migration here can answer for. `backfillBackupTables` only moves forward.
  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    return { ok: false, problem: 'unsupported-schema' };
  }

  if (value.tables !== undefined && !isRecord(value.tables)) {
    return { ok: false, problem: 'not-a-backup' };
  }
  const structure = validateBackupTables(value.tables, schemaVersion);
  if (!structure.ok) {
    return {
      ok: false,
      problem: 'invalid-structure',
      flaws: structure.flaws,
      flawCount: structure.flawCount,
    };
  }

  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: value.version,
    exportedAt,
    app: {
      name: typeof app.name === 'string' ? app.name : 'FitTrack',
      schemaVersion,
    },
    preferences,
    tables: structure.tables,
  };

  const counts = backupCounts(backup);
  const total = totalRows(counts);
  // A file with the right shape and nothing in it would empty the app for
  // nothing. Refused as "empty" rather than run as a restore.
  if (total === 0 && Object.keys(backup.preferences).length === 0) {
    return { ok: false, problem: 'empty' };
  }

  return { ok: true, backup, counts, total, orphans: structure.orphans };
}
