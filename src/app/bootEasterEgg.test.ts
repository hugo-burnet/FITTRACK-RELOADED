import { describe, expect, it, vi } from 'vitest';
import { BOOT_EASTER_EGG_KEY, selectBootVariant } from './bootEasterEgg';

const DAY_MS = 24 * 60 * 60 * 1000;

function memoryStorage(initial: string | null = null) {
  let value = initial;

  return {
    storage: {
      getItem: vi.fn((key: string) => (key === BOOT_EASTER_EGG_KEY ? value : null)),
      setItem: vi.fn((key: string, next: string) => {
        if (key === BOOT_EASTER_EGG_KEY) value = next;
      }),
    },
    read: () => value,
  };
}

describe('selectBootVariant', () => {
  it('schedules a future date without showing the console on first launch', () => {
    const now = 1_800_000_000_000;
    const state = memoryStorage();

    expect(selectBootVariant(state.storage, now, 0)).toBe('normal');
    expect(Number(state.read())).toBe(now + 14 * DAY_MS);
  });

  it('keeps the normal boot before the stored date', () => {
    const now = 1_800_000_000_000;
    const state = memoryStorage(String(now + DAY_MS));

    expect(selectBootVariant(state.storage, now, 0.5)).toBe('normal');
    expect(state.storage.setItem).not.toHaveBeenCalled();
  });

  it('shows the console once when due and immediately schedules the next date', () => {
    const now = 1_800_000_000_000;
    const state = memoryStorage(String(now - 1));

    expect(selectBootVariant(state.storage, now, 0.999_999)).toBe('console');
    expect(Number(state.read())).toBe(now + 28 * DAY_MS);
  });

  it('falls back to the normal boot when storage is unavailable', () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      setItem: vi.fn(),
    };

    expect(selectBootVariant(storage, 1_800_000_000_000, 0)).toBe('normal');
  });
});
