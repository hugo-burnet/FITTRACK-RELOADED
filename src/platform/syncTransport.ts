import { Capacitor, registerPlugin } from '@capacitor/core';
import { record } from '@/lib/sync/protocol';
import { MAX_SYNC_BYTES, SyncError } from '@/lib/sync/types';

export type SyncPath =
  | '/api/auth/session'
  | '/api/auth/login'
  | '/api/auth/register'
  | '/api/auth/logout'
  | '/api/sync/state'
  | '/api/sync/publish';
export interface SyncTransport {
  origin: string;
  installationId?: string | null;
  request(path: SyncPath, body?: unknown): Promise<unknown>;
  cancel(): void;
  clear(): Promise<void>;
}
interface NativeSync {
  info(): Promise<{ origin: string; installationId: string }>;
  request(options: { path: SyncPath; body?: string }): Promise<{ status: number; body: string }>;
  cancel(): Promise<void>;
  clear(): Promise<void>;
}
const native = registerPlugin<NativeSync>('FitTrackSync');
const GET_PATHS = new Set(['/api/auth/session', '/api/sync/state']);
const POST_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/logout',
  '/api/sync/publish',
]);
export function syncMethod(path: string, body: unknown): 'GET' | 'POST' {
  if (body === undefined && GET_PATHS.has(path)) return 'GET';
  if (body !== undefined && POST_PATHS.has(path)) return 'POST';
  throw new SyncError('invalid_request');
}
export function checkedSyncOrigin(value: string): string {
  const url = new URL(value);
  if (
    url.origin !== value ||
    url.username ||
    url.password ||
    (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost'))
  ) {
    throw new SyncError('unavailable');
  }
  return value;
}
function decode(status: number, text: string): unknown {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new SyncError('invalid_response');
  }
  if (status < 200 || status >= 300) {
    throw new SyncError(
      record(value) && typeof value.error === 'string' ? value.error : `http_${status}`,
    );
  }
  return value;
}
function bodyText(body: unknown): string | undefined {
  if (body === undefined) return undefined;
  const text = JSON.stringify(body);
  if (new TextEncoder().encode(text).byteLength > MAX_SYNC_BYTES)
    throw new SyncError('request_too_large');
  return text;
}
async function limitedText(response: Response): Promise<string> {
  const limit = MAX_SYNC_BYTES + 8192;
  if (Number(response.headers.get('content-length')) > limit)
    throw new SyncError('response_too_large');
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let text = '',
    size = 0;
  try {
    while (true) {
      const item = await reader.read();
      if (item.done) break;
      size += item.value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new SyncError('response_too_large');
      }
      text += decoder.decode(item.value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
export function createWebSyncTransport(
  origin: string,
  fetcher: typeof fetch = fetch,
): SyncTransport {
  checkedSyncOrigin(origin);
  let csrf: string | null = null;
  const controllers = new Set<AbortController>();
  return {
    origin,
    async request(path, body) {
      const method = syncMethod(path, body);
      if (method === 'POST' && !csrf) throw new SyncError('csrf_required');
      const controller = new AbortController();
      controllers.add(controller);
      const timeout = setTimeout(() => controller.abort(), 25_000);
      try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (method === 'POST') {
          headers['Content-Type'] = 'application/json';
          headers['X-CSRFToken'] = csrf!;
        }
        const response = await fetcher(`${origin}${path}`, {
          method,
          headers,
          body: bodyText(body),
          signal: controller.signal,
          credentials: 'same-origin',
          cache: 'no-store',
          redirect: 'error',
          referrerPolicy: 'no-referrer',
        });
        const value = decode(response.status, await limitedText(response));
        if (path.startsWith('/api/auth/') && record(value) && typeof value.csrfToken === 'string')
          csrf = value.csrfToken;
        return value;
      } catch (error) {
        if (error instanceof SyncError) throw error;
        throw new SyncError('network');
      } finally {
        clearTimeout(timeout);
        controllers.delete(controller);
      }
    },
    cancel() {
      for (const controller of controllers) controller.abort();
    },
    async clear() {
      csrf = null;
    },
  };
}
export async function defaultSyncTransport(): Promise<SyncTransport> {
  if (Capacitor.isNativePlatform()) {
    if (Capacitor.getPlatform() !== 'android') throw new SyncError('unavailable');
    const { origin, installationId } = await native.info();
    if (origin) checkedSyncOrigin(origin);
    if (typeof installationId !== 'string' || !/^[a-f0-9-]{36}$/.test(installationId))
      throw new SyncError('unavailable');
    return {
      origin,
      installationId,
      async request(path, body) {
        if (!origin) throw new SyncError('unavailable');
        syncMethod(path, body);
        try {
          const response = await native.request({ path, body: bodyText(body) });
          return decode(response.status, response.body);
        } catch (error) {
          if (error instanceof SyncError) throw error;
          throw new SyncError('network');
        }
      },
      cancel() {
        void native.cancel().catch(() => {});
      },
      clear() {
        return native.clear();
      },
    };
  }
  // Pages stays local-only; a homelab build serves the client and API on one origin.
  if (!import.meta.env.DEV && import.meta.env.MODE !== 'homelab')
    throw new SyncError('unavailable');
  return createWebSyncTransport(window.location.origin);
}
