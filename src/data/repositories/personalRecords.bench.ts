import { afterAll, beforeAll, bench } from 'vitest';
import { db } from '@/data/db';
import {
  listRecordTimeline,
  rebuildAllRecords,
  rebuildRecordsForExercises,
  type RecordRebuildResult,
  type RecordTimelineEntry,
} from '@/data/repositories/personalRecords';
import {
  LARGE_HISTORY_PROFILE,
  seedLargeHistory,
} from '@/test/largeHistory';
import { resetDb } from '@/test/resetDb';

const TARGET_EXERCISE_ID = 'large-exercise-00000';
const EXPECTED_RECORD_COUNT = 82;
const EXPECTED_TARGET_RECORD_COUNT = 12;
const OPTIONS = {
  iterations: 3,
  time: 0,
  warmupIterations: 1,
  warmupTime: 0,
};

let initialResult: RecordRebuildResult | undefined;
let idempotentResults: RecordRebuildResult[] = [];
let targetedResults: RecordRebuildResult[] = [];
let timeline: RecordTimelineEntry[] | undefined;

function assertResult(
  label: string,
  result: RecordRebuildResult | undefined,
  expected: RecordRebuildResult,
): void {
  if (result === undefined || JSON.stringify(result) !== JSON.stringify(expected)) {
    throw new Error(
      `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(result)}`,
    );
  }
}

async function assertInitialProjection(): Promise<void> {
  assertResult('initial full rebuild', initialResult, {
    created: EXPECTED_RECORD_COUNT,
    updated: 0,
    deleted: 0,
    unchanged: 0,
  });

  const count = await db.personalRecords.count();
  if (count !== EXPECTED_RECORD_COUNT) {
    throw new Error(
      `initial full rebuild: expected ${EXPECTED_RECORD_COUNT} rows, got ${count}`,
    );
  }
}

function assertIdempotentResults(): void {
  if (idempotentResults.length !== OPTIONS.iterations) {
    throw new Error(
      `idempotent full rebuild: expected ${OPTIONS.iterations} samples, ` +
        `got ${idempotentResults.length}`,
    );
  }

  for (const result of idempotentResults) {
    assertResult('idempotent full rebuild', result, {
      created: 0,
      updated: 0,
      deleted: 0,
      unchanged: EXPECTED_RECORD_COUNT,
    });
  }
}

function assertTargetedResults(): void {
  if (targetedResults.length !== OPTIONS.iterations) {
    throw new Error(
      `targeted rebuild: expected ${OPTIONS.iterations} samples, ` +
        `got ${targetedResults.length}`,
    );
  }

  for (const result of targetedResults) {
    assertResult('targeted rebuild', result, {
      created: 0,
      updated: 0,
      deleted: 0,
      unchanged: EXPECTED_TARGET_RECORD_COUNT,
    });
  }
}

function assertTimeline(): void {
  if (timeline === undefined || timeline.length !== EXPECTED_RECORD_COUNT) {
    throw new Error(
      `timeline read: expected ${EXPECTED_RECORD_COUNT} rows, got ${timeline?.length}`,
    );
  }

  for (let index = 1; index < timeline.length; index += 1) {
    if (timeline[index - 1]!.record.achievedAt < timeline[index]!.record.achievedAt) {
      throw new Error(`timeline read: rows are not newest-first at index ${index}`);
    }
  }
}

beforeAll(async () => {
  await resetDb();
  const counts = await seedLargeHistory(LARGE_HISTORY_PROFILE);

  if (
    counts.workouts !== 2_000 ||
    counts.workoutExercises !== 16_000 ||
    counts.workoutSets !== 64_000
  ) {
    throw new Error(`Unexpected large-history counts: ${JSON.stringify(counts)}`);
  }
}, 360_000);

afterAll(() => {
  assertTimeline();
});

bench(
  'initial full personal-record rebuild',
  async () => {
    initialResult = await rebuildAllRecords();
  },
  {
    iterations: 1,
    time: 0,
    warmupIterations: 0,
    warmupTime: 0,
    setup: async () => {
      await db.personalRecords.clear();
      initialResult = undefined;
    },
  },
);

bench(
  'idempotent full personal-record rebuild',
  async () => {
    idempotentResults.push(await rebuildAllRecords());
  },
  {
    ...OPTIONS,
    setup: async (_task, mode) => {
      await assertInitialProjection();
      if (mode === 'run') idempotentResults = [];
    },
  },
);

bench(
  'targeted one-exercise personal-record rebuild',
  async () => {
    targetedResults.push(
      await rebuildRecordsForExercises([TARGET_EXERCISE_ID]),
    );
  },
  {
    ...OPTIONS,
    setup: (_task, mode) => {
      assertIdempotentResults();
      if (mode === 'run') targetedResults = [];
    },
  },
);

bench(
  'newest-first personal-record timeline read',
  async () => {
    timeline = await listRecordTimeline();
  },
  {
    ...OPTIONS,
    setup: assertTargetedResults,
  },
);
