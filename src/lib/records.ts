import type { MeasurementType, PersonalRecordType, WorkoutSet } from '@/data/types';
import { estimateOneRepMax, type OneRepMaxFormula } from './oneRepMax';

/**
 * What counts as a record — defined **once**, for the whole project.
 *
 * Lot 3 derives records from the history it reads, because the
 * `personalRecords` table stays empty until a workout can actually be logged.
 * Lot 6 (live detection) and Lot 13 (full recompute) consume these same
 * functions rather than restating the rules, so the three can never disagree.
 *
 * Pure by construction (architecture §7): sets in, sets out. Liveness and
 * completion are the repository's business — this module is only ever handed
 * sets that already count.
 */

export interface BestSets {
  /** Heaviest load lifted, with its rep context. */
  heaviest?: WorkoutSet;
  /** Most repetitions in a single set — the only record a bodyweight movement has. */
  mostReps?: WorkoutSet;
  /** Best single set by load × reps. Rarely the same set as `heaviest`. */
  bestVolume?: WorkoutSet;
}

/** 0 whenever either half is missing: a plank and a pull-up have no tonnage. */
export function setVolume(set: Pick<WorkoutSet, 'weight' | 'reps'>): number {
  if (set.weight === undefined || set.reps === undefined) return 0;
  return set.weight * set.reps;
}

/**
 * Best set by `score`, ties going to the **oldest**: a record is established the
 * first time you reach it, not the last.
 *
 * A score of 0 or less never wins, which is what keeps a bodyweight set out of
 * the load records and leaves the field `undefined` instead — the detail screen
 * then simply omits the line, and all six measurement types work without a
 * single `switch`.
 */
function pickBest(
  sets: WorkoutSet[],
  score: (set: WorkoutSet) => number | undefined,
): WorkoutSet | undefined {
  let best: WorkoutSet | undefined;
  let bestScore = 0;

  for (const candidate of sets) {
    const value = score(candidate);
    if (value === undefined || value <= 0) continue;

    if (
      best === undefined ||
      value > bestScore ||
      (value === bestScore && candidate.performedAt < best.performedAt)
    ) {
      best = candidate;
      bestScore = value;
    }
  }

  return best;
}

/**
 * Warm-ups pollute neither volume nor records (RF-20, enforced from Lot 3 on).
 *
 * Exported because anything that *counts* sets has to agree with anything that
 * *scores* them: a history row reading "4 séries · 100 kg × 5" where the 4
 * includes a warm-up and the 100 kg does not is two answers to one question.
 */
export const isWorkingSet = (set: Pick<WorkoutSet, 'setType'>): boolean => set.setType !== 'warmup';

export interface RecordSource {
  workoutId: string;
  workoutSetId?: string;
  exerciseId: string;
  measurementType: MeasurementType;
  achievedAt: number;
  exerciseOrder: number;
  setOrder: number;
  set?: WorkoutSet;
  sessionTonnage?: number;
}

export interface RecordEventDraft {
  exerciseId: string;
  type: PersonalRecordType;
  value: number;
  achievedAt: number;
  workoutId: string;
  workoutSetId?: string;
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  formula?: OneRepMaxFormula;
}

const TONNAGE_MEASUREMENTS: ReadonlySet<MeasurementType> = new Set([
  'weight_reps',
  'reps_only',
  'assisted_weight_reps',
]);

const isPositiveFinite = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value) && value > 0;

const isNonNegativeFinite = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value) && value >= 0;

function isEligibleSet(set: WorkoutSet): boolean {
  return set.isCompleted === 1 && set.deletedAt === 0 && isWorkingSet(set);
}

function contextFor(source: RecordSource): Omit<RecordEventDraft, 'type' | 'value' | 'formula'> {
  const { set } = source;

  return {
    exerciseId: source.exerciseId,
    achievedAt: source.achievedAt,
    workoutId: source.workoutId,
    ...(source.workoutSetId === undefined ? {} : { workoutSetId: source.workoutSetId }),
    ...(set?.weight === undefined ? {} : { weight: set.weight }),
    ...(set?.reps === undefined ? {} : { reps: set.reps }),
    ...(set?.durationSeconds === undefined ? {} : { durationSeconds: set.durationSeconds }),
    ...(set?.distanceMeters === undefined ? {} : { distanceMeters: set.distanceMeters }),
  };
}

function setCandidate(
  source: RecordSource,
  type: PersonalRecordType,
  value: number,
  formula?: OneRepMaxFormula,
): RecordEventDraft {
  return {
    ...contextFor(source),
    type,
    value,
    ...(formula === undefined ? {} : { formula }),
  };
}

function sessionTonnageCandidate(source: RecordSource): RecordEventDraft | undefined {
  if (
    !TONNAGE_MEASUREMENTS.has(source.measurementType) ||
    !isPositiveFinite(source.sessionTonnage)
  ) {
    return undefined;
  }

  return {
    exerciseId: source.exerciseId,
    type: 'max_volume_session',
    value: source.sessionTonnage,
    achievedAt: source.achievedAt,
    workoutId: source.workoutId,
  };
}

function candidatesFor(source: RecordSource, formula: OneRepMaxFormula): RecordEventDraft[] {
  if (source.set !== undefined && !isEligibleSet(source.set)) return [];

  const candidates: RecordEventDraft[] = [];
  const { set } = source;

  if (set !== undefined) {
    switch (source.measurementType) {
      case 'weight_reps': {
        if (isPositiveFinite(set.weight)) {
          candidates.push(setCandidate(source, 'max_weight', set.weight));
        }

        const volume = setVolume(set);
        if (isPositiveFinite(volume)) {
          candidates.push(setCandidate(source, 'max_volume_set', volume));
        }

        const oneRepMax = estimateOneRepMax(set.weight ?? 0, set.reps ?? 0, formula);
        if (oneRepMax !== undefined) {
          candidates.push(setCandidate(source, 'best_1rm', oneRepMax, formula));
        }
        break;
      }
      case 'reps_only':
        if (isPositiveFinite(set.reps)) {
          candidates.push(setCandidate(source, 'max_reps', set.reps));
        }
        if (isPositiveFinite(set.weight)) {
          candidates.push(setCandidate(source, 'max_added_weight', set.weight));
        }
        break;
      case 'assisted_weight_reps':
        if (isNonNegativeFinite(set.weight)) {
          candidates.push(setCandidate(source, 'min_assistance', set.weight));
        }
        if (isPositiveFinite(set.reps)) {
          candidates.push(setCandidate(source, 'max_reps', set.reps));
        }
        break;
      case 'weight_time':
        if (isPositiveFinite(set.weight)) {
          candidates.push(setCandidate(source, 'max_weight', set.weight));
        }
        if (isPositiveFinite(set.durationSeconds)) {
          candidates.push(setCandidate(source, 'max_duration', set.durationSeconds));
        }
        break;
      case 'time_only':
        if (isPositiveFinite(set.durationSeconds)) {
          candidates.push(setCandidate(source, 'max_duration', set.durationSeconds));
        }
        break;
      case 'distance_time':
        if (isPositiveFinite(set.distanceMeters)) {
          candidates.push(setCandidate(source, 'max_distance', set.distanceMeters));
        }
        if (isPositiveFinite(set.durationSeconds)) {
          candidates.push(setCandidate(source, 'max_duration', set.durationSeconds));
        }
        break;
    }
  }

  const sessionTonnage = sessionTonnageCandidate(source);
  if (sessionTonnage !== undefined) candidates.push(sessionTonnage);

  return candidates;
}

function isImprovement(type: PersonalRecordType, value: number, current?: number): boolean {
  if (current === undefined) return true;
  return type === 'min_assistance' ? value < current : value > current;
}

function compareSources(left: RecordSource, right: RecordSource): number {
  const byAchievedAt = left.achievedAt - right.achievedAt;
  if (byAchievedAt !== 0) return byAchievedAt;

  const byExerciseOrder = left.exerciseOrder - right.exerciseOrder;
  if (byExerciseOrder !== 0) return byExerciseOrder;

  const bySetOrder = left.setOrder - right.setOrder;
  if (bySetOrder !== 0) return bySetOrder;

  return (left.workoutSetId ?? left.workoutId).localeCompare(right.workoutSetId ?? right.workoutId);
}

export function projectRecordTimeline(
  sources: readonly RecordSource[],
  formula: OneRepMaxFormula,
): RecordEventDraft[] {
  const incumbents = new Map<string, number>();
  const events: RecordEventDraft[] = [];

  for (const source of [...sources].sort(compareSources)) {
    for (const candidate of candidatesFor(source, formula)) {
      const key = `${candidate.exerciseId}\u0000${candidate.type}`;
      const current = incumbents.get(key);

      if (!isImprovement(candidate.type, candidate.value, current)) continue;

      incumbents.set(key, candidate.value);
      events.push(candidate);
    }
  }

  return events;
}

export function bestSets(sets: WorkoutSet[]): BestSets {
  const scored = sets.filter(isWorkingSet);

  return {
    heaviest: pickBest(scored, (set) => set.weight),
    mostReps: pickBest(scored, (set) => set.reps),
    bestVolume: pickBest(scored, setVolume),
  };
}

/**
 * The three records of an exercise — the keys of `BestSets`, so a record can
 * never be named here without a way to compute it there.
 */
export type RecordKind = keyof BestSets;

export interface BeatenRecord {
  kind: RecordKind;
  /**
   * The set that held it until now. There is always one: with nothing to beat,
   * nothing was beaten.
   */
  beaten: WorkoutSet;
}

/**
 * RF-23 — what the set just ticked has beaten, most significant first.
 *
 * `others` is every set that counts for the same exercise, **today's already
 * validated ones included**: a record broken on set 2 is a record, and the only
 * thing that makes set 2 different from last month's set is its date. The
 * candidate may be in there — the caller hands over the whole exercise and this
 * filters it out, which is what makes the call impossible to get wrong.
 *
 * Two rules are worth their line:
 *
 * - **A record needs an incumbent.** The first set of an exercise you have never
 *   done beats nothing; it *becomes* the mark. Congratulating it would fire on
 *   the first working set of every new exercise, and could not name what was
 *   beaten. Ties do not count either, which is `pickBest`'s rule read from the
 *   other side: a record is established the first time you reach it.
 * - **Repetitions are only a record where there is no load to beat.** On a bench
 *   press the rep maximum is a light set, and calling it a record is a lie — the
 *   rule the exercise sheet already applies to its display, moved here where it
 *   belongs.
 *
 * Nothing is stored. Asking the question again on every render is what makes an
 * un-tick, a deletion or a mid-session requalification to warm-up (Lot 6, task
 * 1) invalidate a record for free, with no cascade to keep in sync — cf. the
 * note on `personalRecords` in PROGRESS.md.
 */
export function recordsBeatenBy(candidate: WorkoutSet, others: WorkoutSet[]): BeatenRecord[] {
  if (!isWorkingSet(candidate)) return [];

  const best = bestSets(others.filter((set) => set.id !== candidate.id));
  const beaten: BeatenRecord[] = [];

  const load = candidate.weight;
  const hasLoad = load !== undefined && load > 0;

  // Load first: it is the headline when a set takes two records at once.
  if (hasLoad && best.heaviest !== undefined && load > best.heaviest.weight!) {
    beaten.push({ kind: 'heaviest', beaten: best.heaviest });
  }

  const volume = setVolume(candidate);
  if (volume > 0 && best.bestVolume !== undefined && volume > setVolume(best.bestVolume)) {
    beaten.push({ kind: 'bestVolume', beaten: best.bestVolume });
  }

  const reps = candidate.reps;
  if (
    !hasLoad &&
    best.heaviest === undefined &&
    reps !== undefined &&
    best.mostReps !== undefined &&
    reps > best.mostReps.reps!
  ) {
    beaten.push({ kind: 'mostReps', beaten: best.mostReps });
  }

  return beaten;
}

export interface WorkoutRecordGroup {
  exerciseId: string;
  sets: readonly WorkoutSet[];
}

/**
 * The single record headline shown on each validated set of a live workout.
 *
 * The universe includes the current workout, so `recordsBeatenBy` remains the
 * canonical place that excludes the candidate and preserves record ordering.
 */
export function workoutRecordKinds(
  groups: readonly WorkoutRecordGroup[],
  setsByExercise: ReadonlyMap<string, WorkoutSet[]> | undefined,
): Map<string, RecordKind> {
  const records = new Map<string, RecordKind>();
  if (setsByExercise === undefined) return records;

  for (const group of groups) {
    const universe = setsByExercise.get(group.exerciseId);
    if (universe === undefined) continue;

    for (const set of group.sets) {
      if (set.isCompleted !== 1) continue;
      const [top] = recordsBeatenBy(set, universe);
      if (top !== undefined) records.set(set.id, top.kind);
    }
  }

  return records;
}
