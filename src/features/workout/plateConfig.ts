import type { Equipment, Exercise } from '@/data/types';
import { measurementShape } from '@/lib/measurement';

/**
 * How a bar is loaded, per equipment. Only the three that actually take loose
 * plates: a pin-loaded machine or a fixed dumbbell has nothing to calculate, and
 * showing them a plate diagram would be a confident lie. Kept out of
 * `lib/plates` so the engine stays free of the app's `Equipment` vocabulary.
 */
const LOADABLE: Partial<Record<Equipment, { barWeight: number; sides: number }>> = {
  barbell: { barWeight: 20, sides: 2 },
  smith: { barWeight: 20, sides: 2 },
  plate: { barWeight: 0, sides: 2 }, // plate-loaded machine (leg press, hack squat)
};

/**
 * The bar setup for an exercise, or null when there is nothing to load.
 *
 * Two gates, both required: the weight has to be a genuine bar **load** — not a
 * belt added to a pull-up (`added`) nor a machine's assistance (`assist`) — and
 * the equipment has to be one that takes plates. The workout screen calls this
 * to decide whether the "Plaques" menu entry appears at all.
 */
export function platesConfigFor(exercise: Exercise): { barWeight: number; sides: number } | null {
  if (measurementShape(exercise.measurementType).weightRole !== 'load') return null;
  return LOADABLE[exercise.equipment] ?? null;
}
