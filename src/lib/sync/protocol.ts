import { BACKUP_TABLES, parseBackup, type BackupFile } from '@/lib/backup';
import {
  SYNC_CONTROL_KEY,
  SyncError,
  type AuthSession,
  type Cursor,
  type SyncState,
} from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Historical context may legitimately disappear; ownership parents must exist.
const OWNERSHIP_LINKS = new Set([
  'routineExercises:routineId',
  'routineSets:routineExerciseId',
  'workoutExercises:workoutId',
  'workoutSets:workoutExerciseId',
  'workoutSets:workoutId',
  'programWeeks:programId',
  'programScheduleRevisions:programId',
  'programScheduleEntries:revisionId',
]);
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function parseCursor(value: unknown): Cursor {
  if (
    !record(value) ||
    typeof value.generation !== 'string' ||
    !UUID.test(value.generation) ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 0
  )
    throw new SyncError('invalid_response');
  return { generation: value.generation, revision: value.revision as number };
}
export function validateSyncSnapshot(value: unknown): BackupFile {
  if (
    !record(value) ||
    !record(value.app) ||
    value.app.name !== 'FitTrack' ||
    value.app.schemaVersion !== 13 ||
    value.version !== 1 ||
    !record(value.tables) ||
    Object.keys(value.tables).length !== BACKUP_TABLES.length ||
    !BACKUP_TABLES.every((name) => Array.isArray((value.tables as Record<string, unknown>)[name]))
  ) {
    throw new SyncError('invalid_snapshot');
  }
  const parsed = parseBackup(JSON.stringify(value));
  if (
    !parsed.ok ||
    parsed.orphans.some((orphan) => OWNERSHIP_LINKS.has(`${orphan.table}:${orphan.field}`))
  )
    throw new SyncError('invalid_snapshot');
  const backup = parsed.backup;
  if (backup.tables.settings.some((row) => row.key === SYNC_CONTROL_KEY))
    throw new SyncError('invalid_snapshot');
  if (backup.tables.workouts.some((row) => row.status === 'active' && row.deletedAt === 0))
    throw new SyncError('active_remote');
  if (backup.tables.progressPhotos.length > 0) throw new SyncError('photos_unsupported');
  return { ...backup, preferences: {} };
}
export function parseSyncState(value: unknown): SyncState {
  const cursor = parseCursor(value);
  if (!record(value) || (cursor.revision === 0) !== (value.snapshot === null))
    throw new SyncError('invalid_response');
  return {
    ...cursor,
    snapshot: value.snapshot === null ? null : validateSyncSnapshot(value.snapshot),
  };
}
export function parseSession(value: unknown): AuthSession {
  if (
    !record(value) ||
    typeof value.authenticated !== 'boolean' ||
    typeof value.csrfToken !== 'string' ||
    !/^[a-zA-Z0-9]{64}$/.test(value.csrfToken)
  )
    throw new SyncError('invalid_response');
  parseCursor({ generation: value.generation, revision: 0 });
  if (value.authenticated) {
    if (
      !record(value.user) ||
      typeof value.user.id !== 'string' ||
      !/^[1-9][0-9]*$/.test(value.user.id) ||
      typeof value.user.username !== 'string' ||
      !/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(value.user.username)
    ) {
      throw new SyncError('invalid_response');
    }
  } else if (value.user !== null) throw new SyncError('invalid_response');
  return value as unknown as AuthSession;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (record(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
/** Tables are sets of rows; arrays inside a domain row retain their order. */
export async function snapshotHash(backup: BackupFile): Promise<string> {
  const tables = Object.fromEntries(
    BACKUP_TABLES.map((name) => [
      name,
      [...backup.tables[name]]
        .filter((row) => name !== 'settings' || row.key !== SYNC_CONTROL_KEY)
        .sort((a, b) => {
          const left = String(a.id ?? a.key),
            right = String(b.id ?? b.key);
          return left < right ? -1 : left > right ? 1 : 0;
        }),
    ]),
  );
  const bytes = new TextEncoder().encode(canonical({ app: backup.app, tables }));
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
