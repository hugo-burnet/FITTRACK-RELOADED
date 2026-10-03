import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BOOT_EASTER_EGG_KEY,
  getBootStorage,
  holdBootOpening,
  scheduleNextBootEasterEgg,
  selectBootVariant,
} from './bootEasterEgg';

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

  it('keeps a due date pending until the console finishes playing', () => {
    const now = 1_800_000_000_000;
    const state = memoryStorage(String(now - 1));

    expect(selectBootVariant(state.storage, now, 0.999_999)).toBe('console');
    expect(state.storage.setItem).not.toHaveBeenCalled();

    scheduleNextBootEasterEgg(state.storage, now, 0.999_999);
    expect(Number(state.read())).toBe(now + 28 * DAY_MS);
    expect(selectBootVariant(state.storage, now, 0)).toBe('normal');
  });

  it('replaces invalid metadata with a future date', () => {
    const now = 1_800_000_000_000;
    const state = memoryStorage('not-a-date');

    expect(selectBootVariant(state.storage, now, 0)).toBe('normal');
    expect(Number(state.read())).toBe(now + 14 * DAY_MS);
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

  it('always opens on the TTY1 console, without touching the surprise schedule', () => {
    const now = 1_800_000_000_000;
    const state = memoryStorage(String(now - 1));

    expect(selectBootVariant(state.storage, now, 0.5, 'tty1')).toBe('tty1');
    expect(state.storage.setItem).not.toHaveBeenCalled();
    expect(state.read()).toBe(String(now - 1));
  });

  it('plays the rare console again once TTY1 is left', () => {
    const now = 1_800_000_000_000;
    const state = memoryStorage(String(now - 1));

    expect(selectBootVariant(state.storage, now, 0.5, 'dark')).toBe('console');
  });

  it('opens on the TTY1 console even when storage is unavailable', () => {
    expect(selectBootVariant(null, 1_800_000_000_000, 0, 'tty1')).toBe('tty1');
  });

  it('also survives the localStorage getter itself throwing', () => {
    expect(
      getBootStorage(() => {
        throw new DOMException('blocked', 'SecurityError');
      }),
    ).toBeNull();
  });
});

describe('holdBootOpening', () => {
  afterEach(() => vi.useRealTimers());

  it('schedules the next console only after the full opening played', async () => {
    vi.useFakeTimers();
    const onFullOpening = vi.fn();
    const opening = holdBootOpening(3_360, () => Promise.resolve(false), onFullOpening);

    await vi.advanceTimersByTimeAsync(3_359);
    expect(onFullOpening).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await opening;
    expect(onFullOpening).toHaveBeenCalledOnce();
  });

  it('does not consume the console when an active workout skips the opening', async () => {
    vi.useFakeTimers();
    const onFullOpening = vi.fn();
    const opening = holdBootOpening(3_360, () => Promise.resolve(true), onFullOpening);

    await opening;
    await vi.runAllTimersAsync();
    expect(onFullOpening).not.toHaveBeenCalled();
  });
});
