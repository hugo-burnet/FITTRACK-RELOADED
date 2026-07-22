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

// ---------------------------------------------------------------------------
// Saisie — ce que la grille de la séance en direct affiche comme colonnes
// ---------------------------------------------------------------------------

/** One editable column of the live workout grid. */
export interface EntryColumn {
  field: TargetField;
  unit: TargetUnit;
  /** `+` for added load, `−` for assistance — same reading as `targetParts`. */
  prefix?: '+' | '−';
}

/**
 * Entry order, deliberately not the reading order of `MeasurementShape.fields`.
 *
 * A set is *read* "8 – 12 reps · 102,5 kg" but it is *entered* load first,
 * because that is the order it is decided in: the plates are on the bar before
 * the first repetition.
 */
const ENTRY_ORDER: TargetField[] = ['weight', 'distance', 'reps', 'duration'];

/**
 * The unit each field is typed in. A duration is always entered in seconds even
 * though it is displayed as m:ss past a minute: an input unit that changed at a
 * threshold would have someone type 90 into a field that expected 1:30.
 */
const ENTRY_UNIT: Record<TargetField, TargetUnit> = {
  weight: 'kg',
  distance: 'meters',
  reps: 'reps',
  duration: 'seconds',
};

/**
 * The columns of the live grid, derived from the same shape the set sheet and
 * the set row read. The grid never decides on its own what an exercise is
 * measured in — that is the whole point of this module.
 */
export function entryColumns(type: MeasurementType): EntryColumn[] {
  const shape = measurementShape(type);

  return ENTRY_ORDER.filter((field) => shape.fields.includes(field)).map((field) => ({
    field,
    unit: ENTRY_UNIT[field],
    prefix:
      field === 'weight'
        ? shape.weightRole === 'added'
          ? '+'
          : shape.weightRole === 'assist'
            ? '−'
            : undefined
        : undefined,
  }));
}

/** A set's figures resolved per column: what was typed, or what is proposed. */
export type ResolvedValues = Partial<Record<TargetField, number>>;

/**
 * Whether ✓ may record this set — **the load excepted**.
 *
 * The load is the one figure a set may legitimately not have: a pull-up with no
 * belt, an empty bar, a machine whose stack you did not note. What the exercise
 * is *measured in* — repetitions, seconds, metres — is not optional, and until
 * now nothing checked it. A set prescribed as a range with no history behind it
 * had neither a typed figure nor a proposed one, so the tick validated a
 * completed set carrying no repetitions at all: counted in the séries, worth
 * zero reps and zero tonnage in the totals, and handed to the next session as
 * the reference for what you lifted. Rule n°4 — the tick stays shut rather than
 * record that.
 */
export function isSetRecordable(columns: EntryColumn[], values: ResolvedValues): boolean {
  return columns.every(
    (column) => column.field === 'weight' || values[column.field] !== undefined,
  );
}

/** What a set actually holds once performed — the mirror of `Targets`. */
export interface Performed {
  weight?: number;
  reps?: number;
  durationSeconds?: number;
  distanceMeters?: number;
}

/**
 * A performed set as readings, formatted exactly like a prescribed one.
 *
 * Remapped onto `Targets` rather than formatted again: "80 kg" must not be
 * written one way on a routine line and another way on a history line, and the
 * only way to guarantee that is to have a single implementation.
 */
export function performedParts(type: MeasurementType, set: Performed): TargetPart[] {
  return targetParts(type, {
    targetReps: set.reps,
    targetWeight: set.weight,
    targetDurationSeconds: set.durationSeconds,
    targetDistanceMeters: set.distanceMeters,
  });
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

/**
 * Exported because the live grid shows the prescription as the field's ghost,
 * and "8 – 12" has to read identically there and on the routine line. It is
 * also the one reading that is **not a number**, which is why the tick records
 * nothing from it: a range is not a value you can have performed.
 */
export function repsReading(targets: Targets): TargetPart | undefined {
  const { targetReps, targetRepsMax } = targets;
  if (targetReps === undefined) return undefined;

  const value = isRepRange(targets)
    ? `${decimal(targetReps)} – ${decimal(targetRepsMax ?? targetReps)}`
    : decimal(targetReps);

  return { value, unit: 'reps' };
}

/**
 * A maximum that does not exceed the minimum is not a range.
 *
 * Named and exported because two very different things hang off it: how the
 * reps read, and whether the live grid's tick may record them at all. A range
 * is not a value you can have performed, so it is the one prescription the tick
 * cannot confirm on your behalf.
 */
export const isRepRange = (targets: Targets): boolean =>
  targets.targetReps !== undefined &&
  targets.targetRepsMax !== undefined &&
  targets.targetRepsMax > targets.targetReps;

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
        ? repsReading(targets)
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
