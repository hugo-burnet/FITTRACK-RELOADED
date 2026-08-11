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

/** 0 whenever either half is missing: a plank and a pull-up have no tonnage. */
export function setVolume(set: Pick<WorkoutSet, 'weight' | 'reps'>): number {
  if (set.weight === undefined || set.reps === undefined) return 0;
  return set.weight * set.reps;
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
