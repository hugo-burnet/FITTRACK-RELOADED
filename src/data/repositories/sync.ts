import Dexie from 'dexie';
import { db } from '@/data/db';
import { readSyncControl, suspendSyncControl } from '@/data/syncControl';
import { BACKUP_TABLES, type BackupFile } from '@/lib/backup';
import { decideSync } from '@/lib/sync/decision';
import {
  parseCursor,
  parseSyncState,
  snapshotHash,
  validateSyncSnapshot,
} from '@/lib/sync/protocol';
import {
  DEVICE_SYNC_PREFIX,
  SYNC_CONTROL_KEY,
  SYNC_RECOVERY_PREFIX,
  SyncError,
  samePrincipal,
  type Cursor,
  type PendingPublication,
  type Principal,
  type SyncControl,
  type SyncRecovery,
  type SyncRecoveryInfo,
  type SyncReview,
  type SyncState,
  type SyncUser,
} from '@/lib/sync/types';
import { buildBackup } from './backup';

const tables = () => BACKUP_TABLES.map((name) => db.table(name));
export async function getSyncControl(): Promise<SyncControl> {
  return readSyncControl((await db.settings.get(SYNC_CONTROL_KEY))?.value);
}
async function save(control: SyncControl): Promise<void> {
  await db.settings.put({ key: SYNC_CONTROL_KEY, value: control, updatedAt: Date.now() });
}
export async function enableSync(
  owner: Principal,
  installationId: string | null = null,
): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const control = await getSyncControl();
    if (control.owner !== null && !samePrincipal(control.owner, owner))
      throw new SyncError('account_mismatch');
    await save({ ...control, owner, installationId, enabled: true, epoch: crypto.randomUUID() });
  });
}
export async function disableSync(): Promise<void> {
  await db.transaction('rw', db.settings, async () =>
    save(suspendSyncControl((await db.settings.get(SYNC_CONTROL_KEY))?.value)),
  );
}
/** A hint, never a credential: it only decides whether opening Settings may ask the server. */
export async function rememberSyncAccount(account: SyncUser | null): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const control = await getSyncControl();
    const next = account && { id: account.id, username: account.username };
    if (JSON.stringify(control.account) !== JSON.stringify(next))
      await save({ ...control, account: next });
  });
}
const LEGACY_RECOVERY = 'legacy';
async function addRecovery(source: 'device' | 'server', backup: BackupFile): Promise<void> {
  const id = crypto.randomUUID();
  const value: SyncRecovery = { id, createdAt: Date.now(), source, backup };
  await db.settings.put({ key: `${SYNC_RECOVERY_PREFIX}${id}`, value, updatedAt: value.createdAt });
}
function recoveryRows() {
  return db.settings.where('key').startsWith(SYNC_RECOVERY_PREFIX).toArray();
}
/** Newest first. Copies are only removed by the person, never by a later replacement. */
export async function listSyncRecoveries(): Promise<SyncRecoveryInfo[]> {
  const control = await getSyncControl();
  const copies: SyncRecoveryInfo[] = (await recoveryRows()).map((row) => {
    const { id, createdAt, source } = row.value as SyncRecovery;
    return { id, createdAt, source };
  });
  if (control.recovery)
    copies.push({ id: LEGACY_RECOVERY, createdAt: control.recovery.exportedAt, source: null });
  return copies.sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? -1 : 1));
}
export async function getSyncRecovery(id: string): Promise<BackupFile | null> {
  if (id === LEGACY_RECOVERY) return (await getSyncControl()).recovery;
  const row = await db.settings.get(`${SYNC_RECOVERY_PREFIX}${id}`);
  return row ? (row.value as SyncRecovery).backup : null;
}
export async function deleteSyncRecovery(id: string): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    if (id === LEGACY_RECOVERY) await save({ ...(await getSyncControl()), recovery: null });
    else await db.settings.delete(`${SYNC_RECOVERY_PREFIX}${id}`);
  });
}
export async function hasActiveSyncWorkout(): Promise<boolean> {
  return (await db.workouts.where('status').equals('active').toArray()).some(
    (workout) => workout.deletedAt === 0,
  );
}
async function localSnapshot(): Promise<BackupFile> {
  return validateSyncSnapshot({ ...(await buildBackup()), preferences: {} });
}
// WebCrypto runs while Dexie keeps the transaction alive. All tables stay locked;
// no response can pass its comparison and then overwrite a concurrent DB write.
const hashInTransaction = (backup: BackupFile) => Dexie.waitFor(snapshotHash(backup));
function publication(snapshot: BackupFile, hash: string, remote: Cursor): PendingPublication {
  return {
    hash,
    body: {
      operationId: crypto.randomUUID(),
      base: { generation: remote.generation, revision: remote.revision },
      snapshot,
    },
  };
}
export type SyncPlan =
  | { kind: 'disabled' | 'paused' | 'same' }
  | { kind: 'publish'; epoch: string; pending: PendingPublication }
  | { kind: 'pull' | 'conflict'; review: SyncReview };

export async function prepareSync(
  owner: Principal,
  received: SyncState,
  reviewOnly = false,
): Promise<SyncPlan> {
  const remote = parseSyncState(received);
  return db.transaction('rw', tables(), async () => {
    const control = await getSyncControl();
    if (!control.enabled) return { kind: 'disabled' };
    if (!samePrincipal(control.owner, owner)) throw new SyncError('account_mismatch');
    if (await hasActiveSyncWorkout()) return { kind: 'paused' };
    const local = await localSnapshot();
    const localHash = await hashInTransaction(local);
    const review = {
      epoch: control.epoch,
      owner,
      localHash,
      remote,
      localCounts: {
        workouts: local.tables.workouts.filter((row) => row.deletedAt === 0).length,
        routines: local.tables.routines.filter((row) => row.deletedAt === 0).length,
      },
    };
    if (reviewOnly) return { kind: 'conflict', review };
    if (control.pending) {
      if (control.pending.body.base.generation !== remote.generation)
        return { kind: 'conflict', review };
      return { kind: 'publish', epoch: control.epoch, pending: control.pending };
    }
    const remoteHash = remote.snapshot === null ? null : await hashInTransaction(remote.snapshot);
    const kind = decideSync(control.anchor, localHash, remote, remoteHash);
    if (kind === 'push') {
      const pending = publication(local, localHash, remote);
      await save({ ...control, pending });
      return { kind: 'publish', epoch: control.epoch, pending };
    }
    if (kind === 'same') {
      await save({
        ...control,
        anchor: { generation: remote.generation, revision: remote.revision, hash: localHash },
        lastSyncAt: Date.now(),
      });
      return { kind: 'same' };
    }
    return { kind, review };
  });
}

export async function acknowledgePublication(
  owner: Principal,
  epoch: string,
  operationId: string,
  response: Cursor,
): Promise<boolean> {
  const cursor = parseCursor(response);
  return db.transaction('rw', db.settings, async () => {
    const control = await getSyncControl();
    const pending = control.pending;
    if (
      !control.enabled ||
      !samePrincipal(control.owner, owner) ||
      control.epoch !== epoch ||
      pending?.body.operationId !== operationId
    )
      return false;
    if (
      cursor.generation !== pending.body.base.generation ||
      cursor.revision !== pending.body.base.revision + 1
    ) {
      throw new SyncError('invalid_response');
    }
    await save({
      ...control,
      pending: null,
      anchor: { ...cursor, hash: pending.hash },
      lastSyncAt: Date.now(),
    });
    return true;
  });
}

/**
 * The server definitively refused this operation (another revision won, or the
 * generation changed). Resending the same body can never succeed and would
 * upload the whole snapshot on every poll; local data stays untouched and the
 * next check compares the copies instead.
 */
export async function rejectPublication(
  owner: Principal,
  epoch: string,
  operationId: string,
): Promise<boolean> {
  return db.transaction('rw', db.settings, async () => {
    const control = await getSyncControl();
    if (
      !control.enabled ||
      !samePrincipal(control.owner, owner) ||
      control.epoch !== epoch ||
      control.pending?.body.operationId !== operationId
    )
      return false;
    await save({ ...control, pending: null });
    return true;
  });
}

export async function resolveSyncReview(
  review: SyncReview,
  choice: 'push' | 'pull',
  received: SyncState,
): Promise<'queued' | 'applied'> {
  const remote = parseSyncState(received);
  if (
    remote.generation !== review.remote.generation ||
    remote.revision !== review.remote.revision ||
    (remote.snapshot === null) !== (review.remote.snapshot === null) ||
    (remote.snapshot !== null &&
      review.remote.snapshot !== null &&
      (await snapshotHash(remote.snapshot)) !== (await snapshotHash(review.remote.snapshot)))
  )
    throw new SyncError('stale_review');
  return db.transaction('rw', tables(), async () => {
    const control = await getSyncControl();
    if (
      !control.enabled ||
      control.epoch !== review.epoch ||
      !samePrincipal(control.owner, review.owner)
    )
      throw new SyncError('stale_review');
    if (await hasActiveSyncWorkout()) throw new SyncError('active_workout');
    const local = await localSnapshot();
    const hash = await hashInTransaction(local);
    if (hash !== review.localHash) throw new SyncError('stale_review');
    const epoch = crypto.randomUUID();
    if (choice === 'push') {
      if (remote.snapshot) await addRecovery('server', remote.snapshot);
      await save({ ...control, epoch, pending: publication(local, hash, remote) });
      return 'queued';
    }
    if (remote.snapshot === null) throw new SyncError('invalid_snapshot');
    await addRecovery('device', await buildBackup());
    const remoteHash = await hashInTransaction(remote.snapshot);
    // Clearing settings would also erase this device's consent and every recovery copy.
    const device = await db.settings.where('key').startsWith(DEVICE_SYNC_PREFIX).toArray();
    for (const name of BACKUP_TABLES) {
      await db.table(name).clear();
      if (remote.snapshot.tables[name].length > 0)
        await db.table(name).bulkPut(remote.snapshot.tables[name]);
    }
    if (device.length > 0) await db.settings.bulkPut(device);
    await save({
      ...control,
      epoch,
      pending: null,
      lastSyncAt: Date.now(),
      anchor: { generation: remote.generation, revision: remote.revision, hash: remoteHash },
    });
    return 'applied';
  });
}
