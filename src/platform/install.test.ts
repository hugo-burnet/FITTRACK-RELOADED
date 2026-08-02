import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isInstalled } from './install';

/**
 * The module holds the deferred event in module state, so every test needs a
 * clean one. `resetModules` + a re-import is the only honest way to get it —
 * mutating a private latch from the test would prove nothing about the real
 * boot path, which is exactly one `watchInstall()` per page load.
 */
async function freshModule() {
  vi.resetModules();
  return import('./install');
}

/**
 * jsdom fires real events, so the browser side is played straight: dispatch a
 * `beforeinstallprompt` carrying the two members Chrome puts on it.
 */
function fireInstallPrompt(userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>) {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  Object.assign(event, { prompt: vi.fn().mockResolvedValue(undefined), userChoice });
  window.dispatchEvent(event);
  return event as Event & { prompt: ReturnType<typeof vi.fn> };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('watchInstall', () => {
  it('n’a rien à proposer tant que le navigateur n’a rien offert', async () => {
    const mod = await freshModule();
    mod.watchInstall();

    expect(mod.isInstallAvailable()).toBe(false);
    expect(await mod.promptInstall()).toBe('unavailable');
  });

  it('retient l’événement et neutralise la barre native du navigateur', async () => {
    const mod = await freshModule();
    mod.watchInstall();

    const event = fireInstallPrompt(Promise.resolve({ outcome: 'accepted' }));

    // Sans preventDefault, Chrome affiche sa propre mini-barre et consomme
    // l'événement : prompt() lèverait ensuite.
    expect(event.defaultPrevented).toBe(true);
    expect(mod.isInstallAvailable()).toBe(true);
  });

  it('prévient ses abonnés quand une invite devient disponible', async () => {
    const mod = await freshModule();
    mod.watchInstall();
    const listener = vi.fn();
    mod.subscribeInstall(listener);

    fireInstallPrompt(Promise.resolve({ outcome: 'accepted' }));

    expect(listener).toHaveBeenCalled();
  });

  it('n’appelle plus un abonné désinscrit', async () => {
    const mod = await freshModule();
    mod.watchInstall();
    const listener = vi.fn();
    mod.subscribeInstall(listener)();

    fireInstallPrompt(Promise.resolve({ outcome: 'accepted' }));

    expect(listener).not.toHaveBeenCalled();
  });

  it('oublie l’invite quand l’app a été installée par le menu du navigateur', async () => {
    const mod = await freshModule();
    mod.watchInstall();
    fireInstallPrompt(Promise.resolve({ outcome: 'accepted' }));

    window.dispatchEvent(new Event('appinstalled'));

    expect(mod.isInstallAvailable()).toBe(false);
  });
});

describe('promptInstall', () => {
  it('rend « installed » quand l’utilisateur accepte', async () => {
    const mod = await freshModule();
    mod.watchInstall();
    const event = fireInstallPrompt(Promise.resolve({ outcome: 'accepted' }));

    expect(await mod.promptInstall()).toBe('installed');
    expect(event.prompt).toHaveBeenCalled();
  });

  it('rend « dismissed » quand l’utilisateur ferme la fenêtre', async () => {
    const mod = await freshModule();
    mod.watchInstall();
    fireInstallPrompt(Promise.resolve({ outcome: 'dismissed' }));

    expect(await mod.promptInstall()).toBe('dismissed');
  });

  it('consomme l’événement : une invite ne se rejoue pas', async () => {
    const mod = await freshModule();
    mod.watchInstall();
    fireInstallPrompt(Promise.resolve({ outcome: 'dismissed' }));

    await mod.promptInstall();

    expect(mod.isInstallAvailable()).toBe(false);
    expect(await mod.promptInstall()).toBe('unavailable');
  });

  it('rend « failed » et se vide quand le navigateur refuse d’ouvrir la fenêtre', async () => {
    const mod = await freshModule();
    mod.watchInstall();
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, {
      prompt: vi.fn().mockRejectedValue(new Error('already used')),
      userChoice: Promise.resolve({ outcome: 'accepted' as const }),
    });
    window.dispatchEvent(event);

    expect(await mod.promptInstall()).toBe('failed');
    expect(mod.isInstallAvailable()).toBe(false);
  });
});

describe('isInstalled', () => {
  /** jsdom n'implémente pas matchMedia : chaque test pose le monde qu'il veut. */
  function installMatchMedia(value: unknown) {
    Object.defineProperty(window, 'matchMedia', { value, configurable: true, writable: true });
  }

  afterEach(() => installMatchMedia(undefined));

  it('rend false plutôt que de lever quand matchMedia n’existe pas', () => {
    // Ce n'est pas un cas de figure théorique : c'est jsdom, donc toute la suite
    // de tests. Un appel non gardé ferait échouer chaque test qui monte l'écran
    // de réglages, pour une ligne qui ne parle que d'affichage.
    expect(window.matchMedia).toBeUndefined();
    expect(isInstalled()).toBe(false);
  });

  it('rend true quand l’app tourne depuis son icône', () => {
    installMatchMedia(vi.fn().mockReturnValue({ matches: true }));

    expect(isInstalled()).toBe(true);
  });

  it('rend false dans un onglet de navigateur', () => {
    installMatchMedia(vi.fn().mockReturnValue({ matches: false }));

    expect(isInstalled()).toBe(false);
  });
});
