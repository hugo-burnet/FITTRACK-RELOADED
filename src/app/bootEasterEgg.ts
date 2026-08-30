export type BootVariant = 'normal' | 'console';

export const BOOT_EASTER_EGG_KEY = 'fittrack.bootEasterEggAfter';

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_DELAY_DAYS = 14;
const DELAY_DAY_COUNT = 15;

type BootStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function getBootStorage(
  readStorage: () => BootStorage = () => window.localStorage,
): BootStorage | null {
  try {
    return readStorage();
  } catch {
    return null;
  }
}

export function scheduleNextBootEasterEgg(
  storage: BootStorage | null,
  now = Date.now(),
  random = Math.random(),
) {
  if (!storage) return;

  try {
    const delayDays = MIN_DELAY_DAYS + Math.floor(random * DELAY_DAY_COUNT);
    storage.setItem(BOOT_EASTER_EGG_KEY, String(now + delayDays * DAY_MS));
  } catch {
    // Storage is an enhancement: boot must still reach the app when it is blocked.
  }
}

export function selectBootVariant(
  storage: BootStorage | null,
  now = Date.now(),
  random = Math.random(),
): BootVariant {
  if (!storage) return 'normal';

  try {
    const nextAt = Number(storage.getItem(BOOT_EASTER_EGG_KEY));

    if (!Number.isFinite(nextAt) || nextAt <= 0) {
      scheduleNextBootEasterEgg(storage, now, random);
      return 'normal';
    }

    if (now < nextAt) return 'normal';

    return 'console';
  } catch {
    return 'normal';
  }
}

export function holdBootOpening(
  durationMs: number,
  shouldSkip: () => Promise<boolean>,
  onFullOpening: () => void,
): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      onFullOpening();
      resolve();
    }, durationMs);

    void shouldSkip().then(
      (skip) => {
        if (!skip) return;
        clearTimeout(timer);
        resolve();
      },
      () => {},
    );
  });
}
