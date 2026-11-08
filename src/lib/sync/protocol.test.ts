import { describe, expect, it } from 'vitest';
import { syncGeneration as generation, syncSnapshot as snapshot } from '@/test/syncSnapshot';
import { parseSyncState, parseSession, snapshotHash, validateSyncSnapshot } from './protocol';

describe('sync protocol', () => {
  it('validates a complete snapshot and rejects a broken domain row', () => {
    expect(validateSyncSnapshot(snapshot())).toEqual(snapshot());
    const broken = snapshot();
    broken.tables.routines[0]!.name = 42;
    expect(() => validateSyncSnapshot(broken)).toThrow();
  });
  it('refuses foreign references, active workouts, photos and device-control rows', () => {
    const orphan = snapshot();
    orphan.tables.routineExercises[0]!.routineId = 'missing';
    expect(() => validateSyncSnapshot(orphan)).toThrow();
    const active = snapshot();
    active.tables.workouts[0]!.status = 'active';
    expect(() => validateSyncSnapshot(active)).toThrow();
    const photos = snapshot();
    photos.tables.progressPhotos.push({ id: 'photo' });
    expect(() => validateSyncSnapshot(photos)).toThrow();
    const device = snapshot();
    device.tables.settings.push({
      key: '__device_sync_v1',
      value: { enabled: true },
      updatedAt: 1,
    });
    expect(() => validateSyncSnapshot(device)).toThrow();
  });
  it('preserves history whose optional routine context no longer exists', () => {
    const history = snapshot();
    history.tables.workouts[0]!.routineId = 'old-removed-routine';
    expect(validateSyncSnapshot(history).tables.workouts[0]!.routineId).toBe('old-removed-routine');
  });
  it('hashes data independently of date, device preferences, field and table-row order', async () => {
    const first = snapshot();
    const second = snapshot();
    second.exportedAt = 900;
    second.preferences['fittrack:theme'] = 'light';
    second.tables.settings.reverse();
    second.app = { schemaVersion: 13, name: 'FitTrack' };
    expect(await snapshotHash(second)).toBe(await snapshotHash(first));
    second.tables.routines[0]!.name = 'Changed';
    expect(await snapshotHash(second)).not.toBe(await snapshotHash(first));
  });
  it('checks cursors and the null-snapshot invariant', () => {
    expect(parseSyncState({ generation, revision: 0, snapshot: null }).revision).toBe(0);
    expect(
      parseSyncState({ generation, revision: 1, snapshot: snapshot() }).snapshot,
    ).toBeDefined();
    for (const revision of [-1, 0.2, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => parseSyncState({ generation, revision, snapshot: null })).toThrow();
    }
    expect(() => parseSyncState({ generation: 'invalid', revision: 0, snapshot: null })).toThrow();
    expect(() => parseSyncState({ generation, revision: 1, snapshot: null })).toThrow();
    expect(() => parseSyncState({ generation, revision: 0, snapshot: snapshot() })).toThrow();
  });
  it('validates anonymous and ordinary sessions, never accepts mismatched identities', () => {
    expect(
      parseSession({ authenticated: false, user: null, generation, csrfToken: 'x'.repeat(64) })
        .user,
    ).toBeNull();
    expect(
      parseSession({
        authenticated: true,
        user: { id: '1', username: 'alice' },
        generation,
        csrfToken: 'x'.repeat(64),
      }).user?.id,
    ).toBe('1');
    expect(() =>
      parseSession({ authenticated: true, user: null, generation, csrfToken: '' }),
    ).toThrow();
  });
});
