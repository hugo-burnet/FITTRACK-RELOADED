import { isWorkingSet } from '@/lib/records';
import { estimateOneRepMax, type OneRepMaxFormula } from '@/lib/oneRepMax';
import { nextLoad, previousLoad, resolveLoadIncrementKg } from '@/lib/loadIncrement';
import type {
  CoachEvaluateOptions,
  CoachEvidence,
  CoachExerciseLine,
  CoachSetInput,
  CoachSignal,
  CoachSignalCode,
} from './types';

const DEFAULT_PLATEAU_SESSIONS = 3;
const DEFAULT_DROP_REPS = 2;
const DEFAULT_LONG_REST_MS = 180_000;
/** Consecutive sessions under the floor, at the same load, before backing off. */
const MISSED_SESSIONS = 2;

/** Severity ladder — UI keeps one signal per exercise; higher wins. */
const SEVERITY: Record<CoachSignalCode, number> = {
  // Above `range_completed`: failing twice is more urgent than succeeding once,
  // and the two can never fire together anyway — one needs every set at the top
  // of the range, the other a set under its floor.
  range_missed: 50,
  range_completed: 40,
  plateau: 30,
  intra_session_drop: 20,
  long_rest: 10,
};

const CODE_ORDER: CoachSignalCode[] = [
  'range_missed',
  'range_completed',
  'plateau',
  'intra_session_drop',
  'long_rest',
];

function completedWorkingSets(sets: readonly CoachSetInput[]): CoachSetInput[] {
  return sets
    .filter((set) => set.isCompleted === 1 && isWorkingSet(set) && set.performedAt > 0)
    .slice()
    .sort((a, b) => a.order - b.order || a.performedAt - b.performedAt);
}

function isDeloadLine(line: CoachExerciseLine): boolean {
  return line.programIsDeload === 1 ||
    (typeof line.deloadPercent === 'number' &&
      line.deloadPercent > 0 &&
      line.deloadPercent < 100);
}

/**
 * Same exercise twice in one workout is two lines. Merge sets so drop/rest/range
 * see one continuous block, like `muscleInvolvement` accumulates two lines.
 */
export function mergeLinesForWorkout(lines: readonly CoachExerciseLine[]): CoachExerciseLine[] {
  const byKey = new Map<string, CoachExerciseLine>();

  for (const line of lines) {
    const key = `${line.workoutId}::${line.exerciseId}`;
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, {
        ...line,
        sets: line.sets.map((set) => ({ ...set })),
      });
      continue;
    }
    existing.sets.push(...line.sets.map((set) => ({ ...set })));
  }

  return [...byKey.values()];
}

function bestSessionOneRepMax(
  sets: readonly CoachSetInput[],
  formula: OneRepMaxFormula,
): number | undefined {
  let best: number | undefined;
  for (const set of completedWorkingSets(sets)) {
    if (set.weight === undefined || set.reps === undefined) continue;
    const estimate = estimateOneRepMax(set.weight, set.reps, formula);
    if (estimate === undefined) continue;
    if (best === undefined || estimate > best) best = estimate;
  }
  return best;
}

function rangeCompletedSignal(line: CoachExerciseLine): CoachSignal | undefined {
  if (isDeloadLine(line)) return undefined;

  const working = completedWorkingSets(line.sets);
  if (working.length === 0) return undefined;

  // Every working set must carry a max target and hit it. Imports without a
  // prescribed range stay silent — they feed plateau/1RM, never double progression.
  if (working.some((set) => set.targetRepsMax === undefined)) return undefined;
  if (working.some((set) => set.reps === undefined || set.reps < set.targetRepsMax!)) {
    return undefined;
  }

  const targetRepsMax = working[0]!.targetRepsMax!;
  const lastWeight = [...working].reverse().find((set) => set.weight !== undefined)?.weight;
  if (lastWeight === undefined) return undefined;

  const increment = resolveLoadIncrementKg(line);
  const proposed = nextLoad(lastWeight, increment, line.measurementType);
  if (proposed === lastWeight) return undefined;

  const evidence: CoachEvidence[] = [
    { label: 'working_sets', value: working.length },
    { label: 'target_reps_max', value: targetRepsMax },
    { label: 'current_load_kg', value: lastWeight },
    { label: 'next_load_kg', value: proposed },
  ];

  return {
    code: 'range_completed',
    exerciseId: line.exerciseId,
    nextLoadKg: proposed,
    evidence,
    severity: SEVERITY.range_completed,
  };
}

/**
 * What one session says about the floor of its range: the load worked, and the
 * worst set under the prescribed minimum. `undefined` means "this session did
 * not miss", which includes every session the engine cannot read (no range, no
 * reps, no weight) — silence is the only honest answer there.
 */
function floorMiss(
  line: CoachExerciseLine,
): { loadKg: number; lowReps: number; floor: number } | undefined {
  const working = completedWorkingSets(line.sets);
  if (working.length === 0) return undefined;

  let worst: { reps: number; floor: number } | undefined;
  for (const set of working) {
    if (set.targetReps === undefined || set.reps === undefined) return undefined;
    if (set.reps >= set.targetReps) continue;
    if (worst === undefined || set.reps < worst.reps) {
      worst = { reps: set.reps, floor: set.targetReps };
    }
  }
  if (worst === undefined) return undefined;

  const loadKg = [...working].reverse().find((set) => set.weight !== undefined)?.weight;
  if (loadKg === undefined) return undefined;

  return { loadKg, lowReps: worst.reps, floor: worst.floor };
}

/**
 * The other half of double progression, promised by the roadmap: a range missed
 * twice in a row at the same load earns one increment back down.
 *
 * **Two sessions, not one.** A single miss is a bad day — bad sleep, a late
 * meal, a busy rack. Backing off on one is how a coach teaches you to stop
 * reading it. And the roadmap's "hold, then decrease" needs no signal for the
 * hold: saying nothing *is* holding, which is already what the app does.
 *
 * **Same load in both**, otherwise the two sessions are not the same attempt
 * and there is nothing to conclude. Deload sessions are skipped, like
 * everywhere else — the charges drop on purpose there.
 */
function rangeMissedSignal(
  historyNewestFirst: readonly CoachExerciseLine[],
): CoachSignal | undefined {
  const comparable = historyNewestFirst.filter((line) => !isDeloadLine(line));
  if (comparable.length < MISSED_SESSIONS) return undefined;

  const window = comparable.slice(0, MISSED_SESSIONS);
  const misses = window.map(floorMiss);
  if (misses.some((miss) => miss === undefined)) return undefined;

  const [latest, ...earlier] = misses as { loadKg: number; lowReps: number; floor: number }[];
  if (earlier.some((miss) => miss.loadKg !== latest!.loadKg)) return undefined;

  const line = window[0]!;
  const increment = resolveLoadIncrementKg(line);
  const proposed = previousLoad(latest!.loadKg, increment, line.measurementType);
  if (proposed === latest!.loadKg) return undefined;

  return {
    code: 'range_missed',
    exerciseId: line.exerciseId,
    nextLoadKg: proposed,
    evidence: [
      { label: 'sessions', value: MISSED_SESSIONS },
      { label: 'target_reps', value: latest!.floor },
      { label: 'low_reps', value: latest!.lowReps },
      { label: 'current_load_kg', value: latest!.loadKg },
      { label: 'next_load_kg', value: proposed },
    ],
    severity: SEVERITY.range_missed,
  };
}

function intraSessionDropSignal(
  line: CoachExerciseLine,
  dropReps: number,
): CoachSignal | undefined {
  const working = completedWorkingSets(line.sets);
  if (working.length < 2) return undefined;

  const firstReps = working[0]!.reps;
  if (firstReps === undefined) return undefined;

  let worst: { set: CoachSetInput; drop: number } | undefined;
  for (let i = 1; i < working.length; i++) {
    const set = working[i]!;
    const reps = set.reps;
    if (reps === undefined) continue;
    const drop = firstReps - reps;
    if (drop < dropReps) continue;
    // A set that lands inside its own prescription is not a defect. `12, 12, 12,
    // 10` on an 8–12 range is the range being respected, and calling it a drop
    // is noise the user has to learn to ignore — which is how a coach stops
    // being read at all. Only a set that falls *through the floor* is news.
    if (set.targetReps !== undefined && reps >= set.targetReps) continue;
    if (worst === undefined || drop > worst.drop) {
      worst = { set, drop };
    }
  }
  if (worst === undefined) return undefined;

  return {
    code: 'intra_session_drop',
    exerciseId: line.exerciseId,
    evidence: [
      { label: 'first_reps', value: firstReps },
      { label: 'low_reps', value: worst.set.reps! },
      { label: 'drop_reps', value: worst.drop },
    ],
    severity: SEVERITY.intra_session_drop,
  };
}

function restGapsMs(sets: readonly CoachSetInput[]): number[] {
  const working = completedWorkingSets(sets);
  const gaps: number[] = [];
  for (let i = 1; i < working.length; i++) {
    const gap = working[i]!.performedAt - working[i - 1]!.performedAt;
    if (gap > 0) gaps.push(gap);
  }
  return gaps;
}

function longRestSignal(
  line: CoachExerciseLine,
  drop: CoachSignal | undefined,
  longRestMs: number,
): CoachSignal | undefined {
  // Correlates with rule 2 only — a long rest alone is not a defect.
  if (drop === undefined) return undefined;

  const gaps = restGapsMs(line.sets);
  if (gaps.length === 0) return undefined;
  const maxGap = Math.max(...gaps);
  if (maxGap < longRestMs) return undefined;

  return {
    code: 'long_rest',
    exerciseId: line.exerciseId,
    evidence: [
      { label: 'max_rest_seconds', value: Math.round(maxGap / 1000) },
      { label: 'threshold_seconds', value: Math.round(longRestMs / 1000) },
    ],
    severity: SEVERITY.long_rest,
  };
}

/**
 * Plateau: N consecutive non-deload sessions with no improvement on best estimated 1RM.
 * Deload sessions are skipped so a planned cut never looks like stagnation.
 */
function plateauSignal(
  historyNewestFirst: readonly CoachExerciseLine[],
  formula: OneRepMaxFormula,
  plateauSessions: number,
): CoachSignal | undefined {
  const comparable = historyNewestFirst.filter((line) => !isDeloadLine(line));
  if (comparable.length < plateauSessions) return undefined;

  const window = comparable.slice(0, plateauSessions);
  const estimates = window.map((line) => bestSessionOneRepMax(line.sets, formula));
  if (estimates.some((value) => value === undefined)) return undefined;

  const values = estimates as number[];
  // Newest session must not beat any earlier one in the window, and at least
  // the oldest must exist — flat or declining across N sessions.
  const newest = values[0]!;
  const priorBest = Math.max(...values.slice(1));
  if (newest > priorBest) return undefined;

  // Also require no session-to-session improvement walking older → newer.
  const oldestFirst = [...values].reverse();
  let improved = false;
  for (let i = 1; i < oldestFirst.length; i++) {
    if (oldestFirst[i]! > oldestFirst[i - 1]!) {
      improved = true;
      break;
    }
  }
  if (improved) return undefined;

  return {
    code: 'plateau',
    exerciseId: window[0]!.exerciseId,
    evidence: [
      { label: 'sessions', value: plateauSessions },
      { label: 'best_1rm_kg', value: Math.round(newest * 10) / 10 },
    ],
    severity: SEVERITY.plateau,
  };
}

/** Rank signals and keep the single strongest per exercise. */
export function pickSignals(signals: readonly CoachSignal[]): CoachSignal[] {
  const best = new Map<string, CoachSignal>();

  for (const signal of signals) {
    const current = best.get(signal.exerciseId);
    if (current === undefined) {
      best.set(signal.exerciseId, signal);
      continue;
    }
    if (signal.severity > current.severity) {
      best.set(signal.exerciseId, signal);
      continue;
    }
    if (signal.severity < current.severity) continue;
    if (CODE_ORDER.indexOf(signal.code) < CODE_ORDER.indexOf(current.code)) {
      best.set(signal.exerciseId, signal);
    }
  }

  return [...best.values()].sort(
    (a, b) => b.severity - a.severity || CODE_ORDER.indexOf(a.code) - CODE_ORDER.indexOf(b.code),
  );
}

/**
 * Every signal the rules produce, before the one-per-exercise comparator.
 * Tests use this to prove correlation (e.g. long_rest only with a drop).
 */
export function collectCoachSignals(
  lines: readonly CoachExerciseLine[],
  options: CoachEvaluateOptions = {},
): CoachSignal[] {
  const formula = options.formula ?? 'epley';
  const plateauSessions = options.plateauSessions ?? DEFAULT_PLATEAU_SESSIONS;
  const dropReps = options.dropReps ?? DEFAULT_DROP_REPS;
  const longRestMs = options.longRestMs ?? DEFAULT_LONG_REST_MS;

  const merged = mergeLinesForWorkout(lines);
  const byExercise = new Map<string, CoachExerciseLine[]>();
  for (const line of merged) {
    const list = byExercise.get(line.exerciseId) ?? [];
    list.push(line);
    byExercise.set(line.exerciseId, list);
  }

  const signals: CoachSignal[] = [];

  for (const [, exerciseLines] of byExercise) {
    const newestFirst = exerciseLines
      .slice()
      .sort(
        (a, b) =>
          b.workoutStartedAt - a.workoutStartedAt || b.workoutId.localeCompare(a.workoutId),
      );

    const latest = newestFirst[0];
    if (latest === undefined) continue;

    const range = rangeCompletedSignal(latest);
    if (range) signals.push(range);

    const missed = rangeMissedSignal(newestFirst);
    if (missed) signals.push(missed);

    const drop = intraSessionDropSignal(latest, dropReps);
    if (drop) signals.push(drop);

    const rest = longRestSignal(latest, drop, longRestMs);
    if (rest) signals.push(rest);

    const plateau = plateauSignal(newestFirst, formula, plateauSessions);
    if (plateau) signals.push(plateau);
  }

  return signals;
}

/**
 * Evaluate coach signals from plain history lines.
 *
 * `lines` may span many workouts and exercises. Pass every line of the sessions
 * you care about; the engine groups by exercise and orders by workout time.
 * Returns at most one signal per exercise.
 */
export function evaluateCoach(
  lines: readonly CoachExerciseLine[],
  options: CoachEvaluateOptions = {},
): CoachSignal[] {
  return pickSignals(collectCoachSignals(lines, options));
}
