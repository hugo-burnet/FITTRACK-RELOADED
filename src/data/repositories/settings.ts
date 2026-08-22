import { db } from '@/data/db';
import type { OneRepMaxFormula } from '@/lib/oneRepMax';
import { reconcileAllRecords } from './recordReconciliation';
import {
  startOfLocalWeek,
  type WeeklyTrainingGoal,
} from '@/lib/history';
import { DEFAULT_PLATES_KG } from '@/lib/plates';
import { DEFAULT_REP_SECONDS, clampRepSeconds, normalizeRepSeconds } from '@/lib/tempo';

const AVAILABLE_PLATE_WEIGHTS_KEY = 'availablePlateWeightsKg';
const WEEKLY_TRAINING_GOAL_HISTORY_KEY = 'weeklyTrainingGoalHistory';
const ONE_REP_MAX_FORMULA_KEY = 'oneRepMaxFormula';
const REP_SECONDS_KEY = 'repSeconds';
const HOME_ROUTINE_FOLDER_CONTEXT_KEY = 'homeRoutineFolderContext';
const CANONICAL_PLATE_WEIGHTS = new Set<number>(DEFAULT_PLATES_KG);
const ONE_REP_MAX_FORMULAS: ReadonlySet<OneRepMaxFormula> = new Set([
  'epley',
  'brzycki',
  'lombardi',
]);

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

export async function getOneRepMaxFormula(): Promise<OneRepMaxFormula> {
  const value = (await db.settings.get(ONE_REP_MAX_FORMULA_KEY))?.value;
  return typeof value === 'string' && ONE_REP_MAX_FORMULAS.has(value as OneRepMaxFormula)
    ? (value as OneRepMaxFormula)
    : 'epley';
}

export async function setOneRepMaxFormula(formula: OneRepMaxFormula): Promise<void> {
  if (!ONE_REP_MAX_FORMULAS.has(formula)) {
    throw new RangeError('Unsupported one-rep-max formula');
  }

  await db.transaction(
    'rw',
    [
      db.settings,
      db.exercises,
      db.workouts,
      db.workoutExercises,
      db.workoutSets,
      db.bodyMeasurements,
      db.personalRecords,
    ],
    async () => {
      await reconcileAllRecords(formula, new Set(['best_1rm']));
      await db.settings.put({
        key: ONE_REP_MAX_FORMULA_KEY,
        value: formula,
        updatedAt: Date.now(),
      });
    },
  );
}

/**
 * The tempo an exercise takes when it has none of its own.
 *
 * One preference for the whole app rather than a default per exercise in the
 * catalogue: the number that matters is the one you are beating *now*, it is
 * set from the card in one gesture, and the last thing a settings screen needs
 * is four hundred tempos to maintain.
 */
export async function getDefaultRepSeconds(): Promise<number> {
  const setting = await db.settings.get(REP_SECONDS_KEY);
  return normalizeRepSeconds(setting?.value) ?? DEFAULT_REP_SECONDS;
}

export async function setDefaultRepSeconds(seconds: number): Promise<number> {
  const value = clampRepSeconds(seconds);
  await db.settings.put({ key: REP_SECONDS_KEY, value, updatedAt: Date.now() });
  return value;
}

export type RoutineFolderContext =
  | { kind: 'root' }
  | { kind: 'folder'; folderId: string };

function normalizeRoutineFolderContext(value: unknown): RoutineFolderContext | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.kind === 'root') return { kind: 'root' };
  return candidate.kind === 'folder' &&
    typeof candidate.folderId === 'string' && candidate.folderId.length > 0
    ? { kind: 'folder', folderId: candidate.folderId }
    : null;
}

export async function getRoutineFolderContext(): Promise<RoutineFolderContext | null> {
  return normalizeRoutineFolderContext(
    (await db.settings.get(HOME_ROUTINE_FOLDER_CONTEXT_KEY))?.value,
  );
}

export async function setRoutineFolderContext(context: RoutineFolderContext): Promise<void> {
  await db.settings.put({
    key: HOME_ROUTINE_FOLDER_CONTEXT_KEY,
    value: context,
    updatedAt: Date.now(),
  });
}
