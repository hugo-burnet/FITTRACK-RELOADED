export type BootVariant = 'normal' | 'console';

export const BOOT_EASTER_EGG_KEY = 'fittrack.bootEasterEggAfter';

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_DELAY_DAYS = 14;
const DELAY_DAY_COUNT = 15;

type BootStorage = Pick<Storage, 'getItem' | 'setItem'>;

function scheduleNext(storage: BootStorage, now: number, random: number) {
  const delayDays = MIN_DELAY_DAYS + Math.floor(random * DELAY_DAY_COUNT);
  storage.setItem(BOOT_EASTER_EGG_KEY, String(now + delayDays * DAY_MS));
}

export function selectBootVariant(
  storage: BootStorage,
  now = Date.now(),
  random = Math.random(),
): BootVariant {
  try {
    const nextAt = Number(storage.getItem(BOOT_EASTER_EGG_KEY));

    if (!Number.isFinite(nextAt) || nextAt <= 0) {
      scheduleNext(storage, now, random);
      return 'normal';
    }

    if (now < nextAt) return 'normal';

    scheduleNext(storage, now, random);
    return 'console';
  } catch {
    return 'normal';
  }
}
