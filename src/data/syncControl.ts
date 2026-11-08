import { record, parseCursor } from '@/lib/sync/protocol';
import { SyncError, type SyncControl } from '@/lib/sync/types';

export function freshSyncControl(): SyncControl {
  return {
    version: 1,
    enabled: false,
    epoch: crypto.randomUUID(),
    installationId: null,
    owner: null,
    anchor: null,
    pending: null,
    recovery: null,
    lastSyncAt: null,
    account: null,
  };
}
/** Corrupt device metadata must never silently discard an ownership binding. */
export function readSyncControl(value: unknown): SyncControl {
  if (value === undefined) return freshSyncControl();
  try {
    if (
      !record(value) ||
      value.version !== 1 ||
      typeof value.enabled !== 'boolean' ||
      typeof value.epoch !== 'string' ||
      !/^[a-f0-9-]{36}$/.test(value.epoch) ||
      !('pending' in value) ||
      !('anchor' in value) ||
      !('recovery' in value)
    )
      throw new Error();
    if (
      value.owner !== null &&
      (!record(value.owner) ||
        typeof value.owner.origin !== 'string' ||
        typeof value.owner.id !== 'string' ||
        typeof value.owner.username !== 'string')
    )
      throw new Error();
    if (value.enabled && value.owner === null) throw new Error();
    if (value.anchor !== null) {
      parseCursor(value.anchor);
      if (
        !record(value.anchor) ||
        typeof value.anchor.hash !== 'string' ||
        !/^[a-f0-9]{64}$/.test(value.anchor.hash)
      )
        throw new Error();
    }
    if (value.pending !== null) {
      if (
        !record(value.pending) ||
        !record(value.pending.body) ||
        typeof value.pending.hash !== 'string' ||
        !/^[a-f0-9]{64}$/.test(value.pending.hash) ||
        typeof value.pending.body.operationId !== 'string' ||
        !/^[a-f0-9-]{36}$/.test(value.pending.body.operationId) ||
        !record(value.pending.body.snapshot)
      )
        throw new Error();
      parseCursor(value.pending.body.base);
    }
    if (
      value.installationId !== undefined &&
      value.installationId !== null &&
      typeof value.installationId !== 'string'
    )
      throw new Error();
    if (
      value.account !== undefined &&
      value.account !== null &&
      (!record(value.account) ||
        typeof value.account.id !== 'string' ||
        typeof value.account.username !== 'string')
    )
      throw new Error();
    return {
      ...value,
      installationId: value.installationId ?? null,
      account: value.account ?? null,
    } as unknown as SyncControl;
  } catch {
    throw new SyncError('device_state_invalid');
  }
}
export function suspendSyncControl(value: unknown, imported = false): SyncControl {
  const control = readSyncControl(value);
  return {
    ...control,
    enabled: false,
    epoch: crypto.randomUUID(),
    ...(imported ? { anchor: null, pending: null, lastSyncAt: null } : {}),
  };
}
