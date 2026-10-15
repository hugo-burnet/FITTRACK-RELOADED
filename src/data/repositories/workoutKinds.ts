import { db } from '@/data/db';

/**
 * Parmi ces séances, lesquelles sont des benchmarks.
 *
 * Le seul endroit où les lectures qui **prescrivent** (valeurs fantômes, revue
 * des cibles) apprennent qu'une série ne doit pas leur servir de modèle. Une
 * lecture par lot de séances plutôt qu'un index sur `kind` : les benchmarks sont
 * rares, le champ est optionnel, et un index serait une version de schéma pour
 * une question que l'on pose sur quelques séances à la fois.
 */
export async function benchmarkIdsAmong(workoutIds: Iterable<string>): Promise<Set<string>> {
  const unique = [...new Set(workoutIds)];
  if (unique.length === 0) return new Set();
  const workouts = await db.workouts.bulkGet(unique);
  return new Set(
    workouts.flatMap((workout) =>
      workout !== undefined && workout.kind === 'benchmark' ? [workout.id] : [],
    ),
  );
}
