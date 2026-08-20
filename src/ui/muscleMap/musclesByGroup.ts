import type { MuscleGroup } from '@/data/types';
import { MUSCLE_SCOPE, type RegionMuscle } from '@/lib/analytics/muscles';
import { MUSCLE_IDS, type MuscleId } from './muscleGroups';
import type { Intensities } from './muscleMap';

/**
 * Which drawn muscles belong to each of our muscle groups.
 *
 * The catalogue speaks in 16 drawable groups; the drawing speaks in 26 anatomical
 * muscles. This file is the join, and it is the only place the two vocabularies
 * meet — the component above it never names a `MuscleGroup`, and `MuscleId` never
 * reaches a screen.
 *
 * Typed on `RegionMuscle`, so it is **exhaustive by construction**: classify a new
 * group as a region in `MUSCLE_SCOPE` without giving it somewhere to be drawn and
 * the typecheck fails, rather than leaving a muscle that no exercise can ever
 * light.
 *
 * `MuscleGroup` is persisted — it is frozen into every session snapshot and into
 * the 175-exercise seed. So this table only ever *matches*; renaming a group to
 * suit the drawing would rewrite history.
 */
export const MUSCLE_IDS_BY_GROUP = {
  chest: ['pectoralis_major'],
  lats: ['latissimus_dorsi'],
  // The catalogue's two back groups split the drawing's trapezius bands the way
  // the movements do: a shrug is the upper band, a row is the middle and lower
  // ones plus the rhomboids under them. Lighting everything for both would make
  // every pulling exercise look identical.
  traps: ['trapezius_upper'],
  upper_back: ['trapezius_lower', 'rhomboids'],
  // The rotator cuff rides with the deltoids, and that is a real claim rather
  // than a convenience: it stabilises the glenohumeral joint in every shoulder
  // movement, so a press lighting it is anatomically true. Contrast the serratus
  // below, which a crunch does not work at all — that one we refuse. The
  // catalogue cannot separate the three external rotations from a lateral raise
  // anyway; both are `shoulders`.
  shoulders: ['deltoid_anterior', 'deltoid_lateral', 'deltoid_posterior', 'rotator_cuff'],
  biceps: ['biceps_brachii'],
  triceps: ['triceps_brachii'],
  forearms: ['forearm_flexors', 'forearm_extensors'],
  quads: ['quadriceps'],
  hamstrings: ['hamstrings'],
  glutes: ['gluteus_maximus', 'gluteus_medius'],
  adductors: ['adductors'],
  calves: ['calves'],
  // The obliques are part of the abdominal wall and belong here. The serratus is
  // not — cf. `UNMAPPED_MUSCLE_IDS`.
  abs: ['rectus_abdominis', 'obliques'],
  lower_back: ['erector_spinae'],
  neck: ['neck'],
} satisfies Record<RegionMuscle, readonly MuscleId[]>;

/**
 * Muscles that are drawn but never lit, listed rather than left to chance.
 *
 * Two reasons, both deliberate:
 *
 * - **A real muscle our catalogue cannot name** — `hip_flexors`,
 *   `tibialis_anterior`. `MuscleGroup` has no bucket for them, and inventing one
 *   here would put a word on the drawing that no exercise could ever set. They
 *   stay drawn because removing them would leave a hole in the body.
 * - **A real muscle we refuse to approximate** — `serratus_anterior`. It is a
 *   scapular protractor, not an abdominal, and folding it into `abs` would light
 *   it on every crunch.
 *
 * The test asserts this list is exactly the complement of `MUSCLE_IDS_BY_GROUP`,
 * so regenerating the drawing with a new or renamed muscle fails loudly instead
 * of quietly leaving a group unlit.
 */
export const UNMAPPED_MUSCLE_IDS: readonly MuscleId[] = [
  'hip_flexors',
  'serratus_anterior',
  'tibialis_anterior',
];

/**
 * Whether a group can be shown on the body at all.
 *
 * A type guard rather than a boolean, so the caller narrows to `RegionMuscle` and
 * can index the table without a cast.
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

/** Which muscles are lit, and how much. 0 to 1; anything absent stays unlit. */
export type MuscleHighlight = Partial<Record<MuscleGroup, number>>;

/**
 * A highlight in the catalogue's words, translated into the drawing's.
 *
 * Every muscle of a lit group takes the group's intensity — the catalogue records
 * *which* muscles a movement involves and never how much, so splitting one group's
 * value across its muscles would invent a precision that is not in the data.
 */
export function toIntensities(highlight: MuscleHighlight): Intensities {
  const intensities: Intensities = {};

  for (const [key, raw] of Object.entries(highlight)) {
    const muscle = key as MuscleGroup;
    // A group with no muscle — cardio, full body — simply has nothing to light.
    // It is not an error: `hasDrawableMuscles` decides whether the drawing is
    // worth showing at all.
    if (raw === undefined || !isDrawable(muscle)) continue;

    const intensity = Math.min(1, Math.max(0, raw));
    if (intensity === 0) continue;

    for (const id of MUSCLE_IDS_BY_GROUP[muscle]) intensities[id] = intensity;
  }

  return intensities;
}

/** Every muscle a group claims, flattened once — the test's read side. */
export const MAPPED_MUSCLE_IDS: readonly MuscleId[] = Object.values(MUSCLE_IDS_BY_GROUP).flat();

/** Every muscle the drawing defines, mapped or not. */
export const ALL_MUSCLE_IDS: readonly MuscleId[] = MUSCLE_IDS;

/**
 * The reverse join: which group a drawn muscle belongs to.
 *
 * `MUSCLE_IDS_BY_GROUP` reads from the catalogue to the drawing, which is what
 * lighting a body needs. A tap needs the other direction — a finger lands on a
 * path, and the question is what to look up in a catalogue that has never heard
 * of a rhomboid.
 *
 * Built from the same table rather than written a second time: a hand-kept
 * mirror is a mirror that drifts.
 */
const GROUP_BY_MUSCLE_ID: Partial<Record<MuscleId, RegionMuscle>> = Object.fromEntries(
  Object.entries(MUSCLE_IDS_BY_GROUP).flatMap(([group, ids]) =>
    ids.map((id) => [id, group as RegionMuscle]),
  ),
);

/**
 * The group a tapped muscle belongs to — `null` when the catalogue has no word
 * for it.
 *
 * `null` is not a failure to handle quietly: the three muscles of
 * `UNMAPPED_MUSCLE_IDS` are drawn on purpose, so a finger *will* land on them.
 * The caller owes that finger an answer; it simply cannot be a list of
 * exercises.
 */
export function groupOfMuscleId(id: MuscleId): RegionMuscle | null {
  return GROUP_BY_MUSCLE_ID[id] ?? null;
}
