import type { MeasurementType, WorkoutSet } from '@/data/types';
import { t } from '@/i18n/fr';
import { measurementShape } from '@/lib/measurement';
import { isWorkingSet } from '@/lib/records';

/** Ce que le calcul lit d'une série : `WorkoutSet` comme `HistoricalSet` y répondent. */
type SetLike = Pick<WorkoutSet, 'setType' | 'weight' | 'reps'>;

const decimal = (value: number): string => value.toLocaleString('fr-FR');

/**
 * Whether `candidate` beats `best` by load. For an assisted exercise the
 * direction flips: the *less* assisted set is the better one, the same rule as
 * the `min_assistance` record (`src/lib/records.ts`, where lower wins and 0 is a
 * valid value). Taking the heaviest load there showed the worst set of the
 * session as its best. Equal load: more repetitions wins.
 */
function betterByLoad(candidate: SetLike, best: SetLike, assisted: boolean): boolean {
  if (candidate.weight === best.weight) return (candidate.reps ?? 0) > (best.reps ?? 0);
  return assisted ? candidate.weight! < best.weight! : candidate.weight! > best.weight!;
}

/**
 * The best set of a run, in one line. Falls back from load to repetitions, so a
 * pull-up reads "14 reps" instead of a blank — all six measurement types are
 * covered without naming any of them.
 */
export function topSetLabel(
  sets: readonly SetLike[],
  measurementType: MeasurementType,
): string | undefined {
  const assisted = measurementShape(measurementType).weightRole === 'assist';
  const workingSets = sets.filter(isWorkingSet);
  const best = workingSets.reduce<SetLike | undefined>((acc, candidate) => {
    // A load of 0 is a result only for assistance: no help at all.
    if (candidate.weight === undefined || candidate.weight < 0) return acc;
    if (candidate.weight === 0 && !assisted) return acc;
    return acc === undefined || betterByLoad(candidate, acc, assisted) ? candidate : acc;
  }, undefined);
  const mostReps = workingSets.reduce<SetLike | undefined>((acc, candidate) => {
    if (candidate.reps === undefined || candidate.reps <= 0) return acc;
    return acc === undefined || candidate.reps > acc.reps! ? candidate : acc;
  }, undefined);

  if (best?.weight !== undefined) {
    return best.reps === undefined
      ? t('exercise.recordWeight', { weight: decimal(best.weight) })
      : t('exercise.recordWeightReps', { weight: decimal(best.weight), reps: best.reps });
  }

  if (mostReps?.reps !== undefined) return t('exercise.recordReps', { reps: mostReps.reps });
  return undefined;
}
