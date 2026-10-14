import { measurementShape, type WeightRole } from '@/lib/measurement';
import { isWorkingSet } from '@/lib/records';
import type { CoachExerciseLine, CoachSetInput } from './types';

/**
 * Ce qu'une règle a le droit de juger dans une séance : quelles séries comptent, lesquelles sont
 * écartées (échauffements, dégressives, séries à l'échec pour le bas de fourchette), l'effort moyen,
 * le plafond de la prescription. Aucune règle n'y décide quoi que ce soit : elles lisent toutes les
 * mêmes séries, ici, pour que deux règles ne se contredisent pas sur ce qu'est « la séance ».
 */

export function completedWorkingSets(sets: readonly CoachSetInput[]): CoachSetInput[] {
  return sets
    .filter((set) => set.isCompleted === 1 && isWorkingSet(set) && set.performedAt > 0)
    .slice()
    .sort((a, b) => a.order - b.order || a.performedAt - b.performedAt);
}

/** Is `weight` an easier set than `reference`? Assistance reads the other way. */
function isEasierLoad(weight: number, reference: number, role: WeightRole): boolean {
  return role === 'assist' ? weight > reference : weight < reference;
}

/**
 * The sets a progression rule may judge: working sets at the session's top load.
 *
 * A drop set and a back-off set are lighter *on purpose* — reading their reps as
 * a collapse, or their load as the one to beat next time, turns a deliberate
 * choice into a diagnosis. `isWorkingSet` only knows about warm-ups.
 */
export function progressionSets(line: CoachExerciseLine): CoachSetInput[] {
  const working = completedWorkingSets(line.sets).filter((set) => set.setType !== 'dropset');
  const role = measurementShape(line.measurementType).weightRole;
  const reference = working.find((set) => set.weight !== undefined)?.weight;
  if (role === undefined || reference === undefined) return working;
  return working.filter(
    (set) => set.weight === undefined || !isEasierLoad(set.weight, reference, role),
  );
}

/**
 * The sets the floor of a prescription may judge: progression sets, minus the
 * ones taken to failure on purpose (spec coach v2, R2). The ceiling still reads
 * them — see `rangeFlags`.
 *
 * A failure set is the last one pushed past the prescription. Its reps fall by
 * design: `12 @8,5` then `F 8 @9,5` is the plan working, and reading it as « Baisse
 * de reps » three sessions running — or as a floor missed, which proposed 5 → 2,5 kg
 * on lateral raises — taught the user to ignore the card. The 1RM, the top load
 * and the rep record still read failure sets: they are the best-measured of the
 * session.
 */
export function judgedSets(line: CoachExerciseLine): CoachSetInput[] {
  return progressionSets(line).filter((set) => set.setType !== 'failure');
}

/**
 * Mean RPE of the judged sets (spec coach v2, R1), failure sets excluded: they
 * are at 10 by design and would drag every session toward « à l'échec ».
 * Undefined unless at least half of those sets carry an RPE — an absent RPE is
 * neither a 10 nor a 7, and a mean of one set out of four is not the session's.
 */
export function sessionEffort(line: CoachExerciseLine): number | undefined {
  const judged = judgedSets(line);
  const rated = judged
    .map((set) => set.rpe)
    .filter((rpe): rpe is number => typeof rpe === 'number' && Number.isFinite(rpe));
  if (judged.length === 0 || rated.length * 2 < judged.length) return undefined;
  return rated.reduce((sum, rpe) => sum + rpe, 0) / rated.length;
}

export function roundRpe(value: number): number {
  return Math.round(value * 10) / 10;
}

export function isDeloadLine(line: CoachExerciseLine): boolean {
  return line.programIsDeload === 1 ||
    (typeof line.deloadPercent === 'number' &&
      line.deloadPercent > 0 &&
      line.deloadPercent < 100);
}

/** Ceiling of the prescribed rep contract: open top of a range, or the single target. */
export function effectiveCeiling(set: CoachSetInput): number | undefined {
  return set.targetRepsMax ?? set.targetReps;
}
