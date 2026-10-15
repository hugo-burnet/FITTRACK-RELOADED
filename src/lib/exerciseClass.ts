import type { MovementPattern, MuscleGroup } from '@/data/types';

/**
 * Polyarticulaire ou isolation : la seule distinction que le coach fait entre deux exercices quand il
 * dimensionne des séries (benchmark, spec §3).
 *
 * Pure, et **sans table à tenir à jour** : elle lit la famille de mouvement que le catalogue porte déjà
 * (`movementPattern`), sur laquelle l'audit du catalogue garantit qu'aucun exercice n'est oublié. Les
 * familles de poussée, de tirage, de squat, de charnière et de fente sont polyarticulaires ; les six
 * familles d'isolation le sont par leur nom.
 *
 * « Autre » et l'absence de famille (un exercice personnel) ne disent rien : on regarde alors ce que
 * l'exercice sollicite. Le corps entier, ou deux muscles secondaires et plus, font un polyarticulaire ;
 * un haussement d'épaules (un secondaire) ou un crunch (aucun) sont des isolations. Sans rien du tout,
 * « polyarticulaire » : c'est la lecture qui fatigue le plus d'une série à l'autre, donc la plus prudente —
 * elle baisse la charge proposée, jamais ne la monte.
 */
export type ExerciseClass = 'compound' | 'isolation';

const COMPOUND_PATTERNS: ReadonlySet<MovementPattern> = new Set([
  'poussee_horizontale',
  'poussee_verticale',
  'tirage_horizontal',
  'tirage_vertical',
  'squat',
  'hinge',
  'fente',
]);

/** Ce qu'il faut savoir d'un exercice pour le ranger : tout est facultatif, l'absence est une réponse. */
export interface ExerciseClassInput {
  movementPattern?: MovementPattern;
  primaryMuscle?: MuscleGroup;
  secondaryMuscles?: readonly MuscleGroup[];
}

export function exerciseClass(exercise: ExerciseClassInput): ExerciseClass {
  const { movementPattern } = exercise;
  if (movementPattern !== undefined && movementPattern !== 'autre') {
    return COMPOUND_PATTERNS.has(movementPattern) ? 'compound' : 'isolation';
  }

  // « Autre », ou aucune famille : ce que l'exercice sollicite.
  if (exercise.primaryMuscle === undefined && exercise.secondaryMuscles === undefined) {
    return 'compound';
  }
  if (exercise.primaryMuscle === 'full_body') return 'compound';
  return (exercise.secondaryMuscles?.length ?? 0) >= 2 ? 'compound' : 'isolation';
}
