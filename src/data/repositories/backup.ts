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

/**
 * Replaces this app's preferences, or leaves them exactly as they were.
 *
 * `localStorage` has no transaction, and a quota error halfway through would
 * otherwise leave the app with the old preferences deleted and the new ones
 * half-written — the one state neither the file nor the phone ever described.
 * The previous block is held in memory and put back if any write refuses.
 */
function writePreferences(preferences: Record<string, string>): void {
  const previous = readPreferences();
  const stale = Object.keys(previous);

  const clear = () => {
    for (const key of stale) localStorage.removeItem(key);
  };

  try {
    clear();
    for (const [key, value] of Object.entries(preferences)) {
      // Only this app's namespace: a backup must not be a way to write anything
      // it likes into the browser's storage.
      if (key.startsWith(PREFERENCE_PREFIX)) localStorage.setItem(key, value);
    }
  } catch (error) {
    for (const key of Object.keys(preferences)) {
      if (key.startsWith(PREFERENCE_PREFIX)) localStorage.removeItem(key);
    }
    for (const [key, value] of Object.entries(previous)) localStorage.setItem(key, value);
    throw error;
  }
}

/** The Dexie table of a backup name — the one place the two vocabularies meet. */
function tableOf(name: (typeof BACKUP_TABLES)[number]) {
  return db.table<BackupRow>(name);
}

export async function buildBackup(now = Date.now()): Promise<BackupFile> {
  const rows = await db.transaction('r', BACKUP_TABLES.map(tableOf), async () =>
    Promise.all(BACKUP_TABLES.map(async (name) => tableOf(name).toArray())),
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
 * kind of guess that silently duplicates a year of sessions. Table replacement
 * runs in one Dexie transaction. Preferences are written before it commits so
 * a preference failure also aborts the database writes.
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

  const previousPreferences = readPreferences();
  let preferencesWritten = false;
  try {
    await db.transaction('rw', BACKUP_TABLES.map(tableOf), async () => {
      for (const name of BACKUP_TABLES) {
        const table = tableOf(name);
        await table.clear();
        const rows = tables[name] ?? [];
        if (rows.length > 0) await table.bulkPut(rows);
      }
      // Synchronous: a failure here rejects the still-open IndexedDB transaction.
      writePreferences(backup.preferences);
      preferencesWritten = true;
    });
  } catch (error) {
    // A database commit can itself fail after the preference write succeeded.
    if (preferencesWritten) writePreferences(previousPreferences);
    throw error;
  }
  return backupCounts(backup);
}
