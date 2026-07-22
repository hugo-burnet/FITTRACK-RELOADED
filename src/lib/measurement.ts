import type { MeasurementType } from '@/data/types';

/**
 * What a planned set can prescribe, per measurement type.
 *
 * This module is the missing wire between Lot 2 and Lot 4: `measurementType` has
 * been on every exercise since the catalogue was seeded, and until now **nothing
 * read it outside the creation form**. Every routine therefore offered the same
 * three fields — reps, rep range, load — to a plank, a rower and a bench press,
 * and there was no way at all to prescribe 45 seconds. Reported from real use.
 *
 * Pure by construction (architecture §7): a measurement type in, a shape out.
 * The set sheet renders from it, the set row formats from it, so the two can
 * never disagree about what an exercise is measured in.
 */

export type TargetField = 'reps' | 'weight' | 'duration' | 'distance';

/**
 * What the kilos actually mean. The same number is a load on a bench press,
 * a belt you hang off a pull-up, or an assistance that takes weight *off* —
 * and calling all three "charge" is the simplest way for a routine to lie about
 * what it prescribes.
 */
export type WeightRole = 'load' | 'added' | 'assist';

export interface MeasurementShape {
  fields: TargetField[];
  /** Absent where the type has no weight field at all. */
  weightRole?: WeightRole;
}

/** Every target a set may carry. Structural, so `lib/` needs no entity type. */
export interface Targets {
  targetReps?: number;
  targetRepsMax?: number;
  targetWeight?: number;
  targetDurationSeconds?: number;
  targetDistanceMeters?: number;
}

/** Unit keys, not words: the French lives in `i18n/fr.ts`, never here. */
export type TargetUnit = 'reps' | 'kg' | 'seconds' | 'minutes' | 'meters' | 'kilometers';

export interface TargetPart {
  value: string;
  unit: TargetUnit;
  /** `+` for added load, `−` for assistance. */
  prefix?: '+' | '−';
}

const SHAPES: Record<MeasurementType, MeasurementShape> = {
  weight_reps: { fields: ['reps', 'weight'], weightRole: 'load' },
  // Bodyweight, but a belt and a plate are exactly how you progress it.
  reps_only: { fields: ['reps', 'weight'], weightRole: 'added' },
  weight_time: { fields: ['duration', 'weight'], weightRole: 'load' },
  time_only: { fields: ['duration'] },
  distance_time: { fields: ['distance', 'duration'] },
  // The machine's weight helps you up, so more of it is an easier set.
  assisted_weight_reps: { fields: ['reps', 'weight'], weightRole: 'assist' },
};

export function measurementShape(type: MeasurementType): MeasurementShape {
  return SHAPES[type];
}

/**
 * French formatting lives here rather than in the component, for the same reason
 * `NumberInput` writes a comma: in this app a number is UI text, and "102,5" is
 * how it is read everywhere else.
 */
const decimal = (value: number): string => value.toLocaleString('fr-FR');

/** Under a minute, seconds read plainly. Past it, m:ss is what a gym clock shows. */
function duration(seconds: number): TargetPart {
  if (seconds < 60) return { value: decimal(seconds), unit: 'seconds' };
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return { value: `${minutes}:${String(rest).padStart(2, '0')}`, unit: 'minutes' };
}

function distance(meters: number): TargetPart {
  if (meters < 1000) return { value: decimal(meters), unit: 'meters' };
  return { value: decimal(Math.round((meters / 1000) * 100) / 100), unit: 'kilometers' };
}

function reps(targets: Targets): TargetPart | undefined {
  const { targetReps, targetRepsMax } = targets;
  if (targetReps === undefined) return undefined;

  // A maximum that does not exceed the minimum is not a range.
  const value =
    targetRepsMax !== undefined && targetRepsMax > targetReps
      ? `${decimal(targetReps)} – ${decimal(targetRepsMax)}`
      : decimal(targetReps);

  return { value, unit: 'reps' };
}

function weight(targets: Targets, role: WeightRole | undefined): TargetPart | undefined {
  if (targets.targetWeight === undefined || role === undefined) return undefined;
  return {
    value: decimal(targets.targetWeight),
    unit: 'kg',
    prefix: role === 'added' ? '+' : role === 'assist' ? '−' : undefined,
  };
}

/**
 * The set's targets as at most two readings, in the order they are read.
 *
 * Targets belonging to another measurement type are dropped rather than shown:
 * a plank that quietly carried a rep count from an earlier edit would display a
 * number nobody can perform.
 */
export function targetParts(type: MeasurementType, targets: Targets): TargetPart[] {
  const shape = measurementShape(type);

  return shape.fields.flatMap((field) => {
    const part =
      field === 'reps'
        ? reps(targets)
        : field === 'weight'
          ? weight(targets, shape.weightRole)
          : field === 'duration'
            ? targets.targetDurationSeconds !== undefined
              ? duration(targets.targetDurationSeconds)
              : undefined
            : targets.targetDistanceMeters !== undefined
              ? distance(targets.targetDistanceMeters)
              : undefined;

    return part === undefined ? [] : [part];
  });
}
