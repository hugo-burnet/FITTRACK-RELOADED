/**
 * Le moteur du coach : pour un exercice, le constat de la séance (`evaluatePerformance`), puis le
 * constat unique que la carte montre (`evaluateCoach`).
 *
 * Il n'est plus que le chef d'orchestre. Le détail vit à côté, et chaque morceau n'a qu'un métier :
 * `sets` (quelles séries comptent), `history` (remettre l'historique dans l'ordre), `rules/*` (une
 * famille de règles chacune : fourchette, séance, plateau, reprise), `arbitrate` (quelle action,
 * quel signal), `constants` (les seuils). Pour « dans quelle situation est-on ? » en un mot, voir
 * `situation.ts`.
 */

import { resolveLoadStep } from '@/lib/loadIncrement';
import { buildAllowedActions, pickSignals } from './arbitrate';
import { contractKey, mergeLinesForWorkout, sinceLatestReturn, sortNewestFirst } from './history';
import { intraSessionDropSignal, longRestSignal } from './rules/drop';
import { consolidationSignal, plateauSignal } from './rules/plateau';
import { rangeMissedSignal, rangePartitionSignal } from './rules/range';
import { returningSignal } from './rules/returning';
import type {
  CoachEvaluateOptions,
  CoachEvaluation,
  CoachExerciseLine,
  CoachSignal,
} from './types';

// Ce que ce module exportait avant d'être découpé : un appelant n'a pas à savoir où chaque
// morceau est allé.
export {
  AT_FAILURE_RPE,
  CEILING_GRINDING_RPE,
  CONSOLIDATION_RPE_DROP,
  RETURN_GAP_DAYS,
} from './constants';
export { mergeLinesForWorkout } from './history';
export { pickSignals } from './arbitrate';

// Les valeurs par défaut des options de `evaluatePerformance`.
const DEFAULT_PLATEAU_SESSIONS = 3;
const DEFAULT_DROP_REPS = 2;
const DEFAULT_LONG_REST_MS = 180_000;

/**
 * Performance engine for one exercise: exclusive range partition, history
 * rules, and the independent `allowedActions` set (spec §4).
 *
 * `history` is prior sessions of the same exercise (any order). `line` is the
 * session under review; when history contains a newer session, the true latest
 * still wins for intra-session / range reads.
 */
export function evaluatePerformance(
  line: CoachExerciseLine,
  history: readonly CoachExerciseLine[] = [],
  options: CoachEvaluateOptions = {},
): CoachEvaluation {
  const formula = options.formula ?? 'epley';
  const plateauSessions = options.plateauSessions ?? DEFAULT_PLATEAU_SESSIONS;
  const dropReps = options.dropReps ?? DEFAULT_DROP_REPS;
  const longRestMs = options.longRestMs ?? DEFAULT_LONG_REST_MS;

  const sameExercise = history.filter((entry) => entry.exerciseId === line.exerciseId);
  const newestFirst = sortNewestFirst([line, ...sameExercise]);
  const latest = newestFirst[0]!;

  const signals: CoachSignal[] = [];

  // Le cran est celui de la fiche de l'exercice, sinon celui des Réglages, sinon celui du matériel. Le
  // coach v2 l'a d'abord déduit des charges soulevées ; il ne savait pas lire un
  // micro-chargement de 1,125 kg sur une poulie, que l'utilisateur, lui, renseigne.
  const increment = resolveLoadStep(latest, options.defaultLoadStepKg);
  const { lines: sinceReturn, gapDays } = sinceLatestReturn(newestFirst);
  const contract = contractKey(latest);
  const comparable = sinceReturn.filter((entry) => contractKey(entry) === contract);

  if (gapDays !== undefined) signals.push(returningSignal(latest, gapDays));

  const range = rangePartitionSignal(latest, increment, gapDays !== undefined);
  if (range) signals.push(range);

  const missed = rangeMissedSignal(comparable, increment);
  if (missed) signals.push(missed);

  const drop = intraSessionDropSignal(latest, dropReps);
  if (drop) signals.push(drop);

  const rest = longRestSignal(latest, drop, longRestMs);
  if (rest) signals.push(rest);

  const plateau = plateauSignal(comparable, formula, plateauSessions);
  if (plateau) signals.push(plateau);

  const consolidating = consolidationSignal(comparable);
  if (consolidating) signals.push(consolidating);

  const allowed = buildAllowedActions(signals);

  // R6 : le coach ne propose pas d'aller au-delà de ce que la personne a déjà tenu sur ce muscle.
  // Une série de plus est la seule action retirée — la charge et les répétitions ne sont pas du
  // volume — et on ne le dit que si elle était permise : un plateau, une reprise ou un plafond
  // arraché l'ont déjà retirée, et la carte n'a rien à ajouter.
  const volume = options.muscleVolume;
  const withheld =
    volume !== undefined && volume.rollingSets >= volume.ceiling && allowed.includes('add_set');

  return {
    signals,
    allowedActions: withheld ? allowed.filter((action) => action !== 'add_set') : allowed,
    ...(withheld ? { volumeWithheld: true as const } : {}),
  };
}

/**
 * Every signal the rules produce, before the one-per-exercise comparator.
 * Tests use this to prove correlation (e.g. long_rest only with a drop).
 */
export function collectCoachSignals(
  lines: readonly CoachExerciseLine[],
  options: CoachEvaluateOptions = {},
): CoachSignal[] {
  const merged = mergeLinesForWorkout(lines);
  const byExercise = new Map<string, CoachExerciseLine[]>();
  for (const entry of merged) {
    const list = byExercise.get(entry.exerciseId) ?? [];
    list.push(entry);
    byExercise.set(entry.exerciseId, list);
  }

  const signals: CoachSignal[] = [];

  for (const [, exerciseLines] of byExercise) {
    const newestFirst = sortNewestFirst(exerciseLines);
    const latest = newestFirst[0];
    if (latest === undefined) continue;
    const evaluation = evaluatePerformance(latest, newestFirst.slice(1), options);
    signals.push(...evaluation.signals);
  }

  return signals;
}

/**
 * Evaluate coach signals from plain history lines.
 *
 * `lines` may span many workouts and exercises. Pass every line of the sessions
 * you care about; the engine groups by exercise and orders by workout time.
 * Returns at most one signal per exercise.
 */
export function evaluateCoach(
  lines: readonly CoachExerciseLine[],
  options: CoachEvaluateOptions = {},
): CoachSignal[] {
  return pickSignals(collectCoachSignals(lines, options));
}
