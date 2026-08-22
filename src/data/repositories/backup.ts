import { db } from '@/data/db';
import {
  BACKUP_FORMAT,
  BACKUP_TABLES,
  BACKUP_VERSION,
  backfillBackupTables,
  backupCounts,
  type BackupCounts,
  type BackupFile,
  type BackupRow,
} from '@/lib/backup';

/**
 * The whole account, out and back in.
 *
 * The one door in `data/` that does not know what it is carrying: every other
 * repository here speaks about routines, sessions or records, and this one
 * speaks about *tables*. That is the point — a backup that understood the
 * business would need a new clause every time the schema grows one, and the
 * clause nobody remembers to write is exactly the data nobody gets back.
 *
 * The CSV export (`csvExport.ts`) is untouched and stays the format for going
 * *elsewhere*; this is the format for coming back here (cf. `lib/backup`).
 */

/** Everything the app stores in `localStorage`. One namespace, no list. */
const PREFERENCE_PREFIX = 'fittrack:';

function readPreferences(): Record<string, string> {
  const preferences: Record<string, string> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key === null || !key.startsWith(PREFERENCE_PREFIX)) continue;
    const value = localStorage.getItem(key);
    if (value !== null) preferences[key] = value;
  }
  return preferences;
}

function writePreferences(preferences: Record<string, string>): void {
  const stale: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key !== null && key.startsWith(PREFERENCE_PREFIX)) stale.push(key);
  }
  for (const key of stale) localStorage.removeItem(key);
  for (const [key, value] of Object.entries(preferences)) {
    // Only this app's namespace: a backup must not be a way to write anything
    // it likes into the browser's storage.
    if (key.startsWith(PREFERENCE_PREFIX)) localStorage.setItem(key, value);
  }
}

/** The Dexie table of a backup name — the one place the two vocabularies meet. */
function tableOf(name: (typeof BACKUP_TABLES)[number]) {
  return db.table<BackupRow>(name);
}

export async function buildBackup(now = Date.now()): Promise<BackupFile> {
  const rows = await db.transaction(
    'r',
    BACKUP_TABLES.map(tableOf),
    async () => Promise.all(BACKUP_TABLES.map(async (name) => tableOf(name).toArray())),
  );

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    app: { name: 'FitTrack', schemaVersion: db.verno },
    preferences: readPreferences(),
    tables: Object.fromEntries(
      BACKUP_TABLES.map((name, index) => [name, rows[index] ?? []]),
    ) as BackupFile['tables'],
  };
}

/**
 * Puts the file back, and nothing else.
 *
 * **A replacement, not a merge.** Every table is emptied before it is written:
 * restoring is "this phone is now that phone", and a merge would have to invent
 * an answer for a row that exists on both sides with different values — the
 * kind of guess that silently duplicates a year of sessions. The whole thing
 * runs in one Dexie transaction, so a failure halfway leaves the app exactly as
 * it was rather than half-restored.
 *
 * `photoBlobs` is left alone: the format does not carry binaries, and wiping a
 * table a backup cannot refill would destroy what it was meant to protect.
 *
 * **The rows are brought up to the running schema first.** Dexie's `upgrade()`
 * blocks fire on a change of *version number*, which a restore does not cause —
 * so an older file's rows would otherwise land in a current database having
 * been seen by no migration at all, then or ever. `backfillBackupTables` is the
 * one place that answers for it; `app.schemaVersion` is what tells it how far
 * back to reach, and the file has said so since the format shipped.
 *
 * The caller reloads the app afterwards. Live queries would catch up on their
 * own, but the preferences are read once into module memory (the announcer, the
 * theme), and a restored setting that only takes effect at the next launch is
 * a setting that looks broken.
 */
export async function restoreBackup(backup: BackupFile): Promise<BackupCounts> {
  const tables = backfillBackupTables(backup.tables, backup.app.schemaVersion);

  await db.transaction('rw', BACKUP_TABLES.map(tableOf), async () => {
    for (const name of BACKUP_TABLES) {
      const table = tableOf(name);
      await table.clear();
      const rows = tables[name] ?? [];
      if (rows.length > 0) await table.bulkPut(rows);
    }
  });

  writePreferences(backup.preferences);
  return backupCounts(backup);
}
