import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { BACKUP_TABLES } from '@/lib/backup';
import { SYNC_CONTROL_KEY, type Principal } from '@/lib/sync/types';
import { resetDb } from '@/test/resetDb';
import { syncGeneration as generation, syncSnapshot } from '@/test/syncSnapshot';
import { buildBackup, restoreBackup } from './backup';
import {
  acknowledgePublication,
  deleteSyncRecovery,
  disableSync,
  enableSync,
  getSyncControl,
  getSyncRecovery,
  listSyncRecoveries,
  prepareSync,
  rejectPublication,
  rememberSyncAccount,
  resolveSyncReview,
} from './sync';

const owner: Principal = { id: '1', username: 'alice', origin: 'https://fittrack.example' };
const empty = { generation, revision: 0, snapshot: null };
async function seed() {
  const backup = syncSnapshot();
  for (const name of BACKUP_TABLES) await db.table(name).bulkPut(backup.tables[name]);
}
beforeEach(async () => {
  await resetDb();
  localStorage.clear();
  await seed();
});

describe('device sync repository', () => {
  it('starts off and never includes device consent in an export', async () => {
    expect((await getSyncControl()).enabled).toBe(false);
    expect((await prepareSync(owner, empty)).kind).toBe('disabled');
    await enableSync(owner);
    expect((await buildBackup()).tables.settings.some((row) => row.key === SYNC_CONTROL_KEY)).toBe(
      false,
    );
  });
  it('persists an exact idempotent publication across retry and concurrent cycles', async () => {
    await enableSync(owner);
    const [first, second] = await Promise.all([
      prepareSync(owner, empty),
      prepareSync(owner, empty),
    ]);
    expect(first.kind).toBe('publish');
    expect(second.kind).toBe('publish');
    if (first.kind !== 'publish' || second.kind !== 'publish')
      throw new Error('Expected publications');
    expect(first.pending).toEqual(second.pending);
    const retried = await prepareSync(owner, {
      generation,
      revision: 1,
      snapshot: first.pending.body.snapshot,
    });
    expect(retried.kind === 'publish' && retried.pending).toEqual(first.pending);
    expect(first.pending.body.snapshot.preferences).toEqual({});
  });
  it('invalidates late acknowledgements when off and resumes the same operation only after opt-in', async () => {
    await enableSync(owner);
    const prepared = await prepareSync(owner, empty);
    if (prepared.kind !== 'publish') throw new Error('Expected publication');
    await disableSync();
    expect(
      await acknowledgePublication(owner, prepared.epoch, prepared.pending.body.operationId, {
        generation,
        revision: 1,
      }),
    ).toBe(false);
    expect((await getSyncControl()).anchor).toBeNull();
    await enableSync(owner);
    const retry = await prepareSync(owner, empty);
    expect(retry.kind === 'publish' && retry.pending).toEqual(prepared.pending);
  });
  it('blocks another account/origin and preserves the original binding after logout', async () => {
    await enableSync(owner);
    await disableSync();
    await expect(enableSync({ ...owner, id: '2' })).rejects.toMatchObject({
      code: 'account_mismatch',
    });
    await expect(enableSync({ ...owner, origin: 'https://other.example' })).rejects.toMatchObject({
      code: 'account_mismatch',
    });
    expect((await db.routines.get('r-1'))?.name).toBe('Poussée');
  });
  it('pauses both reads-to-publish and resolutions during a local active workout', async () => {
    await enableSync(owner);
    await db.workouts.update('w-1', { status: 'active' });
    expect((await prepareSync(owner, empty)).kind).toBe('paused');
    expect((await getSyncControl()).pending).toBeNull();
  });
  it('records the sent snapshot as anchor even if local edits arrive before its acknowledgement', async () => {
    await enableSync(owner);
    const prepared = await prepareSync(owner, empty);
    if (prepared.kind !== 'publish') throw new Error('Expected publication');
    await db.routines.update('r-1', { name: 'New local edit' });
    expect(
      await acknowledgePublication(owner, prepared.epoch, prepared.pending.body.operationId, {
        generation,
        revision: 1,
      }),
    ).toBe(true);
    const next = await prepareSync(owner, {
      generation,
      revision: 1,
      snapshot: prepared.pending.body.snapshot,
    });
    expect(next.kind).toBe('publish');
    if (next.kind !== 'publish') throw new Error('Expected next publication');
    expect(next.pending.body.operationId).not.toBe(prepared.pending.body.operationId);
    expect(next.pending.body.snapshot.tables.routines[0]!.name).toBe('New local edit');
  });
  it('refuses applying a review after edits, disabling or a newly active workout', async () => {
    await enableSync(owner);
    const remote = { generation, revision: 1, snapshot: syncSnapshot() };
    remote.snapshot.tables.routines[0]!.name = 'Server';
    const plan = await prepareSync(owner, remote);
    if (plan.kind !== 'conflict') throw new Error('Expected initial conflict');
    await db.routines.update('r-1', { name: 'Changed after review' });
    await expect(resolveSyncReview(plan.review, 'pull', remote)).rejects.toMatchObject({
      code: 'stale_review',
    });
    expect((await db.routines.get('r-1'))?.name).toBe('Changed after review');
    const fresh = await prepareSync(owner, remote);
    if (fresh.kind !== 'conflict') throw new Error('Expected conflict');
    await db.workouts.update('w-1', { status: 'active' });
    await expect(resolveSyncReview(fresh.review, 'pull', remote)).rejects.toMatchObject({
      code: 'active_workout',
    });
    await db.workouts.update('w-1', { status: 'completed' });
    await disableSync();
    await expect(resolveSyncReview(fresh.review, 'pull', remote)).rejects.toMatchObject({
      code: 'stale_review',
    });
  });
  it('refuses a stale remote cursor at confirmation', async () => {
    await enableSync(owner);
    const remote = { generation, revision: 1, snapshot: syncSnapshot() };
    remote.snapshot.tables.routines[0]!.name = 'Server';
    const plan = await prepareSync(owner, remote);
    if (plan.kind !== 'conflict') throw new Error('Expected conflict');
    await expect(
      resolveSyncReview(plan.review, 'push', { ...remote, revision: 2 }),
    ).rejects.toMatchObject({ code: 'stale_review' });
    expect((await getSyncControl()).pending).toBeNull();
  });
  it('keeps a recovery copy and device preferences before explicitly applying remote data', async () => {
    localStorage.setItem('fittrack:theme', 'dark');
    await enableSync(owner);
    const remote = { generation, revision: 1, snapshot: syncSnapshot() };
    remote.snapshot.tables.routines[0]!.name = 'Server';
    remote.snapshot.preferences['fittrack:theme'] = 'light';
    const plan = await prepareSync(owner, remote);
    if (plan.kind !== 'conflict') throw new Error('Expected conflict');
    expect(await resolveSyncReview(plan.review, 'pull', remote)).toBe('applied');
    expect((await db.routines.get('r-1'))?.name).toBe('Server');
    expect(localStorage.getItem('fittrack:theme')).toBe('dark');
    const [copy] = await listSyncRecoveries();
    const recovery = await getSyncRecovery(copy!.id);
    expect(copy!.source).toBe('device');
    expect(recovery?.tables.routines[0]!.name).toBe('Poussée');
    expect(recovery?.preferences['fittrack:theme']).toBe('dark');
    expect((await prepareSync(owner, remote)).kind).toBe('same');
  });
  it('keeps the remote copy before an explicit server replacement and never copies device consent', async () => {
    await enableSync(owner);
    const remote = { generation, revision: 1, snapshot: syncSnapshot() };
    remote.snapshot.tables.routines[0]!.name = 'Server';
    const plan = await prepareSync(owner, remote);
    if (plan.kind !== 'conflict') throw new Error('Expected conflict');
    expect(await resolveSyncReview(plan.review, 'push', remote)).toBe('queued');
    const [copy] = await listSyncRecoveries();
    expect(copy!.source).toBe('server');
    expect((await getSyncRecovery(copy!.id))?.tables.routines[0]!.name).toBe('Server');
    expect((await getSyncControl()).pending?.body.base.revision).toBe(1);
  });
  it('drops a publication the server refused, so the next check compares instead of resending', async () => {
    await enableSync(owner);
    const prepared = await prepareSync(owner, empty);
    if (prepared.kind !== 'publish') throw new Error('Expected publication');
    expect(await rejectPublication(owner, prepared.epoch, prepared.pending.body.operationId)).toBe(
      true,
    );
    expect((await getSyncControl()).pending).toBeNull();
    const remote = { generation, revision: 1, snapshot: syncSnapshot() };
    remote.snapshot.tables.routines[0]!.name = 'Other device';
    expect((await prepareSync(owner, remote)).kind).toBe('conflict');
    expect((await db.routines.get('r-1'))?.name).toBe('Poussée');
  });
  it('ignores a refusal for an operation that is no longer the pending one', async () => {
    await enableSync(owner);
    const prepared = await prepareSync(owner, empty);
    if (prepared.kind !== 'publish') throw new Error('Expected publication');
    await disableSync();
    expect(await rejectPublication(owner, prepared.epoch, prepared.pending.body.operationId)).toBe(
      false,
    );
    expect((await getSyncControl()).pending).toEqual(prepared.pending);
  });
  it('keeps every recovery copy across successive replacements, outside exports', async () => {
    await enableSync(owner);
    const first = { generation, revision: 1, snapshot: syncSnapshot() };
    first.snapshot.tables.routines[0]!.name = 'Server v1';
    const conflict = await prepareSync(owner, first);
    if (conflict.kind !== 'conflict') throw new Error('Expected conflict');
    await resolveSyncReview(conflict.review, 'pull', first);
    const second = { generation, revision: 2, snapshot: syncSnapshot() };
    second.snapshot.tables.routines[0]!.name = 'Server v2';
    const pull = await prepareSync(owner, second);
    if (pull.kind !== 'pull') throw new Error('Expected pull');
    await resolveSyncReview(pull.review, 'pull', second);
    const copies = await listSyncRecoveries();
    expect(copies.map((copy) => copy.source)).toEqual(['device', 'device']);
    const names = await Promise.all(
      copies.map(async (copy) => (await getSyncRecovery(copy.id))?.tables.routines[0]!.name),
    );
    expect(names.sort()).toEqual(['Poussée', 'Server v1']);
    const exported = await buildBackup();
    expect(
      exported.tables.settings.some((row) => String(row.key).startsWith('__device_sync')),
    ).toBe(false);
    await restoreBackup(syncSnapshot());
    expect(await listSyncRecoveries()).toHaveLength(2);
    await deleteSyncRecovery(copies[0]!.id);
    expect((await listSyncRecoveries()).map((copy) => copy.id)).toEqual([copies[1]!.id]);
  });
  it('refuses a remote snapshot that carries any device-only row', async () => {
    await enableSync(owner);
    const remote = { generation, revision: 1, snapshot: syncSnapshot() };
    remote.snapshot.tables.settings.push({
      key: '__device_sync_recovery_v1:x',
      value: {},
      updatedAt: 1,
    });
    await expect(prepareSync(owner, remote)).rejects.toMatchObject({ code: 'invalid_snapshot' });
  });
  it('remembers the signed-in account only as a non-secret hint', async () => {
    await rememberSyncAccount({ id: '1', username: 'alice' });
    expect((await getSyncControl()).account).toEqual({ id: '1', username: 'alice' });
    expect(JSON.stringify(await buildBackup())).not.toContain('alice');
    await rememberSyncAccount(null);
    expect((await getSyncControl()).account).toBeNull();
  });
  it('manual restore disables sync, rejects imported consent, and invalidates old responses', async () => {
    await enableSync(owner);
    const prepared = await prepareSync(owner, empty);
    if (prepared.kind !== 'publish') throw new Error('Expected publication');
    const imported = syncSnapshot();
    imported.tables.settings.push({
      key: SYNC_CONTROL_KEY,
      value: { enabled: true, owner: { id: '2' } },
      updatedAt: 1,
    });
    await restoreBackup(imported);
    const control = await getSyncControl();
    expect(control.enabled).toBe(false);
    expect(control.owner).toEqual(owner);
    expect(control.pending).toBeNull();
    expect(
      await acknowledgePublication(owner, prepared.epoch, prepared.pending.body.operationId, {
        generation,
        revision: 1,
      }),
    ).toBe(false);
  });
});
