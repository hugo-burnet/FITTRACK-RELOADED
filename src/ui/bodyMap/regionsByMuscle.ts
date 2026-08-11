import type { MuscleGroup } from '@/data/types';
import { MUSCLE_SCOPE, type RegionMuscle } from '@/lib/analytics/muscles';
import { BACK_REGIONS, FRONT_REGIONS } from './vendorPaths';

/**
 * Which drawn regions belong to each of our muscle groups.
 *
 * The catalogue speaks in 16 drawable groups; the geometry speaks in 89 named
 * regions. This file is the join, and it is the only place the two vocabularies
 * meet — the component below it never knows a vendor id, and `MuscleGroup` never
 * leaks into the geometry.
 *
 * Typed on `RegionMuscle`, so it is **exhaustive by construction**: classify a
 * new group as a region in `MUSCLE_SCOPE` without giving it somewhere to be
 * drawn and the typecheck fails. That is the roadmap's warning for this lot,
 * answered by the compiler rather than by vigilance.
 */
export const REGIONS_BY_MUSCLE = {
  chest: ['chest-upper-left', 'chest-upper-right', 'chest-lower-left', 'chest-lower-right'],
  lats: [
    'lats-upper-left',
    'lats-mid-left',
    'lats-lower-left',
    'lats-upper-right',
    'lats-mid-right',
    'lats-lower-right',
  ],
  // Our two back groups split the vendor's three trapezius bands the way the
  // movements do: a shrug is the upper band, a row is the middle and lower ones.
  // Lighting all three for both would make every pulling exercise look identical.
  traps: ['traps-upper-left', 'traps-upper-right'],
  upper_back: ['traps-mid-left', 'traps-lower-left', 'traps-mid-right', 'traps-lower-right'],
  shoulders: [
    'shoulder-front-left',
    'shoulder-side-left',
    'deltoid-rear-left',
    'shoulder-front-right',
    'shoulder-side-right',
    'deltoid-rear-right',
  ],
  biceps: ['biceps-left', 'biceps-right'],
  triceps: [
    'triceps-long-left',
    'triceps-lateral-left',
    'triceps-long-right',
    'triceps-lateral-right',
  ],
  forearms: [
    'forearm-left',
    'forearm-flexors-left',
    'forearm-extensors-left',
    'forearm-right',
    'forearm-flexors-right',
    'forearm-extensors-right',
  ],
  quads: ['quads-left', 'quads-right'],
  hamstrings: [
    'hamstrings-medial-left',
    'hamstrings-lateral-left',
    'hamstrings-medial-right',
    'hamstrings-lateral-right',
  ],
  glutes: [
    'gluteus-maximus-left',
    'gluteus-medius-left',
    'gluteus-maximus-right',
    'gluteus-medius-right',
  ],
  adductors: ['adductors-left', 'adductors-right'],
  calves: [
    'calves-gastroc-medial-left',
    'calves-gastroc-lateral-left',
    'calves-soleus-left',
    'calves-gastroc-medial-right',
    'calves-gastroc-lateral-right',
    'calves-soleus-right',
  ],
  // The obliques are part of the abdominal wall and belong here. The serratus is
  // not — cf. `UNDRAWN_REGIONS`.
  abs: [
    'abs-upper-left',
    'abs-lower-left',
    'obliques-left',
    'abs-upper-right',
    'abs-lower-right',
    'obliques-right',
  ],
  lower_back: [
    'lower-back-erectors-left',
    'lower-back-ql-left',
    'lower-back-erectors-right',
    'lower-back-ql-right',
  ],
  neck: ['neck-left', 'neck-right', 'nape'],
} satisfies Record<RegionMuscle, readonly string[]>;

/**
 * Regions that are drawn but never lit, listed rather than left to chance.
 *
 * Three different reasons, all deliberate:
 *
 * - **No muscle at all** — head, face, hands, feet, elbows, knees, spine. They
 *   are what makes the silhouette read as a body.
 * - **A real muscle our catalogue cannot name** — `hip-flexor`,
 *   `tibialis-anterior`. `MuscleGroup` has no bucket for them, and inventing one
 *   here would put a word on the drawing that no exercise can ever set.
 * - **A real muscle we refuse to approximate** — `serratus-anterior`. It is not
 *   an abdominal, and folding it into `abs` would light it on every crunch.
 *
 * The test asserts this list is exactly the complement of `REGIONS_BY_MUSCLE`,
 * so a vendor update that adds or renames a region fails loudly instead of
 * quietly leaving a hole in the body.
 */
export const UNDRAWN_REGIONS: readonly string[] = [
  'head',
  'face',
  'head-back',
  'spine',
  'serratus-anterior-left',
  'serratus-anterior-right',
  'hip-flexor-left',
  'hip-flexor-right',
  'tibialis-anterior-left',
  'tibialis-anterior-right',
  'elbow-left',
  'elbow-right',
  'knee-left',
  'knee-right',
  'knee-back-left',
  'knee-back-right',
  'hand-left',
  'hand-right',
  'hand-back-left',
  'hand-back-right',
  'foot-left',
  'foot-right',
  'foot-back-left',
  'foot-back-right',
];

/** Every region id the embedded geometry actually defines. */
export const ALL_REGION_IDS: readonly string[] = [...FRONT_REGIONS, ...BACK_REGIONS].map(
  (region) => region.id,
);

/** Reverse index, built once: a vendor id back to the group that lights it. */
const MUSCLE_BY_REGION = new Map<string, RegionMuscle>(
  Object.entries(REGIONS_BY_MUSCLE).flatMap(([muscle, ids]) =>
    ids.map((id) => [id, muscle as RegionMuscle] as const),
  ),
);

export const muscleOfRegion = (regionId: string): RegionMuscle | undefined =>
  MUSCLE_BY_REGION.get(regionId);

/**
 * Whether a group can be shown on the body at all.
 *
 * A type guard rather than a boolean, so the caller narrows to `RegionMuscle`
 * and can index the map without a cast.
 */
export const isDrawable = (muscle: MuscleGroup): muscle is RegionMuscle =>
  MUSCLE_SCOPE[muscle] === 'region';

/**
 * Whether an exercise has anything at all to show — primary **or** secondary.
 *
 * The roadmap's checkpoint in one function: opening a cardio exercise must not
 * produce an empty, mute silhouette. The screen asks this first and omits the
 * whole section when the answer is no, rather than drawing a grey body and an
 * apology.
 */
export function hasDrawableMuscles(exercise: {
  primaryMuscle: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
}): boolean {
  return isDrawable(exercise.primaryMuscle) || (exercise.secondaryMuscles ?? []).some(isDrawable);
}
