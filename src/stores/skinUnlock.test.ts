import { describe, expect, it, vi } from 'vitest';
import { BOOT_EASTER_EGG_MAX_DELAY_DAYS } from '@/app/bootEasterEgg';
import {
  isTty1Unlocked,
  SEASONED_AFTER_DAYS,
  TTY1_UNLOCK_KEY,
  unlockTty1,
  unlockTty1IfInUse,
  unlockTty1IfSeasoned,
  unlockTty1WhenSeasoned,
} from './skinUnlock';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

function memoryStorage(initial: string | null = null) {
  let value = initial;

  return {
    storage: {
      getItem: vi.fn((key: string) => (key === TTY1_UNLOCK_KEY ? value : null)),
      setItem: vi.fn((key: string, next: string) => {
        if (key === TTY1_UNLOCK_KEY) value = next;
      }),
    },
    read: () => value,
  };
}

const throwingStorage = {
  getItem: vi.fn(() => {
    throw new DOMException('blocked', 'SecurityError');
  }),
  setItem: vi.fn(() => {
    throw new DOMException('quota', 'QuotaExceededError');
  }),
};

describe('TTY1 unlock', () => {
  it('starts locked', () => {
    expect(isTty1Unlocked(memoryStorage().storage)).toBe(false);
  });

  it('stays unlocked once unlocked, under the key the app reads at startup', () => {
    const state = memoryStorage();

    unlockTty1(state.storage);

    expect(isTty1Unlocked(state.storage)).toBe(true);
    expect(state.read()).toBe('1');
    expect(TTY1_UNLOCK_KEY).toBe('fittrack.tty1Unlocked');
  });

  it.each(['0', 'true', 'oui', ''])('does not read %j as unlocked', (stored) => {
    expect(isTty1Unlocked(memoryStorage(stored).storage)).toBe(false);
  });

  it('survives a storage that is missing, blocked, or full', () => {
    expect(isTty1Unlocked(null)).toBe(false);
    expect(() => unlockTty1(null)).not.toThrow();

    expect(isTty1Unlocked(throwingStorage)).toBe(false);
    expect(() => unlockTty1(throwingStorage)).not.toThrow();
  });
});

describe('unlocking by seniority', () => {
  it('unlocks once the first use is more than thirty days old', () => {
    const state = memoryStorage();

    unlockTty1IfSeasoned(state.storage, NOW - SEASONED_AFTER_DAYS * DAY_MS - 1, NOW);

    expect(isTty1Unlocked(state.storage)).toBe(true);
  });

  it('keeps TTY1 locked up to and including the thirtieth day', () => {
    const state = memoryStorage();

    unlockTty1IfSeasoned(state.storage, NOW - 29 * DAY_MS - 23 * 3_600_000, NOW);
    unlockTty1IfSeasoned(state.storage, NOW - SEASONED_AFTER_DAYS * DAY_MS, NOW);

    expect(isTty1Unlocked(state.storage)).toBe(false);
    expect(state.storage.setItem).not.toHaveBeenCalled();
  });

  it('ignores a first use in the future, as a clock set back would give', () => {
    const state = memoryStorage();

    unlockTty1IfSeasoned(state.storage, NOW + 40 * DAY_MS, NOW);

    expect(isTty1Unlocked(state.storage)).toBe(false);
  });

  it.each([Number.NaN, Number.NEGATIVE_INFINITY])('ignores a first use of %s', (firstUseAt) => {
    const state = memoryStorage();

    unlockTty1IfSeasoned(state.storage, firstUseAt, NOW);

    expect(isTty1Unlocked(state.storage)).toBe(false);
  });

  it('stays quiet when storage is blocked', () => {
    expect(() => unlockTty1IfSeasoned(throwingStorage, 0, NOW)).not.toThrow();
    expect(() => unlockTty1IfSeasoned(null, 0, NOW)).not.toThrow();
  });

  it('asks for more days than the rare console can take to come due', () => {
    // The whole argument for unlocking at thirty days is that the console was due long before.
    // Lowering the threshold below the surprise's longest delay would break it without a sound.
    expect(SEASONED_AFTER_DAYS).toBeGreaterThan(BOOT_EASTER_EGG_MAX_DELAY_DAYS);
  });
});

describe('unlocking by use', () => {
  it('keeps TTY1 for whoever already wears it, as the version that shipped it open allowed', () => {
    const state = memoryStorage();

    unlockTty1IfInUse(state.storage, 'tty1');

    expect(isTty1Unlocked(state.storage)).toBe(true);
  });

  it.each(['dark', 'light'] as const)('does not unlock for the %s theme', (theme) => {
    const state = memoryStorage();

    unlockTty1IfInUse(state.storage, theme);

    expect(isTty1Unlocked(state.storage)).toBe(false);
    expect(state.storage.setItem).not.toHaveBeenCalled();
  });
});

describe('unlocking by seniority, from the database', () => {
  it('reads the first use and unlocks an old enough install', async () => {
    const state = memoryStorage();
    const readFirstUseAt = vi.fn(() => Promise.resolve(NOW - 90 * DAY_MS));

    await unlockTty1WhenSeasoned(state.storage, readFirstUseAt, NOW);

    expect(isTty1Unlocked(state.storage)).toBe(true);
  });

  it('leaves a young install locked', async () => {
    const state = memoryStorage();

    await unlockTty1WhenSeasoned(state.storage, () => Promise.resolve(NOW - 3 * DAY_MS), NOW);

    expect(isTty1Unlocked(state.storage)).toBe(false);
  });

  it('does not touch the database once TTY1 is unlocked', async () => {
    const state = memoryStorage('1');
    const readFirstUseAt = vi.fn(() => Promise.resolve(0));

    await unlockTty1WhenSeasoned(state.storage, readFirstUseAt, NOW);

    expect(readFirstUseAt).not.toHaveBeenCalled();
  });

  it('does nothing when the catalogue has not been seeded yet', async () => {
    const state = memoryStorage();

    await unlockTty1WhenSeasoned(state.storage, () => Promise.resolve(undefined), NOW);

    expect(isTty1Unlocked(state.storage)).toBe(false);
  });

  it('never makes the app fail to start when the database cannot be read', async () => {
    const state = memoryStorage();

    await expect(
      unlockTty1WhenSeasoned(state.storage, () => Promise.reject(new Error('closed')), NOW),
    ).resolves.toBeUndefined();
    expect(isTty1Unlocked(state.storage)).toBe(false);
  });
});
