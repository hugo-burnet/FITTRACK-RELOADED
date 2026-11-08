import type { BackupFile } from '@/lib/backup';

/** Every settings row under this prefix belongs to this device: never exported, imported or synced. */
export const DEVICE_SYNC_PREFIX = '__device_sync_';
export const SYNC_CONTROL_KEY = '__device_sync_v1';
/** One row per copy: a single slot let the next replacement erase the only copy. */
export const SYNC_RECOVERY_PREFIX = '__device_sync_recovery_v1:';
export function isDeviceSyncKey(key: unknown): boolean {
  return typeof key === 'string' && key.startsWith(DEVICE_SYNC_PREFIX);
}
export const MAX_SYNC_BYTES = 16 * 1024 * 1024;
export interface Cursor {
  generation: string;
  revision: number;
}
export interface SyncState extends Cursor {
  snapshot: BackupFile | null;
}
export interface SyncUser {
  id: string;
  username: string;
}
export interface Principal extends SyncUser {
  origin: string;
}
export interface AuthSession {
  authenticated: boolean;
  user: SyncUser | null;
  generation: string;
  csrfToken: string;
}
export interface Anchor extends Cursor {
  hash: string;
}
export interface Publication {
  operationId: string;
  base: Cursor;
  snapshot: BackupFile;
}
export interface PendingPublication {
  body: Publication;
  hash: string;
}
export interface SyncControl {
  version: 1;
  enabled: boolean;
  epoch: string;
  installationId: string | null;
  owner: Principal | null;
  anchor: Anchor | null;
  pending: PendingPublication | null;
  /** Legacy single recovery slot, read for compatibility; new copies are separate rows. */
  recovery: BackupFile | null;
  lastSyncAt: number | null;
  /** Non-secret hint that an account was used here; opening Settings stays offline without it. */
  account: SyncUser | null;
}
export interface SyncRecoveryInfo {
  id: string;
  createdAt: number;
  /** Which copy was replaced: this device's data, or the server's. Null for the legacy slot. */
  source: 'device' | 'server' | null;
}
export interface SyncRecovery extends SyncRecoveryInfo {
  backup: BackupFile;
}
export interface SyncReview {
  epoch: string;
  owner: Principal;
  localHash: string;
  remote: SyncState;
  localCounts: { workouts: number; routines: number };
}
export class SyncError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'SyncError';
  }
}
export function samePrincipal(left: Principal | null, right: Principal): boolean {
  return left?.id === right.id && left.origin === right.origin;
}
