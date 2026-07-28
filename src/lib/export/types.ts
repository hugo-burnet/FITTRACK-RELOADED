import type {
  Equipment,
  Exercise,
  MeasurementType,
  MuscleGroup,
  SetType,
  Side,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/data/types';
import type { SessionTotals } from '@/lib/volume';

/**
 * The shape of a shareable export, independent of Dexie.
 *
 * Three serialisers will read it — Markdown here, CSV and JSON later — and they
 * must never disagree about what a session contains. That is the whole reason
 * the projection exists as a layer rather than as three formatting functions
 * each walking the tables their own way.
 */

/**
 * What is being exported. A discriminated union rather than a bag of optional
 * filters: `{ exerciseId, from, to }` with everything optional cannot say
 * "one session" and would let "no filter at all" mean either the whole history
 * or a bug.
 */
export type ExportScope =
  | { kind: 'workout'; workoutId: string }
  /** `from`/`to` narrow the exercise's own history; absent means all of it. */
  | { kind: 'exercise'; exerciseId: string; from?: number; to?: number }
  /** `from` inclusive, `to` exclusive — the bounds `listHistoryDay` already uses. */
  | { kind: 'period'; from: number; to: number }
  | { kind: 'all-history' };

export interface ExportOptions {
  /**
   * Warm-ups are kept by default. They are what a coach reads to judge whether
   * the ramp was sane, and dropping them silently would make the set numbers
   * disagree with the app's own screen.
   */
  includeWarmups: boolean;
  includeNotes: boolean;
  /**
   * Internal UUIDs, off by default: they mean nothing to a human or to an AI,
   * and they are the one part of an export that is genuinely private plumbing.
   */
  includeIds: boolean;
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includeWarmups: true,
  includeNotes: true,
  includeIds: false,
};

/**
 * The rows one session contributes, as the repository hands them over.
 *
 * `exercise` is today's library row — kept **even when soft-deleted**, because a
 * deleted exercise is still the exercise that was performed. It is only ever a
 * fallback: the row's own snapshot wins, cf. `projectCoachExport`.
 */
export interface ExportSource {
  workout: Workout;
  exercises: Array<{
    row: WorkoutExercise;
    exercise: Exercise | undefined;
    sets: WorkoutSet[];
  }>;
}

export interface CoachExport {
  format: 'fittrack-coach-export';
  /**
   * Declared from the first export, before anything reads it back. A version
   * number is the one thing that cannot be added afterwards to files already
   * sent: a reader facing an unversioned document has to guess.
   */
  schemaVersion: 1;
  /** ISO UTC — when the document was produced, not when anything was trained. */
  exportedAt: string;
  scope: ExportScope;
  workoutCount: number;
  /** Warm-ups excluded, per `isWorkingSet` — the app's one rule for counting. */
  workingSetCount: number;
  workouts: ExportWorkout[];
}

export interface ExportWorkout {
  id?: string;
  name: string;
  notes?: string;
  /** ISO carrying the session's own offset, e.g. `2026-07-27T18:20:00+02:00`. */
  startedAt: string;
  /** `'2026-07-27'`, the civil day in the session's own offset. */
  localDate: string;
  timezoneOffsetMinutes: number;
  /** Wall time between start and finish, pauses included — cf. `Workout`. */
  durationSeconds: number;
  /**
   * The session's own totals, computed by `sessionTotals` — the very function
   * the history screen displays.
   *
   * They are carried rather than recomputed by each serialiser for one reason:
   * an export announcing a tonnage the screen does not show would be a bug, not
   * a presentation difference. The rule that tonnage counts only a real load,
   * and never an assistance or a belt, is `sessionTotals`' and is not restated
   * anywhere downstream.
   *
   * Under an `exercise` scope they cover the kept exercise only.
   */
  totals: SessionTotals;
  exercises: ExportExercise[];
}

export interface ExportExercise {
  id?: string;
  /**
   * Absent when the row carries no snapshot **and** the library no longer holds
   * the exercise. Nothing is invented here — naming the gap in French is the
   * serialiser's job, and inventing a placeholder would destroy the fallback.
   */
  name?: string;
  measurementType?: MeasurementType;
  primaryMuscle?: MuscleGroup;
  equipment?: Equipment;
  notes?: string;
  sets: ExportSet[];
}

export interface ExportSet {
  /** 1-based rank **among the exported sets**, so dropping warm-ups renumbers. */
  number: number;
  type: SetType;
  side: Side;
  /** Always kilograms. What they mean is decided by `measurementType`. */
  weightKg?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
  rpe?: number;
}
