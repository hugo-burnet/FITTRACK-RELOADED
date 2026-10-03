import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useBootClock } from './useBootClock';

describe('useBootClock', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('starts at zero and jumps from instant to instant, never in between', () => {
    const instants = [400, 1_000, 2_500];
    const { result } = renderHook(() => useBootClock(instants, false));

    expect(result.current).toBe(0);

    act(() => vi.advanceTimersByTime(399));
    expect(result.current).toBe(0);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(400);

    act(() => vi.advanceTimersByTime(599));
    expect(result.current).toBe(400);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe(1_000);

    act(() => vi.advanceTimersByTime(2_000));
    expect(result.current).toBe(2_500);
  });

  it('sets one timer per distinct instant, whatever order they were given in', () => {
    const instants = [2_000, 500, 2_000, 1_000];
    const { result } = renderHook(() => useBootClock(instants, false));

    expect(vi.getTimerCount()).toBe(3);

    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toBe(500);

    act(() => vi.advanceTimersByTime(500));
    expect(result.current).toBe(1_000);

    act(() => vi.advanceTimersByTime(1_000));
    expect(result.current).toBe(2_000);
  });

  it('is at the end already when everything is to be shown at once, and sets no timer', () => {
    const { result } = renderHook(() => useBootClock([400, 1_000], true));

    expect(result.current).toBe(Number.POSITIVE_INFINITY);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('cancels what is left of the clock when it goes away', () => {
    const { unmount } = renderHook(() => useBootClock([400, 1_000, 2_000], false));

    expect(vi.getTimerCount()).toBe(3);
    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
