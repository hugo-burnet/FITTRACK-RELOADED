import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRestTimer } from './restTimer';

const NOW = 1_800_000_000_000;

describe('restTimer.shift', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    useRestTimer.getState().stop();
    useRestTimer.getState().start('set-1', 120);
    vi.setSystemTime(NOW + 30_000); // 30 s into a 2 min rest: 90 s left
  });

  afterEach(() => {
    useRestTimer.getState().stop();
    vi.useRealTimers();
  });

  it('adds fifteen seconds to the rest in progress, on the scale of the whole rest', () => {
    useRestTimer.getState().shift('set-1', 15);

    // Start and end move together: the bar steps back by fifteen seconds of a two-minute rest,
    // instead of being redrawn against a new length.
    const { endsAt, startedAt, seconds } = useRestTimer.getState();
    expect(endsAt).toBe(NOW + 135_000);
    expect(startedAt).toBe(NOW + 15_000);
    expect(seconds).toBe(120);
  });

  it('takes fifteen seconds off the rest in progress', () => {
    useRestTimer.getState().shift('set-1', -15);

    expect(useRestTimer.getState().endsAt).toBe(NOW + 105_000);
    expect(useRestTimer.getState().startedAt).toBe(NOW - 15_000);
    expect(useRestTimer.getState().seconds).toBe(120);
  });

  it('never moves the start past now: what cannot be rewound lengthens the rest', () => {
    vi.setSystemTime(NOW + 5_000); // 5 s elapsed, fifteen to add

    useRestTimer.getState().shift('set-1', 15);

    // A start in the future would make the saved rest unreadable after a reload (restSnapshot).
    expect(useRestTimer.getState().startedAt).toBe(NOW + 5_000);
    expect(useRestTimer.getState().endsAt).toBe(NOW + 135_000);
    expect(useRestTimer.getState().seconds).toBe(130);
  });

  it('ends the rest now when there is less left than it takes, never before now', () => {
    vi.setSystemTime(NOW + 110_000); // 10 s left

    useRestTimer.getState().shift('set-1', -15);

    // The rest ends as an elapsed rest does: the deadline is now, the bar's own timer finishes it.
    expect(useRestTimer.getState().endsAt).toBe(NOW + 110_000);
    expect(useRestTimer.getState().setId).toBe('set-1');
  });

  it('ignores a set that is not resting', () => {
    const before = useRestTimer.getState().endsAt;

    useRestTimer.getState().shift('set-2', 15);

    expect(useRestTimer.getState().endsAt).toBe(before);
  });

  it('does nothing when no rest is running', () => {
    useRestTimer.getState().stop();

    useRestTimer.getState().shift('set-1', 15);

    expect(useRestTimer.getState().setId).toBeNull();
    expect(useRestTimer.getState().endsAt).toBe(0);
  });

  it('cannot revive a rest that is already over', () => {
    vi.setSystemTime(NOW + 125_000); // the deadline has passed, the bar has not cleared it yet
    const before = useRestTimer.getState().endsAt;

    useRestTimer.getState().shift('set-1', 15);

    expect(useRestTimer.getState().endsAt).toBe(before);
  });
});
