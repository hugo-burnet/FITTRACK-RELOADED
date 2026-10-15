import type { CoachSignalCode } from './types';

/**
 * Les seuils et l'échelle de gravité du moteur : des décisions de produit, regroupées pour qu'on les
 * relise ensemble. Aucune n'a de source dans le corpus — la carte dit « règle de l'app ».
 */

/** Consecutive sessions under the floor, at the same load, before backing off. */
export const MISSED_SESSIONS = 2;
/**
 * Effort thresholds (spec coach v2, R1). Product policy, not physiology: the
 * corpus has no source for them, and the card says « règle de l'app ».
 */
export const CEILING_GRINDING_RPE = 9.5;
export const CONSOLIDATION_RPE_DROP = 0.5;
export const AT_FAILURE_RPE = 9.5;
/** RPE comes by halves; a mean can land a hair under a threshold in floats. */
export const RPE_EPSILON = 1e-9;
/** Spec coach v2, R5 (décision Q4): from this gap on, a session is a comeback. */
export const RETURN_GAP_DAYS = 14;
export const DAY_MS = 86_400_000;

/** Severity ladder — UI keeps one signal per exercise; higher wins. */
export const SEVERITY: Record<CoachSignalCode, number> = {
  // Above range success: failing twice is more urgent than succeeding once,
  // and range_satisfied / range_ceiling_reached never fire together.
  range_missed: 50,
  // Au-dessus du plafond : c'est elle qui explique pourquoi le plafond ne
  // propose pas de charge à la séance de reprise.
  returning: 45,
  range_ceiling_reached: 40,
  /** Read alias for legacy journal rows; same weight as ceiling. */
  range_completed: 40,
  // Sous le plafond, qui reste la nouvelle à donner ; au-dessus de la fourchette
  // tenue, que la consolidation précise.
  consolidating: 38,
  // Elle ne passe jamais par `pickSignals` : le benchmark la pose directement, un objectif à la fois.
  benchmark_calibrated: 36,
  range_satisfied: 35,
  plateau: 30,
  intra_session_drop: 20,
  long_rest: 10,
};

export const CODE_ORDER: CoachSignalCode[] = [
  'range_missed',
  'returning',
  'range_ceiling_reached',
  'range_completed',
  'consolidating',
  'benchmark_calibrated',
  'range_satisfied',
  'plateau',
  'intra_session_drop',
  'long_rest',
];
