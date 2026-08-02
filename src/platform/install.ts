/**
 * The "add to home screen" prompt, and knowing whether there is one to show.
 *
 * Chrome will not let a page open the install dialog on demand: it decides when
 * the app qualifies, fires `beforeinstallprompt`, and hands over an event that
 * the page must **keep** if it wants to prompt later. Miss that event and the
 * only remaining route is the browser menu — which is exactly the route the
 * roadmap asked us to replace with something visible.
 *
 * So this module is a latch, not a function: it starts listening before React
 * mounts (`watchInstall` is called from main.tsx), holds the event, and lets the
 * settings screen ask "is there one?" and "fire it".
 *
 * Everything here is a no-op on a browser that never fires the event — iOS
 * Safari, notably, where installing is a manual Share → "Sur l'écran d'accueil".
 * `docs/INSTALLATION.md` covers that by hand; the app does not pretend.
 */

/** Not in lib.dom: the event is Chromium-only and unstandardised. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export type InstallOutcome =
  | 'installed'
  /** The user closed the browser's dialog. Not a failure. */
  | 'dismissed'
  /** No stored event: the browser never offered, or the app is already installed. */
  | 'unavailable'
  | 'failed';

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function announce() {
  for (const listener of listeners) listener();
}

/**
 * Starts listening. Safe to call more than once; called once from main.tsx,
 * before `createRoot`, because the event can fire before the first render.
 */
export function watchInstall(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('beforeinstallprompt', (event) => {
    // Without preventDefault Chrome shows its own mini-infobar and consumes the
    // event, and `prompt()` later throws. This is the whole reason the module
    // has to exist before the UI does.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    announce();
  });

  // Installing through the browser menu never resolves our stored event, so
  // without this the settings row would keep offering an install that already
  // happened.
  window.addEventListener('appinstalled', () => {
    deferred = null;
    announce();
  });
}

/** For `useSyncExternalStore`. Returns the unsubscribe. */
export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isInstallAvailable(): boolean {
  return deferred !== null;
}

/**
 * True when the app is already running from its own icon rather than a browser
 * tab. `matchMedia` is probed rather than assumed: jsdom does not implement it,
 * and an unguarded call turns every test that mounts the settings screen red.
 */
export function isInstalled(): boolean {
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(display-mode: standalone)').matches;
}

export async function promptInstall(): Promise<InstallOutcome> {
  const event = deferred;
  if (event === null) return 'unavailable';

  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    // The event is single-use whatever the answer: Chrome refires
    // `beforeinstallprompt` later if the app still qualifies.
    deferred = null;
    announce();
    return outcome === 'accepted' ? 'installed' : 'dismissed';
  } catch {
    deferred = null;
    announce();
    return 'failed';
  }
}
