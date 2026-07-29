import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { Workout } from '@/data/types';
import {
  periodBounds,
  type PeriodKey,
} from '@/lib/analytics/periods';
import { resetDb } from '@/test/resetDb';
import { useHistoricalPeriod } from './useHistoricalPeriod';

const openedAt = new Date(2026, 6, 29, 12).getTime();
const fourWeekBounds = periodBounds('4w', openedAt);

const archivedWorkout = (startedAt: number): Workout =>
  newEntity<Workout>({
    routineId: '',
    name: 'Upper A',
    status: 'completed',
    startedAt,
    endedAt: startedAt + 3_600_000,
    durationSeconds: 3_600,
    startedTimezoneOffsetMinutes: -new Date(startedAt).getTimezoneOffset(),
  });

describe('useHistoricalPeriod', () => {
  beforeEach(resetDb);

  it('charge la fenêtre et distingue un historique antérieur', async () => {
    const old = archivedWorkout(fourWeekBounds.from! - 1);
    const recent = archivedWorkout(fourWeekBounds.from! + 1);
    await db.workouts.bulkAdd([old, recent]);

    const { result } = renderHook(() =>
      useHistoricalPeriod('4w', openedAt),
    );

    expect(result.current).toEqual({ data: undefined, stale: true });

    await waitFor(() => expect(result.current.stale).toBe(false));

    expect(
      result.current.data?.workouts.map(({ workoutId }) => workoutId),
    ).toEqual([recent.id]);
    expect(result.current.data?.bounds).toEqual(fourWeekBounds);
    expect(result.current.data?.hasEarlierHistory).toBe(true);
  });

  it('charge tout l’historique sans inventer de fenêtre antérieure', async () => {
    const old = archivedWorkout(fourWeekBounds.from! - 1);
    const recent = archivedWorkout(fourWeekBounds.from! + 1);
    await db.workouts.bulkAdd([old, recent]);

    const { result } = renderHook(() =>
      useHistoricalPeriod('all', openedAt),
    );

    await waitFor(() => expect(result.current.stale).toBe(false));

    expect(
      result.current.data?.workouts.map(({ workoutId }) => workoutId),
    ).toEqual([old.id, recent.id]);
    expect(result.current.data?.bounds.from).toBeUndefined();
    expect(result.current.data?.hasEarlierHistory).toBe(false);
  });

  it('garde le snapshot précédent cohérent pendant un changement de période', async () => {
    const old = archivedWorkout(fourWeekBounds.from! - 1);
    const recent = archivedWorkout(fourWeekBounds.from! + 1);
    await db.workouts.bulkAdd([old, recent]);

    const { result, rerender } = renderHook(
      ({ period }: { period: PeriodKey }) =>
        useHistoricalPeriod(period, openedAt),
      { initialProps: { period: '4w' as PeriodKey } },
    );
    await waitFor(() => expect(result.current.stale).toBe(false));
    const previous = result.current.data;

    rerender({ period: 'all' });

    expect(result.current).toEqual({ data: previous, stale: true });

    await waitFor(() => expect(result.current.stale).toBe(false));
    expect(result.current.data?.bounds.from).toBeUndefined();
    expect(result.current.data?.workouts).toHaveLength(2);
  });
});
