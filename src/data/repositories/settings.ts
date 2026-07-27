import { db } from '@/data/db';
import {
  startOfLocalWeek,
  type WeeklyTrainingGoal,
} from '@/lib/history';
import { normalizeHevyExerciseTitle } from '@/lib/hevyExerciseMatch';
import { DEFAULT_PLATES_KG } from '@/lib/plates';

const AVAILABLE_PLATE_WEIGHTS_KEY = 'availablePlateWeightsKg';
const WEEKLY_TRAINING_GOAL_HISTORY_KEY = 'weeklyTrainingGoalHistory';
const HEVY_EXERCISE_MAPPINGS_KEY = 'hevyExerciseMappings';
const CANONICAL_PLATE_WEIGHTS = new Set<number>(DEFAULT_PLATES_KG);

export type HevyExerciseMappings = Record<string, string>;

function defaultPlateWeights(): number[] {
  return [...DEFAULT_PLATES_KG];
}

function normalizeAvailablePlateWeightsKg(value: unknown): number[] {
  if (!Array.isArray(value)) return defaultPlateWeights();
  if (value.length === 0) return [];

  const validWeights = new Set(
    value.filter(
      (weight): weight is number =>
        typeof weight === 'number' &&
        Number.isFinite(weight) &&
        weight > 0 &&
        CANONICAL_PLATE_WEIGHTS.has(weight),
    ),
  );
  const normalized = DEFAULT_PLATES_KG.filter((weight) => validWeights.has(weight));

  return normalized.length > 0 ? normalized : defaultPlateWeights();
}

export async function getAvailablePlateWeightsKg(): Promise<number[]> {
  const setting = await db.settings.get(AVAILABLE_PLATE_WEIGHTS_KEY);

  return setting === undefined
    ? defaultPlateWeights()
    : normalizeAvailablePlateWeightsKg(setting.value);
}

export async function setAvailablePlateWeightsKg(
  weights: readonly number[],
): Promise<number[]> {
  const normalized = normalizeAvailablePlateWeightsKg([...weights]);

  await db.settings.put({
    key: AVAILABLE_PLATE_WEIGHTS_KEY,
    value: normalized,
    updatedAt: Date.now(),
  });

  return normalized;
}

function normalizeWeeklyTrainingGoalHistory(value: unknown): WeeklyTrainingGoal[] {
  if (!Array.isArray(value)) return [];

  const byWeek = new Map<number, WeeklyTrainingGoal>();

  for (const candidate of value) {
    if (typeof candidate !== 'object' || candidate === null) continue;
    const record = candidate as Record<string, unknown>;
    const effectiveFromWeek = record.effectiveFromWeek;
    const sessions = record.sessions;

    if (
      typeof effectiveFromWeek !== 'number' ||
      !Number.isFinite(effectiveFromWeek) ||
      effectiveFromWeek < 0 ||
      typeof sessions !== 'number' ||
      !Number.isInteger(sessions) ||
      sessions < 1
    ) {
      continue;
    }

    byWeek.set(effectiveFromWeek, { effectiveFromWeek, sessions });
  }

  return [...byWeek.values()].sort(
    (left, right) => left.effectiveFromWeek - right.effectiveFromWeek,
  );
}

export async function getWeeklyTrainingGoalHistory(): Promise<WeeklyTrainingGoal[]> {
  const setting = await db.settings.get(WEEKLY_TRAINING_GOAL_HISTORY_KEY);
  return normalizeWeeklyTrainingGoalHistory(setting?.value);
}

export async function setWeeklyTrainingGoal(
  sessions: number,
  now = Date.now(),
): Promise<WeeklyTrainingGoal[]> {
  if (!Number.isInteger(sessions) || sessions < 1) {
    throw new RangeError('Weekly training goal must be a positive integer');
  }

  return db.transaction('rw', db.settings, async () => {
    const current = await getWeeklyTrainingGoalHistory();
    const effectiveFromWeek = current.length === 0 ? 0 : startOfLocalWeek(now);
    const next = current.filter((goal) => goal.effectiveFromWeek !== effectiveFromWeek);
    next.push({ effectiveFromWeek, sessions });
    next.sort((left, right) => left.effectiveFromWeek - right.effectiveFromWeek);

    await db.settings.put({
      key: WEEKLY_TRAINING_GOAL_HISTORY_KEY,
      value: next,
      updatedAt: Date.now(),
    });

    return next;
  });
}

function normalizeHevyExerciseMappings(
  value: unknown,
): HevyExerciseMappings {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    return {};
  }

  const normalized: HevyExerciseMappings = {};
  for (const [sourceTitle, exerciseId] of Object.entries(value)) {
    if (typeof exerciseId !== 'string' || exerciseId.trim() === '') continue;
    const key = normalizeHevyExerciseTitle(sourceTitle);
    if (key === '') continue;
    normalized[key] = exerciseId;
  }
  return normalized;
}

export async function getHevyExerciseMappings(): Promise<HevyExerciseMappings> {
  const setting = await db.settings.get(HEVY_EXERCISE_MAPPINGS_KEY);
  return normalizeHevyExerciseMappings(setting?.value);
}

export async function setHevyExerciseMappings(
  mappings: Readonly<HevyExerciseMappings>,
): Promise<HevyExerciseMappings> {
  const normalized = normalizeHevyExerciseMappings(mappings);
  await db.settings.put({
    key: HEVY_EXERCISE_MAPPINGS_KEY,
    value: normalized,
    updatedAt: Date.now(),
  });
  return normalized;
}
