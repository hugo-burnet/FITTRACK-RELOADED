/**
 * Registering the service worker, and asking before replacing the running app.
 *
 * The danger this module is shaped around: a service worker that updates itself
 * silently. The Lot 0 notes already record the milder version of the problem —
 * GitHub Pages served a stale `index.html` for a few minutes after a deploy and
 * the tab kept showing the old bundle. A service worker turns those few minutes
 * into forever, because once one is installed the network is no longer what
 * decides which version runs.
 *
 * The plugin is therefore configured `registerType: 'prompt'` (vite.config.ts),
 * which is only half the fix: the other half is that something must actually
 * tell the user, or the new worker waits behind the old one indefinitely and the
 * app is frozen just as thoroughly, only quietly. `UpdateBanner` is that half.
 *
 * The counterpart risk — reloading under a live workout — is why this asks
 * rather than acts. Rule n°4: a set in progress survives everything.
 */

let applyFn: ((reload: boolean) => Promise<void>) | null = null;
let available = false;
let cached = false;
const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

/**
 * Registers the worker and starts watching for a successor.
 *
 * The import is dynamic on purpose. `virtual:pwa-register` is a module the
 * plugin invents at build time; a static import would make every test file that
 * transitively reaches this module depend on the plugin having run. Deferring it
 * to the one call site that wants a service worker keeps the rest of the app —
 * and the whole test suite — free of it.
 */
export function watchAppUpdate(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

  void import('virtual:pwa-register').then(({ registerSW }) => {
    applyFn = registerSW({
      onNeedRefresh() {
        available = true;
        announce();
      },
      onOfflineReady() {
        cached = true;
        announce();
      },
      onRegisteredSW(_url, registration) {
        // Fires on every load, not just the first. `onOfflineReady` only fires
        // the once, at the install that fills the precache, so on the second
        // visit onwards this is what proves the app has an offline copy.
        if (registration?.active != null) {
          cached = true;
          announce();
        }
      },
    });
  });
}

/** For `useSyncExternalStore`. Returns the unsubscribe. */
export function subscribeAppUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isUpdateAvailable(): boolean {
  return available;
}

/** True once a service worker holds a full copy of the app. */
export function isOfflineReady(): boolean {
  return cached;
}

/**
 * Hands over to the waiting worker and reloads onto it.
 *
 * The reload is the point, not a side effect: the running page is made of the
 * old bundle's modules, and leaving it up against a new precache is how you get
 * a chunk that no longer exists being requested by a route that still does.
 */
export async function applyUpdate(): Promise<void> {
  if (applyFn === null) return;
  available = false;
  announce();
  await applyFn(true);
}
