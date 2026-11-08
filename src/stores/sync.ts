import {
  acknowledgePublication,
  disableSync,
  enableSync,
  getSyncControl,
  hasActiveSyncWorkout,
  prepareSync,
  resolveSyncReview,
} from '@/data/repositories/sync';
import { parseCursor, parseSession, parseSyncState, record } from '@/lib/sync/protocol';
import {
  samePrincipal,
  SyncError,
  type Principal,
  type SyncReview,
  type SyncUser,
} from '@/lib/sync/types';
import { defaultSyncTransport, type SyncTransport } from '@/platform/syncTransport';

export interface SyncView {
  phase:
    | 'local'
    | 'account'
    | 'checking'
    | 'sending'
    | 'synced'
    | 'remote'
    | 'conflict'
    | 'paused'
    | 'error';
  enabled: boolean;
  user: SyncUser | null;
  lastSyncAt: number | null;
  error: string | null;
  review: SyncReview | null;
}
const codeOf = (error: unknown) =>
  error instanceof SyncError ? error.code : 'storage_unavailable';
export class SyncCoordinator {
  private view: SyncView = {
    phase: 'local',
    enabled: false,
    user: null,
    lastSyncAt: null,
    error: null,
    review: null,
  };
  private listeners = new Set<() => void>();
  private transport: SyncTransport | null = null;
  private nonce = 0;
  private suspended = false;
  private running: Promise<void> | null = null;
  constructor(private factory: () => Promise<SyncTransport> = defaultSyncTransport) {}
  getSnapshot = (): SyncView => this.view;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private set(update: Partial<SyncView>) {
    this.view = { ...this.view, ...update };
    for (const listener of this.listeners) listener();
  }
  private async api() {
    if (!this.transport) this.transport = await this.factory();
    return this.transport;
  }
  async hydrate() {
    const control = await getSyncControl();
    this.set({ enabled: control.enabled, lastSyncAt: control.lastSyncAt });
  }
  async checkSession() {
    try {
      const api = await this.api();
      const session = parseSession(await api.request('/api/auth/session', undefined));
      this.set({
        user: session.user,
        phase: this.view.enabled ? this.view.phase : session.user ? 'account' : 'local',
        error: null,
      });
      return session;
    } catch (error) {
      this.set({ error: codeOf(error), phase: 'error' });
      throw error;
    }
  }
  async authenticate(action: 'login' | 'register', credentials: Record<string, string>) {
    await this.deactivate();
    try {
      const api = await this.api();
      await api.request('/api/auth/session', undefined);
      const session = parseSession(await api.request(`/api/auth/${action}`, credentials));
      this.set({ user: session.user, phase: 'account', error: null });
    } catch (error) {
      this.set({ error: codeOf(error), phase: 'error' });
      throw error;
    }
  }
  async deactivate() {
    this.suspended = true;
    this.nonce += 1;
    this.transport?.cancel();
    this.set({ enabled: false, phase: 'local', review: null, error: null });
    try {
      await disableSync();
    } catch {
      throw new SyncError('consent_not_saved');
    }
  }
  async activate() {
    if (!this.view.user) throw new SyncError('authentication_required');
    const api = await this.api();
    await enableSync({ ...this.view.user, origin: api.origin }, api.installationId ?? null);
    this.suspended = false;
    this.set({ enabled: true, error: null });
    await this.cycle();
  }
  async signOut() {
    await this.deactivate();
    const api = await this.api();
    try {
      await api.request('/api/auth/session', undefined);
      await api.request('/api/auth/logout', {});
      this.set({ user: null });
    } catch {
      this.set({ user: null, error: 'logout_incomplete', phase: 'error' });
      throw new SyncError('logout_incomplete');
    } finally {
      await api.clear();
    }
  }
  private async assertLive(nonce: number, owner: Principal, epoch: string) {
    const control = await getSyncControl();
    if (
      nonce !== this.nonce ||
      !control.enabled ||
      control.epoch !== epoch ||
      !samePrincipal(control.owner, owner)
    )
      throw new SyncError('cancelled');
    if (await hasActiveSyncWorkout()) throw new SyncError('active_workout');
  }
  cycle(): Promise<void> {
    if (this.suspended) return Promise.resolve();
    if (this.running) return this.running;
    const task = this.runCycle();
    this.running = task;
    void task.finally(() => {
      if (this.running === task) this.running = null;
    });
    return task;
  }
  private async runCycle() {
    const nonce = this.nonce;
    try {
      const control = await getSyncControl();
      if (!control.enabled || !control.owner) {
        if (nonce === this.nonce) this.set({ enabled: false, phase: 'local', review: null });
        return;
      }
      if (await hasActiveSyncWorkout()) {
        this.set({ enabled: true, phase: 'paused' });
        return;
      }
      const owner = control.owner;
      const api = await this.api();
      if (control.installationId !== (api.installationId ?? null)) {
        await this.deactivate();
        this.set({ phase: 'error', error: 'device_restored' });
        return;
      }
      await this.assertLive(nonce, owner, control.epoch);
      this.set({ enabled: true, phase: 'checking', error: null });
      const session = parseSession(await api.request('/api/auth/session', undefined));
      await this.assertLive(nonce, owner, control.epoch);
      if (!session.user || !samePrincipal(owner, { ...session.user, origin: api.origin })) {
        await this.deactivate();
        this.set({
          user: session.user,
          phase: 'error',
          error: session.user ? 'account_mismatch' : 'authentication_required',
        });
        return;
      }
      this.set({ user: session.user });
      const remote = parseSyncState(await api.request('/api/sync/state', undefined));
      await this.assertLive(nonce, owner, control.epoch);
      const plan = await prepareSync(owner, remote);
      if (nonce !== this.nonce) return;
      if (plan.kind === 'publish') {
        await this.assertLive(nonce, owner, plan.epoch);
        this.set({ phase: 'sending' });
        try {
          const result = await api.request('/api/sync/publish', plan.pending.body);
          if (!record(result) || result.operationId !== plan.pending.body.operationId)
            throw new SyncError('invalid_response');
          const accepted = await acknowledgePublication(
            owner,
            plan.epoch,
            plan.pending.body.operationId,
            parseCursor(result),
          );
          if (nonce !== this.nonce || !accepted) return;
          this.set({ phase: 'synced', review: null, lastSyncAt: Date.now() });
        } catch (error) {
          if (
            !(error instanceof SyncError) ||
            !['revision_conflict', 'generation_conflict', 'operation_conflict'].includes(error.code)
          )
            throw error;
          await this.assertLive(nonce, owner, plan.epoch);
          const latest = parseSyncState(await api.request('/api/sync/state', undefined));
          const conflict = await prepareSync(owner, latest, true);
          if (nonce === this.nonce && conflict.kind === 'conflict')
            this.set({ phase: 'conflict', review: conflict.review });
        }
      } else if (plan.kind === 'pull' || plan.kind === 'conflict')
        this.set({ phase: plan.kind === 'pull' ? 'remote' : 'conflict', review: plan.review });
      else
        this.set({
          phase: plan.kind === 'same' ? 'synced' : plan.kind === 'paused' ? 'paused' : 'local',
          ...(plan.kind === 'disabled' ? { enabled: false } : {}),
          review: null,
          lastSyncAt: (await getSyncControl()).lastSyncAt,
        });
    } catch (error) {
      if (nonce !== this.nonce || (error instanceof SyncError && error.code === 'cancelled'))
        return;
      this.set({
        phase: error instanceof SyncError && error.code === 'active_workout' ? 'paused' : 'error',
        error: codeOf(error),
      });
    }
  }
  async resolve(
    choice: 'push' | 'pull',
    review: SyncReview | null = this.view.review,
  ): Promise<'queued' | 'applied'> {
    if (!review) throw new SyncError('stale_review');
    const nonce = this.nonce;
    const api = await this.api();
    const session = parseSession(await api.request('/api/auth/session', undefined));
    if (!session.user || !samePrincipal(review.owner, { ...session.user, origin: api.origin }))
      throw new SyncError('account_mismatch');
    await this.assertLive(nonce, review.owner, review.epoch);
    const remote = parseSyncState(await api.request('/api/sync/state', undefined));
    await this.assertLive(nonce, review.owner, review.epoch);
    const result = await resolveSyncReview(review, choice, remote);
    this.set({ review: null, error: null, phase: result === 'applied' ? 'synced' : 'checking' });
    if (result === 'queued') await this.cycle();
    return result;
  }
}
export const syncCoordinator = new SyncCoordinator();
let watching = false;
export function watchSync(): void {
  if (watching) return;
  watching = true;
  const tick = () => {
    if (document.visibilityState !== 'hidden') void syncCoordinator.cycle();
  };
  void syncCoordinator
    .hydrate()
    .then(tick)
    .catch(() => {});
  window.addEventListener('online', tick);
  document.addEventListener('visibilitychange', tick);
  setInterval(tick, 30_000);
}
