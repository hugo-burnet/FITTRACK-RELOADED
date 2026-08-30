import type { MuscleGroup } from '@/data/types';
import { isDrawable, type MuscleHighlight } from './musclesByGroup';

/** What the catalogue says a movement involves, and nothing more. */
export interface HighlightedExercise {
  primaryMuscle: MuscleGroup;
  secondaryMuscles?: MuscleGroup[];
}

/** Full intensity, and the dimmer step a secondary muscle is drawn at. */
const PRIMARY_INTENSITY = 1;
const SECONDARY_INTENSITY = 0.4;

/**
 * An exercise's muscles, as intensities the body map can draw.
 *
 * 1 for the primary, 0.4 for the secondaries, as the roadmap fixes them. Not a
 * measurement: the catalogue records *which* muscles a movement involves, never
 * how much, and a finer number here would be invented. The two values exist to
 * be told apart at a glance.
 *
 * **A primary the body cannot draw promotes the secondaries.** Eighteen
 * catalogue entries are filed under `cardio`, `full_body` or `other` while
 * naming real muscles underneath — a stepper is `cardio`, with the quadriceps
 * and the glutes as secondaries. Drawn at 0.4 they would read as an
 * afterthought, when they are in fact everything this drawing has to say: 0.4
 * only means something *relative to* a primary, and here the ramp has no top.
 * So when the primary has nowhere to be drawn, the secondaries become the top.
 */
export function exerciseHighlight(exercise: HighlightedExercise): MuscleHighlight {
  // Only what can actually be drawn comes out of here: this is an instruction
  // to a drawing, not a copy of the catalogue. The words the user reads are the
  // card's business, and it lists every muscle, drawable or not.
  const secondaries = (exercise.secondaryMuscles ?? []).filter(
    (muscle) => muscle !== exercise.primaryMuscle && isDrawable(muscle),
  );

  const primaryIsDrawn = isDrawable(exercise.primaryMuscle);
  const secondaryLevel = primaryIsDrawn ? SECONDARY_INTENSITY : PRIMARY_INTENSITY;

  return {
    ...Object.fromEntries(secondaries.map((muscle) => [muscle, secondaryLevel])),
    // Written last: a muscle listed as both is primary, and reading it at the
    // dimmer step would understate the movement.
    ...(primaryIsDrawn ? { [exercise.primaryMuscle]: PRIMARY_INTENSITY } : {}),
  };
}
