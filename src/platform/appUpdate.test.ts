import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `virtual:pwa-register` only exists once vite-plugin-pwa has run, so the module
 * under test reaches it through a dynamic import and the tests mock it. This is
 * the one place in `src/platform/` that mocks a module rather than a navigator
 * property, and the reason is that there is no real object to install: the
 * module is invented by the build.
 */
const registerSW = vi.fn();
vi.mock('virtual:pwa-register', () => ({ registerSW }));

/** The module latches its state, so each test gets its own copy. */
async function freshModule() {
  vi.resetModules();
  return import('./appUpdate');
}

/** jsdom has no serviceWorker; `watchAppUpdate` returns early without one. */
function installServiceWorker(present: boolean) {
  if (present) {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {},
      configurable: true,
      writable: true,
    });
    return;
  }
  // `delete` rather than `undefined`: the guard is an `in` check, and a
  // property set to undefined still answers true.
  Reflect.deleteProperty(navigator, 'serviceWorker');
}

/** Lets the dynamic import inside `watchAppUpdate` settle. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  registerSW.mockReset();
  installServiceWorker(false);
});

describe('watchAppUpdate', () => {
  it('n’enregistre rien quand le navigateur ne sait pas faire de service worker', async () => {
    installServiceWorker(false);
    const mod = await freshModule();

    mod.watchAppUpdate();
    await flush();

    expect(registerSW).not.toHaveBeenCalled();
    expect(mod.isUpdateAvailable()).toBe(false);
  });

  it('signale la version en attente et prévient ses abonnés', async () => {
    installServiceWorker(true);
    const mod = await freshModule();
    const listener = vi.fn();
    mod.subscribeAppUpdate(listener);

    mod.watchAppUpdate();
    await flush();
    // Le worker suivant est prêt et attend derrière celui qui tourne.
    registerSW.mock.calls[0]?.[0]?.onNeedRefresh?.();

    expect(mod.isUpdateAvailable()).toBe(true);
    expect(listener).toHaveBeenCalled();
  });

  it('ne signale rien tant qu’aucune version n’attend', async () => {
    installServiceWorker(true);
    const mod = await freshModule();

    mod.watchAppUpdate();
    await flush();

    expect(registerSW).toHaveBeenCalledOnce();
    expect(mod.isUpdateAvailable()).toBe(false);
  });
});

describe('isOfflineReady', () => {
  it('devient vrai au premier remplissage du précache', async () => {
    installServiceWorker(true);
    const mod = await freshModule();

    mod.watchAppUpdate();
    await flush();
    registerSW.mock.calls[0]?.[0]?.onOfflineReady?.();

    expect(mod.isOfflineReady()).toBe(true);
  });

  it('devient vrai aux visites suivantes, où onOfflineReady ne refire pas', async () => {
    installServiceWorker(true);
    const mod = await freshModule();

    mod.watchAppUpdate();
    await flush();
    registerSW.mock.calls[0]?.[0]?.onRegisteredSW?.('sw.js', { active: {} });

    expect(mod.isOfflineReady()).toBe(true);
  });

  it('reste faux tant que le worker enregistré n’est pas actif', async () => {
    installServiceWorker(true);
    const mod = await freshModule();

    mod.watchAppUpdate();
    await flush();
    registerSW.mock.calls[0]?.[0]?.onRegisteredSW?.('sw.js', undefined);

    expect(mod.isOfflineReady()).toBe(false);
  });
});

describe('applyUpdate', () => {
  it('bascule sur le worker en attente et recharge', async () => {
    installServiceWorker(true);
    const apply = vi.fn().mockResolvedValue(undefined);
    registerSW.mockReturnValue(apply);
    const mod = await freshModule();

    mod.watchAppUpdate();
    await flush();
    registerSW.mock.calls[0]?.[0]?.onNeedRefresh?.();
    await mod.applyUpdate();

    // `true` est le rechargement : la page qui tourne est faite des modules de
    // l'ancien bundle, la laisser debout devant un nouveau précache est ce qui
    // produit un chunk demandé et introuvable.
    expect(apply).toHaveBeenCalledWith(true);
    expect(mod.isUpdateAvailable()).toBe(false);
  });

  it('ne fait rien quand aucun worker n’a été enregistré', async () => {
    installServiceWorker(false);
    const mod = await freshModule();

    mod.watchAppUpdate();
    await flush();

    await expect(mod.applyUpdate()).resolves.toBeUndefined();
  });
});
