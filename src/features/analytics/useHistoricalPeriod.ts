import { useLiveQuery } from 'dexie-react-hooks';
import { listHistoricalWorkouts } from '@/data/repositories/historicalWorkouts';
import { listCompletedWorkoutTimestamps } from '@/data/repositories/history';
import type { HistoricalWorkout } from '@/lib/historyProjection';
import {
  periodBounds,
  type PeriodBounds,
  type PeriodKey,
} from '@/lib/analytics/periods';

export interface HistoricalPeriodData {
  bounds: PeriodBounds;
  workouts: HistoricalWorkout[];
  hasEarlierHistory: boolean;
}

export interface HistoricalPeriodResult {
  data: HistoricalPeriodData | undefined;
  stale: boolean;
}

interface LoadedHistoricalPeriod {
  requestKey: string;
  data: HistoricalPeriodData;
}

export function useHistoricalPeriod(
  period: PeriodKey,
  openedAt: number,
): HistoricalPeriodResult {
  const bounds = periodBounds(period, openedAt);
  const { from, to } = bounds;
  const requestKey = `${from ?? 'all'}:${to}`;
  const loaded = useLiveQuery(async (): Promise<LoadedHistoricalPeriod> => {
    const [workouts, allStarts] = await Promise.all([
      listHistoricalWorkouts(
        from === undefined
          ? { kind: 'all-history' }
          : { kind: 'period', from, to },
      ),
      listCompletedWorkoutTimestamps(),
    ]);

    return {
      requestKey,
      data: {
        bounds,
        workouts,
        hasEarlierHistory:
          from !== undefined &&
          allStarts.some((startedAt) => startedAt < from),
      },
    };
  }, [requestKey]);

  return {
    data: loaded?.data,
    stale: loaded?.requestKey !== requestKey,
  };
}
