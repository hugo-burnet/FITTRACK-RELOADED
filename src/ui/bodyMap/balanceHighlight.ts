import type { MuscleGroup } from '@/data/types';
import type { MuscleHighlight } from './BodyMap';
import { isDrawable } from './regionsByMuscle';

/**
 * How much a muscle was worked, in whatever unit the caller counts in.
 *
 * `value` and not `sets`: the balance screen passes a number of working sets,
 * a session passes a weighted involvement. The ramp only ever compares values
 * with each other, so it does not need to know which.
 */
export interface MuscleWeight {
  muscle: MuscleGroup | undefined;
  value: number;
}

/**
 * The floor a worked muscle is drawn at.
 *
 * Without it, one heavy leg day makes every other muscle round to nothing and
 * the body reads as "you only train quads", when in fact you also benched. The
 * distinction that matters on this drawing is **worked versus not worked**, and
 * it must survive an outlier. Above the floor the ramp is proportional again.
 */
export const WORKED_FLOOR = 0.25;

/**
 * Sets per muscle, as intensities — the aggregate counterpart of
 * `exerciseHighlight`.
 *
 * Normalised on the **busiest muscle**, not on the total: the reading is "this
 * against that", and dividing by the total would make every muscle fade as the
 * period widens, which says nothing about training.
 *
 * **A dark region is the finding, and that is what makes this drawing legitimate
 * where a coloured bar chart would not be.** `MuscleBalanceCard` refuses to
 * colour its rows because highlighting the most-trained muscle would congratulate
 * an imbalance. Here the eye goes to the *gaps* — a body whose legs stay dark
 * reads as "you skip legs" at a glance, which is exactly the shortfall that
 * screen exists to report, and which its sixteen rows make you read one by one.
 * The accent is still never spent: this is the same value ramp as everywhere.
 */
export function balanceHighlight(weights: readonly MuscleWeight[]): MuscleHighlight {
  const worked = weights.filter(
    (entry) => entry.muscle !== undefined && entry.value > 0 && isDrawable(entry.muscle),
  );

  const busiest = Math.max(0, ...worked.map((entry) => entry.value));
  if (busiest === 0) return {};

  return Object.fromEntries(
    worked.map((entry) => [
      entry.muscle,
      WORKED_FLOOR + (1 - WORKED_FLOOR) * (entry.value / busiest),
    ]),
  );
}
