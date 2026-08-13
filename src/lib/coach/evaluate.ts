import { isWorkingSet } from '@/lib/records';
import { estimateOneRepMax, type OneRepMaxFormula } from '@/lib/oneRepMax';
import { nextLoad, previousLoad, resolveLoadIncrementKg } from '@/lib/loadIncrement';
import type {
  CoachAction,
  CoachEvaluateOptions,
  CoachEvaluation,
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
  // Above range success: failing twice is more urgent than succeeding once,
  // and range_satisfied / range_ceiling_reached never fire together.
  range_missed: 50,
  range_ceiling_reached: 40,
  /** Read alias for legacy journal rows; same weight as ceiling. */
  range_completed: 40,
  range_satisfied: 35,
  plateau: 30,
  intra_session_drop: 20,
  long_rest: 10,
};

const CODE_ORDER: CoachSignalCode[] = [
  'range_missed',
  'range_ceiling_reached',
  'range_completed',
  'range_satisfied',
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

/** Ceiling of the prescribed rep contract: open top of a range, or the single target. */
function effectiveCeiling(set: CoachSetInput): number | undefined {
  return set.targetRepsMax ?? set.targetReps;
}

/**
 * Exclusive partition of the rep contract (spec §4.1).
 * Never both `ceiling` and `satisfied`; single-target hit is ceiling only.
 */
function rangeFlags(working: CoachSetInput[]): {
  ceiling: boolean;
  satisfied: boolean;
} {
  if (working.length === 0) return { ceiling: false, satisfied: false };
  if (working.some((set) => effectiveCeiling(set) === undefined)) {
    return { ceiling: false, satisfied: false };
  }
  const ceiling = working.every(
    (set) => set.reps !== undefined && set.reps >= effectiveCeiling(set)!,
  );
  const hasRange = working.every(
    (set) =>
      set.targetReps !== undefined &&
      set.targetRepsMax !== undefined &&
      set.targetRepsMax > set.targetReps,
  );
  const satisfied =
    hasRange &&
    !ceiling &&
    working.every((set) => set.reps !== undefined && set.reps >= set.targetReps!);
  return { ceiling, satisfied };
}

/**
 * One of `range_ceiling_reached` | `range_satisfied`, never both, never on deload.
 * `range_completed` is not written — journal rows keep it as a read alias only.
 */
function rangePartitionSignal(line: CoachExerciseLine): CoachSignal | undefined {
  if (isDeloadLine(line)) return undefined;

  const working = completedWorkingSets(line.sets);
  const { ceiling, satisfied } = rangeFlags(working);
  if (!ceiling && !satisfied) return undefined;

  if (satisfied) {
    const floor = working[0]!.targetReps!;
    const max = working[0]!.targetRepsMax!;
    return {
      code: 'range_satisfied',
      exerciseId: line.exerciseId,
      evidence: [
        { label: 'working_sets', value: working.length },
        { label: 'target_reps', value: floor },
        { label: 'target_reps_max', value: max },
      ],
      severity: SEVERITY.range_satisfied,
    };
  }

  // ceiling
  const ceilingReps = effectiveCeiling(working[0]!)!;
  const lastWeight = [...working].reverse().find((set) => set.weight !== undefined)?.weight;
  const evidence: CoachEvidence[] = [
    { label: 'working_sets', value: working.length },
    { label: 'target_reps_max', value: ceilingReps },
  ];

  let nextLoadKg: number | undefined;
  if (lastWeight !== undefined) {
    evidence.push({ label: 'current_load_kg', value: lastWeight });
    const increment = resolveLoadIncrementKg(line);
    const proposed = nextLoad(lastWeight, increment, line.measurementType);
    if (proposed !== lastWeight) {
      nextLoadKg = proposed;
      evidence.push({ label: 'next_load_kg', value: proposed });
    }
  }

  return {
    code: 'range_ceiling_reached',
    exerciseId: line.exerciseId,
    nextLoadKg,
    evidence,
    severity: SEVERITY.range_ceiling_reached,
  };
}

/**
 * Build the action set from performance signals only (phase does not touch this).
 * Plateau strips every prescription escalation, including `add_set`.
 */
function buildAllowedActions(signals: readonly CoachSignal[]): CoachAction[] {
  const allowed = new Set<CoachAction>(['maintain']);
  const codes = new Set(signals.map((signal) => signal.code));

  if (codes.has('range_satisfied')) {
    allowed.add('increase_reps');
  }
  if (codes.has('range_ceiling_reached') || codes.has('range_completed')) {
    allowed.add('increase_load');
    allowed.add('add_set');
  }
  if (codes.has('range_missed')) {
    allowed.add('reduce_load');
  }

  if (codes.has('plateau')) {
    for (const action of ['increase_reps', 'increase_load', 'add_set'] as const) {
      allowed.delete(action);
    }
  }

  return [...allowed];
}

function sortNewestFirst(lines: readonly CoachExerciseLine[]): CoachExerciseLine[] {
  return lines
    .slice()
    .sort(
      (a, b) =>
        b.workoutStartedAt - a.workoutStartedAt || b.workoutId.localeCompare(a.workoutId),
    );
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

function isLoadlessCeiling(signal: CoachSignal): boolean {
  return (
    (signal.code === 'range_ceiling_reached' || signal.code === 'range_completed') &&
    signal.nextLoadKg === undefined
  );
}

/** A shaped escalate / deferred hold must not erase the plateau constat (spec §5.2). */
function hidesPlateau(signal: CoachSignal): boolean {
  if (signal.code === 'plateau') return false;
  if (isLoadlessCeiling(signal)) return true;
  return signal.evidence.some(
    (item) => item.label === 'progression_deferred' && item.value === 1,
  );
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
    if (signal.code === 'plateau' && hidesPlateau(current)) {
      best.set(signal.exerciseId, signal);
      continue;
    }
    if (current.code === 'plateau' && hidesPlateau(signal)) {
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
 * Performance engine for one exercise: exclusive range partition, history
 * rules, and the independent `allowedActions` set (spec §4).
 *
 * `history` is prior sessions of the same exercise (any order). `line` is the
 * session under review; when history contains a newer session, the true latest
 * still wins for intra-session / range reads.
 */
export function evaluatePerformance(
  line: CoachExerciseLine,
  history: readonly CoachExerciseLine[] = [],
  options: CoachEvaluateOptions = {},
): CoachEvaluation {
  const formula = options.formula ?? 'epley';
  const plateauSessions = options.plateauSessions ?? DEFAULT_PLATEAU_SESSIONS;
  const dropReps = options.dropReps ?? DEFAULT_DROP_REPS;
  const longRestMs = options.longRestMs ?? DEFAULT_LONG_REST_MS;

  const sameExercise = history.filter((entry) => entry.exerciseId === line.exerciseId);
  const newestFirst = sortNewestFirst([line, ...sameExercise]);
  const latest = newestFirst[0]!;

  const signals: CoachSignal[] = [];

  const range = rangePartitionSignal(latest);
  if (range) signals.push(range);

  const missed = rangeMissedSignal(newestFirst);
  if (missed) signals.push(missed);

  const drop = intraSessionDropSignal(latest, dropReps);
  if (drop) signals.push(drop);

  const rest = longRestSignal(latest, drop, longRestMs);
  if (rest) signals.push(rest);

  const plateau = plateauSignal(newestFirst, formula, plateauSessions);
  if (plateau) signals.push(plateau);

  return {
    signals,
    allowedActions: buildAllowedActions(signals),
  };
}

/**
 * Every signal the rules produce, before the one-per-exercise comparator.
 * Tests use this to prove correlation (e.g. long_rest only with a drop).
 */
export function collectCoachSignals(
  lines: readonly CoachExerciseLine[],
  options: CoachEvaluateOptions = {},
): CoachSignal[] {
  const merged = mergeLinesForWorkout(lines);
  const byExercise = new Map<string, CoachExerciseLine[]>();
  for (const entry of merged) {
    const list = byExercise.get(entry.exerciseId) ?? [];
    list.push(entry);
    byExercise.set(entry.exerciseId, list);
  }

  const signals: CoachSignal[] = [];

  for (const [, exerciseLines] of byExercise) {
    const newestFirst = sortNewestFirst(exerciseLines);
    const latest = newestFirst[0];
    if (latest === undefined) continue;
    const evaluation = evaluatePerformance(latest, newestFirst.slice(1), options);
    signals.push(...evaluation.signals);
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
