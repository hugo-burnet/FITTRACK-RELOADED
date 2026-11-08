import type { BackupFile } from '@/lib/backup';

export const SYNC_CONTROL_KEY = '__device_sync_v1';
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
  recovery: BackupFile | null;
  lastSyncAt: number | null;
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
