import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { BACKUP_TABLES } from '@/lib/backup';
import { getSyncControl } from '@/data/repositories/sync';
import { resetDb } from '@/test/resetDb';
import { syncGeneration as generation, syncSnapshot } from '@/test/syncSnapshot';
import { SyncError, type Publication } from '@/lib/sync/types';
import { SyncCoordinator } from './sync';

const session = {
  authenticated: true,
  user: { id: '1', username: 'alice' },
  generation,
  csrfToken: 'x'.repeat(64),
};
beforeEach(async () => {
  await resetDb();
  localStorage.clear();
  for (const name of BACKUP_TABLES) await db.table(name).bulkPut(syncSnapshot().tables[name]);
});
function server() {
  let saved: Publication | null = null;
  const request = vi.fn(async (path: string, body?: unknown): Promise<unknown> => {
    if (path === '/api/auth/session' || path === '/api/auth/login' || path === '/api/auth/register')
      return session;
    if (path === '/api/auth/logout') return { ...session, authenticated: false, user: null };
    if (path === '/api/sync/state')
      return { generation, revision: saved ? 1 : 0, snapshot: saved?.snapshot ?? null };
    if (path === '/api/sync/publish') {
      saved = body as Publication;
      return { generation, revision: 1, operationId: saved.operationId };
    }
    throw new Error('Unexpected route');
  });
  const transport = {
    origin: 'https://fittrack.example',
    request,
    cancel: vi.fn(),
    clear: vi.fn(async () => {}),
  };
  const factory = vi.fn(async () => transport);
  return { request, transport, factory };
}
describe('optional sync coordinator', () => {
  it('keeps the current process offline if saving the off switch fails', async () => {
    const api = server();
    const sync = new SyncCoordinator(api.factory);
    await sync.checkSession();
    await sync.activate();
    const saving = vi.spyOn(db.settings, 'put').mockRejectedValueOnce(new Error('Storage full'));
    await expect(sync.deactivate()).rejects.toBeDefined();
    saving.mockRestore();
    expect((await getSyncControl()).enabled).toBe(true);
    api.request.mockClear();
    await sync.cycle();
    expect(api.request).not.toHaveBeenCalled();
  });
  it('never even initializes the network transport without opt-in', async () => {
    const api = server();
    const sync = new SyncCoordinator(api.factory);
    await sync.hydrate();
    await sync.cycle();
    expect(api.factory).not.toHaveBeenCalled();
    expect(api.request).not.toHaveBeenCalled();
    expect(sync.getSnapshot().enabled).toBe(false);
  });
  it.each(['login', 'register'] as const)(
    '%s at any time preserves local history and never activates sync',
    async (action) => {
      const api = server();
      const sync = new SyncCoordinator(api.factory);
      await sync.authenticate(action, {
        username: 'alice',
        password: 'secret-not-stored',
        ...(action === 'register' ? { invitation: 'private' } : {}),
      });
      expect(sync.getSnapshot().user?.username).toBe('alice');
      expect((await getSyncControl()).enabled).toBe(false);
      expect(api.request.mock.calls.map((call) => call[0])).toEqual([
        '/api/auth/session',
        `/api/auth/${action}`,
      ]);
      expect(await db.workouts.toArray()).toHaveLength(1);
      expect(JSON.stringify(await db.settings.toArray())).not.toContain('secret-not-stored');
    },
  );
  it('uploads only after explicit activation, and stops all further cycles when disabled', async () => {
    const api = server();
    const sync = new SyncCoordinator(api.factory);
    await sync.checkSession();
    await sync.activate();
    expect(api.request.mock.calls.some((call) => call[0] === '/api/sync/publish')).toBe(true);
    expect((await getSyncControl()).anchor?.revision).toBe(1);
    await sync.deactivate();
    const count = api.request.mock.calls.length;
    await sync.cycle();
    expect(api.request).toHaveBeenCalledTimes(count);
    expect(await db.workouts.toArray()).toHaveLength(1);
  });
  it('retains the exact publication after a lost reply, including across a new coordinator', async () => {
    const api = server();
    const sync = new SyncCoordinator(api.factory);
    const original = api.transport.request;
    let loseReply = true;
    api.transport.request = vi.fn(async (path, body) => {
      const result = await original(path, body);
      if (path === '/api/sync/publish' && loseReply) {
        loseReply = false;
        throw new SyncError('network');
      }
      return result;
    });
    await sync.checkSession();
    await sync.activate();
    const queued = (await getSyncControl()).pending;
    expect(queued).not.toBeNull();
    const restarted = new SyncCoordinator(api.factory);
    await restarted.hydrate();
    await restarted.cycle();
    const sends = api.request.mock.calls.filter((call) => call[0] === '/api/sync/publish');
    expect(sends).toHaveLength(2);
    expect(sends[0]![1]).toEqual(sends[1]![1]);
    expect((await getSyncControl()).pending).toBeNull();
  });
  it('refuses an identity changed by another tab before reading any snapshots', async () => {
    const api = server();
    const sync = new SyncCoordinator(api.factory);
    await sync.checkSession();
    await sync.activate();
    api.request.mockImplementation(async () => ({
      ...session,
      user: { id: '2', username: 'bob' },
    }));
    api.request.mockClear();
    await sync.cycle();
    expect(api.request.mock.calls.map((call) => call[0])).toEqual(['/api/auth/session']);
    expect(sync.getSnapshot().error).toBe('account_mismatch');
    expect((await getSyncControl()).enabled).toBe(false);
  });
  it('an off switch while a response is in flight prevents publication and late UI updates', async () => {
    const api = server();
    const sync = new SyncCoordinator(api.factory);
    await sync.checkSession();
    await sync.activate();
    let finish: (value: unknown) => void = () => {};
    api.request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const running = sync.cycle();
    await vi.waitFor(() =>
      expect(api.request).toHaveBeenLastCalledWith('/api/auth/session', undefined),
    );
    await sync.deactivate();
    const count = api.request.mock.calls.length;
    finish(session);
    await running;
    expect(api.request).toHaveBeenCalledTimes(count);
    expect(sync.getSnapshot().enabled).toBe(false);
    expect(sync.getSnapshot().phase).toBe('local');
  });
  it('rejects a pinned confirmation after polling sees newer local changes', async () => {
    const api = server();
    const sync = new SyncCoordinator(api.factory);
    await sync.checkSession();
    await sync.activate();
    const remote = { generation, revision: 2, snapshot: syncSnapshot() };
    remote.snapshot.tables.routines[0]!.name = 'Server';
    const original = api.request.getMockImplementation()!;
    api.request.mockImplementation((path, body) =>
      path === '/api/sync/state' ? Promise.resolve(remote) : original(path, body),
    );
    await sync.cycle();
    const pinned = sync.getSnapshot().review!;
    await db.routines.update('r-1', { name: 'Edited while confirmation open' });
    await sync.cycle();
    await expect(sync.resolve('pull', pinned)).rejects.toMatchObject({ code: 'stale_review' });
    expect((await db.routines.get('r-1'))?.name).toBe('Edited while confirmation open');
  });
  it('does not send any HTTP after OS restoration onto another Android installation', async () => {
    const api = server();
    const native = Object.assign(api.transport, { installationId: 'installation-A' });
    const sync = new SyncCoordinator(api.factory);
    await sync.checkSession();
    await sync.activate();
    native.installationId = 'installation-B';
    api.request.mockClear();
    const restored = new SyncCoordinator(api.factory);
    await restored.hydrate();
    await restored.cycle();
    expect(api.request).not.toHaveBeenCalled();
    expect((await getSyncControl()).enabled).toBe(false);
    expect(restored.getSnapshot().error).toBe('device_restored');
  });
});
