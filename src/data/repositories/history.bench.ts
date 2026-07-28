import { beforeAll, bench } from 'vitest';
import { listExportSources } from '@/data/repositories/exportQueries';
import {
  listCompletedWorkoutTimestamps,
  listHistoryPage,
} from '@/data/repositories/history';
import {
  LARGE_HISTORY_PROFILE,
  seedLargeHistory,
} from '@/test/largeHistory';
import { resetDb } from '@/test/resetDb';

const DAY_MS = 86_400_000;
const OPTIONS = {
  iterations: 3,
  time: 0,
  warmupIterations: 1,
  warmupTime: 0,
};

beforeAll(async () => {
  await resetDb();
  const startedAt = performance.now();
  const counts = await seedLargeHistory(LARGE_HISTORY_PROFILE);
  const elapsedMs = performance.now() - startedAt;

  if (
    counts.workouts !== 2_000 ||
    counts.workoutExercises !== 16_000 ||
    counts.workoutSets !== 64_000
  ) {
    throw new Error(`Unexpected large-history counts: ${JSON.stringify(counts)}`);
  }

  console.info(
    `large-history seed: ${elapsedMs.toFixed(1)} ms ` +
      `(${counts.workouts} workouts, ${counts.workoutExercises} rows, ` +
      `${counts.workoutSets} sets)`,
  );
}, 120_000);

bench(
  'history first page from 2,000 workouts',
  async () => {
    await listHistoryPage({}, 0, 20);
  },
  OPTIONS,
);

bench(
  'completed workout timestamps from 2,000 workouts',
  async () => {
    await listCompletedWorkoutTimestamps();
  },
  OPTIONS,
);

bench(
  'bounded one-year export projection',
  async () => {
    await listExportSources({
      kind: 'period',
      from: LARGE_HISTORY_PROFILE.startedAt,
      to: LARGE_HISTORY_PROFILE.startedAt + 365 * DAY_MS,
    });
  },
  OPTIONS,
);
