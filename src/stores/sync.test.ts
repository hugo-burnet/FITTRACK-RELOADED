import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { BACKUP_TABLES } from '@/lib/backup';
import { enableSync, getSyncControl } from '@/data/repositories/sync';
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
  it('exports only the authenticated server account without enabling sync', async () => {
    const api = server();
    const original = api.request.getMockImplementation()!;
    api.request.mockImplementation(async (path, body) => path === '/api/account/export' ? {
      format: 'fittrack-personal-export', version: 1, exportedAt: new Date().toISOString(),
      account: session.user, state: { generation, revision: 1, snapshot: syncSnapshot() },
    } : original(path, body));
    const sync = new SyncCoordinator(api.factory);
    await sync.checkSession();
    const save = vi.fn<(text: string) => Promise<void>>(async () => {});
    await sync.exportAccount(save);
    expect(JSON.parse(save.mock.calls[0]![0]).account).toEqual(session.user);
    expect((await getSyncControl()).enabled).toBe(false);
    expect(api.request.mock.calls.some(([path]) => path === '/api/sync/publish')).toBe(false);
    expect(await db.workouts.count()).toBe(1);
  });
  it('discards a delayed export reply after sign out', async () => {
    const api = server();
    const original = api.request.getMockImplementation()!;
    let reply!: (value: unknown) => void;
    api.request.mockImplementation(async (path, body) => path === '/api/account/export'
      ? new Promise((resolve) => { reply = resolve; }) : original(path, body));
    const sync = new SyncCoordinator(api.factory);
    await sync.checkSession();
    const save = vi.fn(async () => {});
    const exporting = sync.exportAccount(save);
    const failure = expect(exporting).rejects.toMatchObject({ code: 'cancelled' });
    await vi.waitFor(() => expect(reply).toBeDefined());
    await sync.signOut();
    reply({ format: 'fittrack-personal-export', version: 1, exportedAt: new Date().toISOString(),
      account: session.user, state: { generation, revision: 1, snapshot: syncSnapshot() } });
    await failure;
    expect(save).not.toHaveBeenCalled();
  });
  it('exports a valid compact snapshot whose indentation would exceed the response limit', async () => {
    const api = server();
    const original = api.request.getMockImplementation()!;
    const snapshot = syncSnapshot();
    snapshot.tables.settings = [{ key: 'large-setting', value: Array<number>(1_500_000).fill(0), updatedAt: 1 }];
    api.request.mockImplementation(async (path, body) => path === '/api/account/export' ? {
      format: 'fittrack-personal-export', version: 1, exportedAt: new Date().toISOString(),
      account: session.user, state: { generation, revision: 1, snapshot },
    } : original(path, body));
    const sync = new SyncCoordinator(api.factory);
    const save = vi.fn<(text: string) => Promise<void>>(async () => {});
    await sync.exportAccount(save);
    expect(save).toHaveBeenCalledOnce();
    expect(new TextEncoder().encode(save.mock.calls[0]![0]).length).toBeLessThan(16 * 1024 * 1024);
  });
  it('deletes the account with sync disabled and preserves all local workouts', async () => {
    const api = server();
    const original = api.request.getMockImplementation()!;
    api.request.mockImplementation(async (path, body) => path === '/api/account/delete'
      ? { ...session, authenticated: false, user: null } : original(path, body));
    const sync = new SyncCoordinator(api.factory);
    await sync.checkSession();
    await sync.deleteAccount('synthetic-password', 'alice');
    expect(sync.getSnapshot().user).toBeNull();
    expect((await getSyncControl()).enabled).toBe(false);
    expect(await db.workouts.count()).toBe(1);
    expect(api.request).toHaveBeenCalledWith('/api/account/delete', {
      password: 'synthetic-password', confirmation: 'alice',
    });
    expect(api.transport.clear).toHaveBeenCalled();
  });
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
  it('sends nothing once the off switch lands during the last check before publishing', async () => {
    const api = server();
    const sync = new SyncCoordinator(api.factory);
    await sync.checkSession();
    await enableSync({ id: '1', username: 'alice', origin: api.transport.origin });
    const log: string[] = [];
    const original = api.request.getMockImplementation()!;
    api.request.mockImplementation((path, body) => {
      log.push(path);
      return original(path, body);
    });
    // hasActiveSyncWorkout() is the last await before the upload; the third read
    // after the state response is the pre-send check.
    const where = db.workouts.where.bind(db.workouts);
    let reads = 0;
    vi.spyOn(db.workouts, 'where').mockImplementation(((index: string) => {
      if (log.includes('/api/sync/state') && ++reads === 3) {
        log.push('off');
        void sync.deactivate();
      }
      return where(index);
    }) as typeof db.workouts.where);
    await sync.cycle();
    expect(log).toContain('off');
    expect(log).not.toContain('/api/sync/publish');
    expect(sync.getSnapshot().phase).toBe('local');
  });
  it('an off switch in another tab cancels this tab and stops its next request', async () => {
    const api = server();
    const tab = server();
    const here = new SyncCoordinator(tab.factory);
    const other = new SyncCoordinator(api.factory);
    const stop = here.listen();
    try {
      await other.checkSession();
      await other.activate();
      let finish: (value: unknown) => void = () => {};
      tab.request.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
      const running = here.cycle();
      await vi.waitFor(() =>
        expect(tab.request).toHaveBeenLastCalledWith('/api/auth/session', undefined),
      );
      const count = tab.request.mock.calls.length;
      await other.deactivate();
      await vi.waitFor(() => expect(tab.transport.cancel).toHaveBeenCalled());
      finish(session);
      await running;
      expect(tab.request).toHaveBeenCalledTimes(count);
      expect(here.getSnapshot().enabled).toBe(false);
    } finally {
      stop();
    }
  });
  it('a listening tab is not cancelled by its own off announcement', async () => {
    const api = server();
    const original = api.request.getMockImplementation()!;
    // Slow replies leave time for the broadcast to be delivered mid-request.
    api.request.mockImplementation(async (path, body) => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return original(path, body);
    });
    const sync = new SyncCoordinator(api.factory);
    const stop = sync.listen();
    try {
      await sync.authenticate('login', { username: 'alice', password: 'not-stored' });
      expect(sync.getSnapshot().user?.username).toBe('alice');
      expect(api.transport.cancel).not.toHaveBeenCalled();
    } finally {
      stop();
    }
  });
  it('uploads a refused publication once, then shows the conflict without resending it', async () => {
    const api = server();
    const remote = syncSnapshot();
    remote.tables.routines[0]!.name = 'Other device';
    let revision = 0;
    api.request.mockImplementation(async (path: string) => {
      if (path === '/api/auth/session') return session;
      if (path === '/api/sync/state')
        return revision === 0
          ? { generation, revision: 0, snapshot: null }
          : { generation, revision, snapshot: remote };
      if (path === '/api/sync/publish') {
        revision = 1;
        throw new SyncError('revision_conflict');
      }
      throw new Error('Unexpected route');
    });
    const sync = new SyncCoordinator(api.factory);
    await sync.checkSession();
    await sync.activate();
    expect(sync.getSnapshot().phase).toBe('conflict');
    await sync.cycle();
    await sync.cycle();
    expect(api.request.mock.calls.filter((call) => call[0] === '/api/sync/publish')).toHaveLength(
      1,
    );
    expect(sync.getSnapshot().phase).toBe('conflict');
    expect((await db.routines.get('r-1'))?.name).toBe('Poussée');
  });
  it('opening the screen contacts nobody until an account was used on this device', async () => {
    const api = server();
    const sync = new SyncCoordinator(api.factory);
    await sync.open();
    expect(api.factory).not.toHaveBeenCalled();
    await sync.authenticate('login', { username: 'alice', password: 'not-stored' });
    api.request.mockClear();
    const reopened = new SyncCoordinator(api.factory);
    await reopened.open();
    expect(api.request.mock.calls.map((call) => call[0])).toEqual(['/api/auth/session']);
    expect(reopened.getSnapshot().user?.username).toBe('alice');
    await reopened.signOut();
    api.request.mockClear();
    await new SyncCoordinator(api.factory).open();
    expect(api.request).not.toHaveBeenCalled();
  });
  it('activation confirms the session again instead of trusting a remembered account', async () => {
    const api = server();
    const sync = new SyncCoordinator(api.factory);
    await sync.authenticate('login', { username: 'alice', password: 'not-stored' });
    api.request.mockImplementation(async () => ({ ...session, authenticated: false, user: null }));
    await expect(sync.activate()).rejects.toMatchObject({ code: 'authentication_required' });
    expect((await getSyncControl()).enabled).toBe(false);
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
