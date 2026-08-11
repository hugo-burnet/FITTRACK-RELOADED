import type {
  CoachSignalCode,
  Equipment,
  MeasurementType,
  SetType,
} from '@/data/types';
import type { OneRepMaxFormula } from '@/lib/oneRepMax';

export type { CoachSignalCode };

export interface CoachEvidence {
  /** Stable machine key the UI localises, e.g. `target_reps_max`. */
  label: string;
  value: number;
}

export interface CoachSignal {
  code: CoachSignalCode;
  exerciseId: string;
  /** Proposed next load when the rule has one (range_completed only in V1). */
  nextLoadKg?: number;
  evidence: CoachEvidence[];
  severity: number;
}

/** One validated set the engine may read. Pure structural input — no Dexie. */
export interface CoachSetInput {
  setType: SetType;
  isCompleted: 0 | 1;
  reps?: number;
  weight?: number;
  targetReps?: number;
  targetRepsMax?: number;
  performedAt: number;
  order: number;
}

/**
 * One exercise appearance in a completed workout.
 * The same exercise twice in a session is two lines — the engine merges them.
 */
export interface CoachExerciseLine {
  exerciseId: string;
  workoutId: string;
  /** Session start (or any stable workout clock) for ordering history. */
  workoutStartedAt: number;
  deloadPercent?: number;
  importSource?: string;
  measurementType: MeasurementType;
  equipment: Equipment;
  loadIncrementKg?: number;
  sets: CoachSetInput[];
}

export interface CoachEvaluateOptions {
  formula?: OneRepMaxFormula;
  /** Consecutive sessions without 1RM progress before plateau (default 3). */
  plateauSessions?: number;
  /** Absolute rep drop from the session's first working set (default 2). */
  dropReps?: number;
  /** Rest gap (ms) considered long when a drop is also present (default 180_000). */
  longRestMs?: number;
}
