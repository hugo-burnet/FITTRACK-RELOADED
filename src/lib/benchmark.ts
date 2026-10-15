import type { Equipment, MeasurementType, SetType } from '@/data/types';
import { resolveLoadStep, type LoadStep } from '@/lib/loadIncrement';
import type { Performed } from '@/lib/measurement';
import { MAX_ESTIMATED_REPS, estimateOneRepMax, type OneRepMaxFormula } from '@/lib/oneRepMax';
import { isWorkingSet } from '@/lib/records';

/**
 * Le benchmark : une série menée à l'échec par exercice, lue comme un maximum,
 * et ce que ce maximum dit de la charge de travail (spec benchmark, §3).
 *
 * Pur par construction : des séries et une ligne de routine en entrée, un
 * verdict et — quand il y a lieu — une proposition d'écriture en sortie. Lire
 * la base et écrire dans la routine est l'affaire de `repositories/benchmark`.
 */

/**
 * Les répétitions qu'on garde en réserve au bas de la fourchette. Un maximum
 * dit ce que la personne peut faire *une fois, à fond* ; une série de travail
 * commence deux répétitions avant l'échec, et la double progression a ensuite de
 * la place pour monter avant de devoir ajouter du poids.
 */
export const BENCHMARK_RESERVE_REPS = 2;

/** Le bas de fourchette quand la routine n'en porte pas : le milieu du « 6 – 12 » usuel. */
export const BENCHMARK_DEFAULT_LOW_REPS = 8;

/**
 * La charge à laquelle un maximum de `oneRepMax` tient `reps` répétitions : le
 * miroir exact de `estimateOneRepMax`, formule par formule.
 *
 * Même domaine que lui (1 à 12) et pour la même raison : au-delà, les formules
 * extrapolent, et renvoyer un nombre ferait passer une extrapolation pour une
 * mesure.
 */
export function loadForReps(
  oneRepMax: number,
  reps: number,
  formula: OneRepMaxFormula,
): number | undefined {
  if (
    !Number.isFinite(oneRepMax) ||
    oneRepMax <= 0 ||
    !Number.isInteger(reps) ||
    reps < 1 ||
    reps > MAX_ESTIMATED_REPS
  ) {
    return undefined;
  }
  if (reps === 1) return oneRepMax;

  switch (formula) {
    case 'epley':
      return oneRepMax / (1 + reps / 30);
    case 'brzycki':
      return (oneRepMax * (37 - reps)) / 36;
    case 'lombardi':
      return oneRepMax / reps ** 0.1;
  }
}

/**
 * Les répétitions sur lesquelles dimensionner la charge : le bas de fourchette
 * de la routine plus la réserve, sans sortir du domaine des formules.
 */
export function referenceReps(lowReps: number | undefined): number {
  const low =
    lowReps !== undefined && Number.isInteger(lowReps) && lowReps >= 1
      ? lowReps
      : BENCHMARK_DEFAULT_LOW_REPS;
  return Math.min(MAX_ESTIMATED_REPS, low + BENCHMARK_RESERVE_REPS);
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/**
 * La charge atteignable la plus proche **sans dépasser** `ideal` : le benchmark
 * ne propose jamais plus que ce que le maximum autorise.
 *
 * Sur la grille du matériel quand le pas est celui de la table. Quand c'est un
 * pas saisi sur l'exercice, la grille part de la charge essayée et non de zéro :
 * un cran de 1,125 kg sur une pile de 5 ne tombe pas sur un multiple de 1,125
 * (cf. `resolveLoadStep`), mais la charge qu'on vient de soulever existe.
 */
export function floorLoad(ideal: number, anchor: number, step: LoadStep): number {
  const base = step.onGrid ? 0 : anchor;
  // La tolérance absorbe le bruit flottant : 77,49999999999 est un 77,5.
  const steps = Math.floor((ideal - base) / step.kg + 1e-9);
  return Math.max(0, round3(base + steps * step.kg));
}

export type BenchmarkVerdict =
  /** Un maximum lisible, une charge de travail en découle. */
  | 'calibrated'
  /** Plus de 12 répétitions : trop léger pour que la formule dise quoi que ce soit. */
  | 'too_light'
  /** Pas de charge exploitable : rien à dimensionner. */
  | 'no_load'
  /** Un résultat sans charge à proposer (répétitions au poids du corps, durée, assistance). */
  | 'recorded'
  /** Aucune série validée. */
  | 'skipped';

export interface BenchmarkRoutineSet {
  id: string;
  setType: SetType;
  targetReps?: number;
  targetRepsMax?: number;
  targetWeight?: number;
}

export interface BenchmarkRoutineRow {
  routineExerciseId: string;
  sets: readonly BenchmarkRoutineSet[];
}

/**
 * Ce qu'accepter écrit — la partie de `RoutineTargetProposal` que
 * `applyRoutineTargetProposals` lit, et rien de plus.
 */
export interface BenchmarkProposal {
  routineExerciseId: string;
  /** Exactement les séries de travail que l'écriture décale. */
  targetSetIds: string[];
  proposedWeight: number;
  /** Absent quand la ligne ne portait aucune charge : les séries reçoivent `proposedWeight`. */
  deltaKg?: number;
}

export interface BenchmarkLineInput {
  exerciseId: string;
  exerciseName: string;
  measurementType: MeasurementType;
  equipment: Equipment;
  loadIncrementKg?: number;
  formula: OneRepMaxFormula;
  /** Les séries validées de l'exercice dans la séance, dans l'ordre qu'on veut. */
  sets: readonly Performed[];
  /** La ligne de la routine d'où l'exercice est parti — absente si elle n'existe plus. */
  routine?: BenchmarkRoutineRow;
}

export interface BenchmarkLine {
  exerciseId: string;
  exerciseName: string;
  measurementType: MeasurementType;
  verdict: BenchmarkVerdict;
  tested?: Performed;
  oneRepMax?: number;
  referenceReps?: number;
  suggestedKg?: number;
  /** La cible actuelle de la routine : la plus dure de ses séries de travail. */
  currentKg?: number;
  proposal?: BenchmarkProposal;
  /** `true` quand la routine porte déjà la charge calibrée — rien à écrire. */
  aligned?: true;
}

interface Estimated {
  set: Performed;
  oneRepMax: number;
}

/** Les champs définis d'une série, et eux seuls : un `undefined` explicite n'est pas un résultat. */
function resultOf(set: Performed): Performed {
  return {
    ...(set.weight === undefined ? {} : { weight: set.weight }),
    ...(set.reps === undefined ? {} : { reps: set.reps }),
    ...(set.durationSeconds === undefined ? {} : { durationSeconds: set.durationSeconds }),
    ...(set.distanceMeters === undefined ? {} : { distanceMeters: set.distanceMeters }),
  };
}

/** Le meilleur résultat d'un exercice qui ne se mesure pas en charge : le plus de répétitions, ou le plus long. */
function bestRecorded(sets: readonly Performed[]): Performed {
  const score = (set: Performed) => set.reps ?? set.durationSeconds ?? set.distanceMeters ?? 0;
  return sets.reduce((best, set) => (score(set) > score(best) ? set : best));
}

/**
 * La ligne de la routine qui détermine la charge : la première série de
 * travail, celle que le benchmark remplace. Les autres suivent du même écart.
 */
function routineWorkingSets(routine: BenchmarkRoutineRow | undefined): BenchmarkRoutineSet[] {
  return routine === undefined ? [] : routine.sets.filter(isWorkingSet);
}

/** Un exercice du benchmark, lu : son maximum, la charge qui en découle, ce qu'il faudrait écrire. */
export function benchmarkLine(input: BenchmarkLineInput): BenchmarkLine {
  const base = {
    exerciseId: input.exerciseId,
    exerciseName: input.exerciseName,
    measurementType: input.measurementType,
  };

  if (input.sets.length === 0) return { ...base, verdict: 'skipped' };

  if (input.measurementType !== 'weight_reps') {
    // Lesté, assisté, chronométré : la charge n'est qu'une part de ce qui est
    // soulevé, ou n'existe pas. Le résultat est noté, rien n'est proposé.
    return { ...base, verdict: 'recorded', tested: resultOf(bestRecorded(input.sets)) };
  }

  const loaded = input.sets.filter(
    (set) => set.weight !== undefined && set.weight > 0 && set.reps !== undefined && set.reps >= 1,
  );
  if (loaded.length === 0) {
    return { ...base, verdict: 'no_load', tested: resultOf(bestRecorded(input.sets)) };
  }

  const estimated: Estimated[] = loaded.flatMap((set) => {
    const oneRepMax = estimateOneRepMax(set.weight!, set.reps!, input.formula);
    return oneRepMax === undefined ? [] : [{ set, oneRepMax }];
  });

  if (estimated.length === 0) {
    // Tout est au-delà de 12 : on garde la série la plus chargée, puis la plus longue.
    const heaviest = loaded.reduce((best, set) =>
      set.weight! > best.weight! || (set.weight === best.weight && set.reps! > best.reps!)
        ? set
        : best,
    );
    return { ...base, verdict: 'too_light', tested: resultOf(heaviest) };
  }

  const best = estimated.reduce((top, candidate) =>
    candidate.oneRepMax > top.oneRepMax ? candidate : top,
  );
  const tested = resultOf(best.set);

  const working = routineWorkingSets(input.routine);
  const first = working[0];
  const reference = referenceReps(first?.targetReps);
  const ideal = loadForReps(best.oneRepMax, reference, input.formula);
  const step = resolveLoadStep({
    equipment: input.equipment,
    ...(input.loadIncrementKg === undefined ? {} : { loadIncrementKg: input.loadIncrementKg }),
  });
  const suggested = ideal === undefined ? 0 : floorLoad(ideal, best.set.weight!, step);

  if (!(suggested > 0)) {
    // Une charge sous le premier cran du matériel n'est pas une proposition.
    return { ...base, verdict: 'no_load', tested, oneRepMax: best.oneRepMax };
  }

  const weights = working.flatMap((set) => (set.targetWeight === undefined ? [] : [set.targetWeight]));
  const currentKg = weights.length === 0 ? undefined : Math.max(...weights);

  const line: BenchmarkLine = {
    ...base,
    verdict: 'calibrated',
    tested,
    oneRepMax: best.oneRepMax,
    referenceReps: reference,
    suggestedKg: suggested,
    ...(currentKg === undefined ? {} : { currentKg }),
  };

  if (input.routine === undefined || first === undefined) return line;

  if (first.targetWeight !== undefined && first.targetWeight === suggested) {
    return { ...line, aligned: true };
  }

  const targetSetIds = working.map((set) => set.id);
  const proposal: BenchmarkProposal =
    first.targetWeight === undefined
      ? { routineExerciseId: input.routine.routineExerciseId, targetSetIds, proposedWeight: suggested }
      : {
          routineExerciseId: input.routine.routineExerciseId,
          targetSetIds,
          proposedWeight: suggested,
          deltaKg: round3(suggested - first.targetWeight),
        };

  return { ...line, proposal };
}
