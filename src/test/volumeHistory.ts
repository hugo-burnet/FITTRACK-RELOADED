import { createCustomExercise } from '@/data/repositories/exercises';
import type { MuscleGroup } from '@/data/types';
import { startOfLocalWeek } from '@/lib/history';
import { seedWorkout } from './factories';

/**
 * De l'historique de volume pour les tests des écrans : des séances terminées, rangées par semaine
 * complète. Les écrans lisent « maintenant » (`Date.now()`), donc tout est compté depuis lui.
 */

/** Le mercredi à midi de la semaine complète numéro `weeksAgo` avant la semaine en cours (1 = la dernière). */
export function midWeek(weeksAgo: number, now = Date.now()): number {
  const date = new Date(startOfLocalWeek(now));
  date.setDate(date.getDate() - weeksAgo * 7 + 2);
  date.setHours(12, 0, 0, 0);
  return date.getTime();
}

/**
 * Une séance terminée par semaine complète pour un muscle, `perWeek` de la plus ancienne à la dernière
 * (une valeur nulle : pas de séance cette semaine-là). Rend l'exercice créé.
 */
export async function seedMuscleWeeks(
  muscle: MuscleGroup,
  perWeek: readonly number[],
  now = Date.now(),
): Promise<string> {
  const exercise = await createCustomExercise({
    name: `Exercice ${muscle}`,
    primaryMuscle: muscle,
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isUnilateral: 0,
  });

  for (const [index, sets] of perWeek.entries()) {
    if (sets === 0) continue;
    await seedWorkout({
      exerciseId: exercise.id,
      performedAt: midWeek(perWeek.length - index, now),
      sets: Array.from({ length: sets }, () => [60, 10] as [number, number]),
    });
  }
  return exercise.id;
}
