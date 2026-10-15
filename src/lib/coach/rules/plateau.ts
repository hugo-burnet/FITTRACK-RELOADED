import { measurementShape } from '@/lib/measurement';
import { estimateOneRepMax, type OneRepMaxFormula } from '@/lib/oneRepMax';
import { AT_FAILURE_RPE, CONSOLIDATION_RPE_DROP, RPE_EPSILON, SEVERITY } from '../constants';
import {
  completedWorkingSets,
  isDeloadLine,
  judgedSets,
  progressionSets,
  roundRpe,
  sessionEffort,
} from '../sets';
import type { CoachExerciseLine, CoachSetInput, CoachSignal } from '../types';
import { rangeFlags } from './range';

/**
 * Ce qu'on lit de séance en séance quand rien ne casse : le plateau (pas de progrès sur le 1RM
 * estimé) et son contraire, la consolidation (même charge, effort en baisse).
 */

function bestSessionOneRepMax(
  sets: readonly CoachSetInput[],
  formula: OneRepMaxFormula,
): number | undefined {
  let best: number | undefined;
  for (const set of completedWorkingSets(sets)) {
    if (set.weight === undefined || set.reps === undefined) continue;
    const estimate = estimateOneRepMax(set.weight, set.reps, formula);
    if (estimate === undefined) continue;
    if (best === undefined || estimate > best) best = estimate;
  }
  return best;
}

/**
 * The heaviest load a session actually worked, `undefined` when the exercise
 * carries no load at all. Assistance is out of scope here — `plateauSignal`
 * refuses those sessions before it asks.
 */
function topWorkingLoad(line: CoachExerciseLine): number | undefined {
  let top: number | undefined;
  for (const set of completedWorkingSets(line.sets)) {
    if (set.weight === undefined) continue;
    if (top === undefined || set.weight > top) top = set.weight;
  }
  return top;
}

/** Most reps a session's working sets reached at exactly `load`. */
function mostRepsAtLoad(line: CoachExerciseLine, load: number): number | undefined {
  let most: number | undefined;
  for (const set of completedWorkingSets(line.sets)) {
    if (set.weight !== load || set.reps === undefined) continue;
    if (most === undefined || set.reps > most) most = set.reps;
  }
  return most;
}

/**
 * Une séance dont chaque série a touché le haut de sa prescription.
 *
 * Son 1RM estimé ne peut pas monter : ce sont les répétitions prescrites qui ont
 * plafonné, pas le pratiquant. Trois `70 × 12 × 3` sur un 10–12 donnent trois fois
 * le même 1RM — c'est une fourchette respectée, pas une stagnation.
 */
function isCappedSession(line: CoachExerciseLine): boolean {
  return rangeFlags(progressionSets(line), judgedSets(line)).ceiling;
}

/**
 * Plateau: N consecutive non-deload, non-capped sessions with no improvement on best estimated 1RM.
 * Deload sessions are skipped so a planned cut never looks like stagnation.
 *
 * Assisted machines are out of scope: the figure recorded is the help you took,
 * so it *falls* as you get stronger, and the 1RM of an assistance load is not a
 * strength. Comparing sessions would need the bodyweight to subtract, which the
 * engine is not given — so the rule says nothing rather than reading progress
 * as stagnation.
 */

export function plateauSignal(
  historyNewestFirst: readonly CoachExerciseLine[],
  formula: OneRepMaxFormula,
  plateauSessions: number,
): CoachSignal | undefined {
  const nonDeload = historyNewestFirst.filter((line) => !isDeloadLine(line));
  // **Consolider n'est pas stagner.** Lire une séance plafonnée comme un point
  // plat fermait un cercle : plus on respectait sa fourchette, plus le coach
  // déclarait un plateau, et le plateau retirait `increase_load` — la hausse
  // même que la consolidation préparait. Vu sur un rowing tenu à 70 × 12 × 3
  // pendant trois séances, RPE en baisse : « Plateau », trois fois.
  // La dernière séance plafonnée est une réussite, et les précédentes ne
  // témoignent de rien ; on les écarte comme les séances de décharge.
  if (nonDeload[0] !== undefined && isCappedSession(nonDeload[0])) return undefined;
  const comparable = nonDeload.filter((line) => !isCappedSession(line));
  if (comparable.length < plateauSessions) return undefined;
  if (measurementShape(comparable[0]!.measurementType).weightRole === 'assist') return undefined;

  const window = comparable.slice(0, plateauSessions);
  const estimates = window.map((line) => bestSessionOneRepMax(line.sets, formula));
  if (estimates.some((value) => value === undefined)) return undefined;

  const values = estimates as number[];
  // Newest session must not beat any earlier one in the window, and at least
  // the oldest must exist — flat or declining across N sessions.
  const newest = values[0]!;
  const priorBest = Math.max(...values.slice(1));
  if (newest > priorBest) return undefined;

  // Also require no session-to-session improvement walking older → newer.
  const oldestFirst = [...values].reverse();
  let improved = false;
  for (let i = 1; i < oldestFirst.length; i++) {
    if (oldestFirst[i]! > oldestFirst[i - 1]!) {
      improved = true;
      break;
    }
  }
  if (improved) return undefined;

  // **A heavier bar is progress, whatever the estimate says.** Trading reps for
  // load — `100 × 10`, then `105 × 8`, then `110 × 6` — moves the estimated 1RM
  // by a kilo or two in whichever direction the formula happens to lean, and
  // three such sessions read as a flat line. They are not: ten kilos went onto
  // the bar. The estimate is a model; the load is a fact, and the fact wins.
  const loads = window.map(topWorkingLoad);
  const newestLoad = loads[0];
  const oldestLoad = loads[loads.length - 1];
  if (newestLoad !== undefined && oldestLoad !== undefined && newestLoad > oldestLoad) {
    return undefined;
  }

  // **Une répétition de plus à la même charge est un progrès, elle aussi.** Le
  // 1RM estimé ne lit rien au-delà de 12 répétitions (`estimateOneRepMax`) : un
  // 12,5 × 13 après deux 12,5 × 12 — record de répétitions sur un oiseau en
  // 12–15 — passait pour une séance plate, jugée sur sa seule série à 11.
  // Toute fourchette d'hypertrophie au-dessus de 12 tombe dans cet angle mort.
  if (newestLoad !== undefined) {
    const newestReps = mostRepsAtLoad(window[0]!, newestLoad);
    const priorReps = window
      .slice(1)
      .map((line) => mostRepsAtLoad(line, newestLoad))
      .filter((reps): reps is number => reps !== undefined);
    if (newestReps !== undefined && priorReps.length > 0 && newestReps > Math.max(...priorReps)) {
      return undefined;
    }
  }

  // **Moins d'effort pour le même travail est un progrès** (R1). Le 1RM estimé ne
  // voit que charges et répétitions ; un rowing tenu à 70 × 12 de RPE 9,5 à 8,5
  // est plus fort, pas bloqué.
  const efforts = window.map(sessionEffort);
  const newestEffort = efforts[0];
  const oldestEffort = efforts[efforts.length - 1];
  if (
    newestEffort !== undefined &&
    oldestEffort !== undefined &&
    oldestEffort - newestEffort >= CONSOLIDATION_RPE_DROP - RPE_EPSILON
  ) {
    return undefined;
  }
  // Bloqué *et* à fond à chaque séance : c'est là qu'une décharge sert.
  const atFailure = efforts.every(
    (effort) => effort !== undefined && effort >= AT_FAILURE_RPE - RPE_EPSILON,
  );

  return {
    code: 'plateau',
    exerciseId: window[0]!.exerciseId,
    evidence: [
      { label: 'sessions', value: plateauSessions },
      { label: 'best_1rm_kg', value: Math.round(newest * 10) / 10 },
      ...(atFailure ? [{ label: 'at_failure', value: 1 }] : []),
    ],
    severity: SEVERITY.plateau,
  };
}

/** Heaviest load among the judged sets, `undefined` without a figure. */
function judgedLoad(line: CoachExerciseLine): number | undefined {
  let top: number | undefined;
  for (const set of judgedSets(line)) {
    if (typeof set.weight !== 'number') continue;
    if (top === undefined || set.weight > top) top = set.weight;
  }
  return top;
}

function judgedReps(line: CoachExerciseLine): number {
  return judgedSets(line).reduce((sum, set) => sum + (set.reps ?? 0), 0);
}

/**
 * Consolidation (spec coach v2, R1): same load as the previous comparable
 * session, at least as many reps, and an effort down by half a point or more.
 *
 * Without it the engine had two words for this session — silence, or « plateau »
 * — and both were false: the bar did not move, the lifter did.
 */
export function consolidationSignal(
  historyNewestFirst: readonly CoachExerciseLine[],
): CoachSignal | undefined {
  const latest = historyNewestFirst[0];
  if (latest === undefined || isDeloadLine(latest)) return undefined;
  const previous = historyNewestFirst.slice(1).find((line) => !isDeloadLine(line));
  if (previous === undefined) return undefined;

  const after = sessionEffort(latest);
  const before = sessionEffort(previous);
  if (after === undefined || before === undefined) return undefined;
  if (before - after < CONSOLIDATION_RPE_DROP - RPE_EPSILON) return undefined;

  const load = judgedLoad(latest);
  if (load === undefined || judgedLoad(previous) !== load) return undefined;
  if (judgedReps(latest) < judgedReps(previous)) return undefined;

  return {
    code: 'consolidating',
    exerciseId: latest.exerciseId,
    evidence: [
      { label: 'current_load_kg', value: load },
      { label: 'rpe_before', value: roundRpe(before) },
      { label: 'rpe_after', value: roundRpe(after) },
    ],
    severity: SEVERITY.consolidating,
  };
}
