import {
  BACKUP_FORMAT,
  BACKUP_TABLES,
  BACKUP_VERSION,
  backupCounts,
  totalRows,
  type BackupCounts,
  type BackupFile,
  type BackupRow,
  type BackupTable,
} from './types';

/**
 * Reading a backup file back, and refusing the ones that are not.
 *
 * Pure and total: it never throws and never touches the database. A restore
 * wipes everything the app holds, so the decision to run one is taken on a
 * value that has already been read and counted — never on a file that is
 * opened halfway through the write.
 *
 * **Refuses more than it repairs.** A missing table becomes an empty one (the
 * format grows, and an older file simply has fewer of them), but a file that is
 * not JSON, not a FitTrack backup, or written by a *newer* format is rejected
 * outright: guessing at a layout this app does not know would restore a
 * plausible-looking half of someone's history.
 */
export type BackupProblem =
  | 'not-json'
  | 'not-a-backup'
  /** Written by a later version of the app than this one. */
  | 'unsupported-version'
  | 'empty';

export type BackupParse =
  | { ok: true; backup: BackupFile; counts: BackupCounts; total: number }
  | { ok: false; problem: BackupProblem };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Rows that are not objects are dropped: a table is a list of records. */
function readRows(value: unknown): BackupRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord);
}

function readPreferences(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const preferences: Record<string, string> = {};
  for (const [key, stored] of Object.entries(value)) {
    if (typeof stored === 'string') preferences[key] = stored;
  }
  return preferences;
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

  const tablesValue = isRecord(value.tables) ? value.tables : {};
  const tables = Object.fromEntries(
    BACKUP_TABLES.map((table) => [table, readRows(tablesValue[table])]),
  ) as Record<BackupTable, BackupRow[]>;

  const app = isRecord(value.app) ? value.app : {};
  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: value.version,
    exportedAt: typeof value.exportedAt === 'number' ? value.exportedAt : 0,
    app: {
      name: typeof app.name === 'string' ? app.name : 'FitTrack',
      schemaVersion: typeof app.schemaVersion === 'number' ? app.schemaVersion : 0,
    },
    preferences: readPreferences(value.preferences),
    tables,
  };

  const counts = backupCounts(backup);
  const total = totalRows(counts);
  // A file with the right shape and nothing in it would empty the app for
  // nothing. Refused as "empty" rather than run as a restore.
  if (total === 0 && Object.keys(backup.preferences).length === 0) {
    return { ok: false, problem: 'empty' };
  }

  return { ok: true, backup, counts, total };
}
