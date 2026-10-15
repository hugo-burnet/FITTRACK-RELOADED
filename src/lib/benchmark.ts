import type { Equipment, MeasurementType, SetType } from '@/data/types';
import { resolveLoadStep, type LoadStep } from '@/lib/loadIncrement';
import type { Performed } from '@/lib/measurement';
import { SEVERITY } from '@/lib/coach/constants';
import type { CoachSignal } from '@/lib/coach/types';
import type { ExerciseClass } from '@/lib/exerciseClass';
import { isWorkingSet } from '@/lib/records';

/**
 * Le benchmark : une série menée à l'échec par exercice, lue comme un maximum,
 * et ce que ce maximum dit de la charge de travail **de la fourchette de cet
 * exercice, tenue sur toutes ses séries** (spec benchmark, §3).
 *
 * Pur par construction : des séries et une ligne de routine en entrée, un
 * verdict et — quand il y a lieu — une proposition d'écriture en sortie. Lire
 * la base et écrire dans la routine est l'affaire de `repositories/benchmark`.
 *
 * **Une seule formule : Epley.** Pas celle des réglages. Le benchmark convertit une série en une
 * autre, d'un nombre de répétitions à un autre, et les trois formules de 1RM ne s'accordent qu'entre
 * 1 et 12 répétitions : au-delà, Brzycki s'effondre et Lombardi s'aplatit. Or la personne qui fait des
 * séries de 15, de 18 ou de 20 est précisément au-delà. Epley reste lisible jusqu'à une trentaine de
 * répétitions et son inverse est exact ; c'est déjà la règle du coach pour le cran (`repsToAbsorbStep`) :
 * un choix de produit, pas une mesure.
 *
 * **Plusieurs séries, une fatigue.** Le benchmark mesure la *première* série, à fond. Or une charge de
 * travail se tient sur plusieurs : à charge égale, chaque série de plus perd une part φ de ce que la
 * précédente permettait (`setFatigue`). On cherche donc la charge dont la **dernière** série garde, au bas
 * de la fourchette, deux répétitions en réserve : la première doit pouvoir faire
 * `(bas + 2) / (1 − φ)^(x − 1)` répétitions, `x` étant le nombre de séries (`capacityForSets`), et la
 * charge est celle qui tient cette capacité sur le max mesuré. Avec une seule série, φ ne compte plus et
 * l'on retrouve « bas + 2 ».
 *
 * Les constantes de ce module — la fatigue, la réserve, le plafond de séries, les séries par défaut — sont
 * des choix de produit à juger à l'usage, pas des mesures.
 */

/**
 * Les répétitions qu'on garde en réserve au bas de la fourchette, **à la dernière série**. Un maximum
 * dit ce que la personne peut faire *une fois, à fond* ; une série de travail s'arrête deux répétitions
 * avant l'échec, et la double progression a ensuite de la place pour monter avant de devoir ajouter du
 * poids.
 */
export const BENCHMARK_RESERVE_REPS = 2;

/** La fourchette quand la routine n'en porte pas d'exploitable : le « 8 – 12 » usuel. */
export const BENCHMARK_DEFAULT_ZONE: RepZone = { low: 8, high: 12 };

/** Au-delà, la série est trop légère pour dire quoi que ce soit : Epley n'est plus une estimation. */
export const BENCHMARK_MAX_REPS = 30;

/**
 * L'écart, en répétitions, entre l'essai et la capacité que la première série doit avoir au-delà duquel
 * l'estimation est dite approximative. Convertir 22 répétitions en 17 est une petite extrapolation ;
 * convertir 25 en 7 n'est plus une mesure, et la charge qui en sort ne s'écrit pas d'office dans la routine.
 */
export const BENCHMARK_ROUGH_GAP = 6;

/**
 * La part de la capacité qu'une série de plus fait perdre, à charge égale, pour un polyarticulaire reposé
 * deux minutes : 10 % de répétitions en moins d'une série à la suivante (12, 11, 10 à la même charge). Une
 * isolation fatigue moins le corps, un repos court fatigue plus — cf. `setFatigue`.
 */
const SET_FATIGUE = 0.1;

/** La fatigue d'une isolation, relativement à un polyarticulaire : un muscle seul, peu de fatigue générale. */
const ISOLATION_FATIGUE_FACTOR = 0.8;

/** Le repos auquel `SET_FATIGUE` est calé : celui qu'on compte quand l'exercice n'en dit pas. */
const REFERENCE_REST_SECONDS = 120;

/** Les bornes du facteur de repos : au plus le double de la fatigue de référence, au moins six dixièmes. */
const REST_FACTOR_MIN = 0.6;
const REST_FACTOR_MAX = 2;

/**
 * Au-delà de six séries à charge égale, personne ne les mène toutes près de l'échec : le modèle de fatigue
 * n'est plus une estimation, et la capacité exigée de la première série sortirait du domaine d'Epley.
 */
export const BENCHMARK_MAX_PLANNED_SETS = 6;

/**
 * Le nombre de séries à compter quand la routine n'en porte aucune de travail (un échauffement seul, ou
 * l'exercice a quitté la routine). Un ordre de grandeur courant, pas une règle : trois séries pour un
 * polyarticulaire, deux pour une isolation.
 */
export const BENCHMARK_DEFAULT_SETS: Readonly<Record<ExerciseClass, number>> = {
  compound: 3,
  isolation: 2,
};

/** La fourchette de répétitions d'un exercice dans la routine : de `low` à `high`, bornes comprises. */
export interface RepZone {
  low: number;
  high: number;
}

const isRepCount = (value: number | undefined): value is number =>
  value !== undefined && Number.isInteger(value) && value >= 1;

/**
 * La fourchette que la routine prescrit : « 8 – 12 », « 15 – 20 », ou une cible unique (« 20 » est une
 * fourchette d'un seul point). Un haut sous le bas n'est pas une fourchette ; sans bas exploitable on
 * retombe sur 8 – 12.
 */
export function repZone(targetReps?: number, targetRepsMax?: number): RepZone {
  if (!isRepCount(targetReps)) return { ...BENCHMARK_DEFAULT_ZONE };
  const high = isRepCount(targetRepsMax) && targetRepsMax > targetReps ? targetRepsMax : targetReps;
  return { low: targetReps, high };
}

/** Le max (1RM) que dit une série de `reps` répétitions à `weightKg`, par Epley, de 1 à 30 répétitions. */
export function oneRepMaxOf(weightKg: number, reps: number): number | undefined {
  if (
    !Number.isFinite(weightKg) ||
    weightKg <= 0 ||
    !Number.isInteger(reps) ||
    reps < 1 ||
    reps > BENCHMARK_MAX_REPS
  ) {
    return undefined;
  }
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

/**
 * La charge à laquelle un max de `oneRepMax` tient `reps` répétitions : l'inverse exact d'`oneRepMaxOf`.
 *
 * `reps` n'est pas forcément entier : une série en compte un nombre entier, mais la capacité qu'on exige
 * de la première série (`capacityForSets`) est une grandeur, pas un compte — 12,3 répétitions, c'est une
 * charge entre celle de 12 et celle de 13.
 */
export function loadForReps(oneRepMax: number, reps: number): number | undefined {
  if (
    !Number.isFinite(oneRepMax) ||
    oneRepMax <= 0 ||
    !Number.isFinite(reps) ||
    reps < 1 ||
    reps > BENCHMARK_MAX_REPS
  ) {
    return undefined;
  }
  return reps === 1 ? oneRepMax : oneRepMax / (1 + reps / 30);
}

/**
 * La part de la capacité qu'une série de plus fait perdre à charge égale : 10 % pour un polyarticulaire reposé
 * deux minutes, 8 % pour une isolation, et d'autant plus que le repos est court (le double au plus à une minute,
 * six dixièmes au moins à trois minutes passées).
 *
 * Un repos inconnu ou absurde (zéro, négatif, pas un nombre) compte pour deux minutes : la fatigue de référence,
 * ni plus ni moins.
 */
export function setFatigue(klass: ExerciseClass, restSeconds?: number): number {
  const rest =
    restSeconds !== undefined && Number.isFinite(restSeconds) && restSeconds > 0
      ? restSeconds
      : REFERENCE_REST_SECONDS;
  const restFactor = Math.min(REST_FACTOR_MAX, Math.max(REST_FACTOR_MIN, REFERENCE_REST_SECONDS / rest));
  return SET_FATIGUE * (klass === 'isolation' ? ISOLATION_FATIGUE_FACTOR : 1) * restFactor;
}

/**
 * Sur combien de séries la charge doit tenir : celles de travail de la routine, six au plus.
 *
 * - **Une pyramide compte pour une série.** Dès que les séries de travail portent deux charges différentes, la
 *   routine ne dit pas « la même charge, plusieurs fois » : la première est dimensionnée pour elle-même, les
 *   autres suivent du même écart (c'est ce que fait l'écriture). Une série sans charge ne fait pas une pyramide.
 * - **Rien dans la routine** (échauffement seul, exercice sorti de la routine) : le défaut de la classe.
 */
export function plannedSets(
  working: readonly { targetWeight?: number }[],
  klass: ExerciseClass,
): number {
  if (working.length === 0) return BENCHMARK_DEFAULT_SETS[klass];
  const loads = new Set(working.flatMap((set) => (set.targetWeight === undefined ? [] : [set.targetWeight])));
  if (loads.size > 1) return 1;
  return Math.min(working.length, BENCHMARK_MAX_PLANNED_SETS);
}

/**
 * Les répétitions que la **première** série doit pouvoir faire, à fond, pour que la dernière des `sets` tienne
 * le bas de la fourchette avec la réserve : `(bas + réserve) / (1 − fatigue)^(sets − 1)`, sans sortir du domaine
 * de la formule. Pour une seule série c'est « bas + réserve » — 10 pour un 8 – 12, 17 pour un 15 – 20, 22 pour
 * un 20 ; pour trois séries à 10 % de fatigue, un 8 – 12 exige 12,3.
 *
 * Quand la capacité exigée dépasse la trentaine de répétitions que sait dire la formule, on la plafonne : la
 * charge qui en sort est la plus légère que le benchmark sache proposer, et la dernière série garde alors moins
 * que la réserve.
 *
 * Un bas inutilisable est lu comme le bas de 8 – 12 ; un nombre de séries inutilisable comme une seule.
 */
export function capacityForSets(lowReps: number | undefined, sets: number, fatigue: number): number {
  const low = isRepCount(lowReps) ? lowReps : BENCHMARK_DEFAULT_ZONE.low;
  const count = Number.isInteger(sets) && sets >= 1 ? Math.min(sets, BENCHMARK_MAX_PLANNED_SETS) : 1;
  const lastSet = low + BENCHMARK_RESERVE_REPS;
  return Math.min(BENCHMARK_MAX_REPS, lastSet / (1 - fatigue) ** (count - 1));
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
  /** Plus de 30 répétitions : trop léger pour que la formule dise quoi que ce soit. */
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
  /** L'exercice de la bibliothèque : ce que le coach a pu poser comme objectif de charge, c'est sur lui. */
  exerciseId: string;
  /** Exactement les séries de travail que l'écriture décale. */
  targetSetIds: string[];
  /**
   * La série dont le bilan a lu la charge (la première de travail) et ce qu'elle
   * portait alors. L'écriture est un *décalage* : rejouée sur une routine qui a
   * déjà bougé — un double appui, une modification faite ailleurs —, elle
   * déplacerait deux fois. Elle ne s'applique donc que si cette série porte
   * encore ce que le bilan a vu.
   */
  anchorSetId: string;
  fromWeight?: number;
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
  /** Les séries validées de l'exercice dans la séance, dans l'ordre qu'on veut. */
  sets: readonly Performed[];
  /** La ligne de la routine d'où l'exercice est parti — absente si elle n'existe plus. */
  routine?: BenchmarkRoutineRow;
  /** Le repos de l'exercice, en secondes : plus il est court, plus une série en fatigue la suivante. Absent : deux minutes. */
  restSeconds?: number;
  /** Polyarticulaire ou isolation (`exerciseClass`). Absent : polyarticulaire, la lecture la plus prudente. */
  exerciseClass?: ExerciseClass;
}

export interface BenchmarkLine {
  exerciseId: string;
  exerciseName: string;
  measurementType: MeasurementType;
  verdict: BenchmarkVerdict;
  tested?: Performed;
  /** La fourchette de la routine sur laquelle la charge est dimensionnée. */
  zone?: RepZone;
  oneRepMax?: number;
  /** Sur combien de séries la charge est dimensionnée (`plannedSets`) : celles de la routine, ou le défaut de la classe. */
  plannedSets?: number;
  /**
   * Ce que la première série doit pouvoir faire, à fond, avec la charge conseillée (`capacityForSets`) : pas
   * forcément entier. C'est la grandeur sur laquelle la charge est dimensionnée, et celle que l'essai doit
   * approcher pour que l'estimation soit fiable.
   */
  referenceReps?: number;
  suggestedKg?: number;
  /** La cible actuelle de la routine : la plus dure de ses séries de travail. */
  currentKg?: number;
  proposal?: BenchmarkProposal;
  /** `true` quand la routine porte déjà la charge calibrée — rien à écrire. */
  aligned?: true;
  /**
   * `true` quand l'essai est à plus de `BENCHMARK_ROUGH_GAP` répétitions de la capacité exigée de la première
   * série : la charge est une extrapolation. Elle est proposée, mais n'est cochée ni écrite d'office, et le
   * coach ne la reprend pas.
   */
  rough?: true;
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
 * Les séries de travail de la ligne de routine. La première donne la fourchette et la charge de départ,
 * les autres suivent du même écart ; leur nombre est celui sur lequel la charge doit tenir.
 */
function routineWorkingSets(routine: BenchmarkRoutineRow | undefined): BenchmarkRoutineSet[] {
  return routine === undefined ? [] : routine.sets.filter(isWorkingSet);
}

/**
 * Un exercice du benchmark, lu : son maximum, la charge qui en découle **pour sa fourchette et ses séries**, ce
 * qu'il faudrait écrire.
 */
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

  const working = routineWorkingSets(input.routine);
  const first = working[0];
  const zone = repZone(first?.targetReps, first?.targetRepsMax);

  const loaded = input.sets.filter(
    (set) => set.weight !== undefined && set.weight > 0 && set.reps !== undefined && set.reps >= 1,
  );
  if (loaded.length === 0) {
    return { ...base, verdict: 'no_load', zone, tested: resultOf(bestRecorded(input.sets)) };
  }

  const estimated: Estimated[] = loaded.flatMap((set) => {
    const oneRepMax = oneRepMaxOf(set.weight!, set.reps!);
    return oneRepMax === undefined ? [] : [{ set, oneRepMax }];
  });

  if (estimated.length === 0) {
    // Tout est au-delà de 30 : on garde la série la plus chargée, puis la plus longue.
    const heaviest = loaded.reduce((best, set) =>
      set.weight! > best.weight! || (set.weight === best.weight && set.reps! > best.reps!)
        ? set
        : best,
    );
    return { ...base, verdict: 'too_light', zone, tested: resultOf(heaviest) };
  }

  const best = estimated.reduce((top, candidate) =>
    candidate.oneRepMax > top.oneRepMax ? candidate : top,
  );
  const tested = resultOf(best.set);

  const klass = input.exerciseClass ?? 'compound';
  const planned = plannedSets(working, klass);
  const reference = capacityForSets(zone.low, planned, setFatigue(klass, input.restSeconds));
  const ideal = loadForReps(best.oneRepMax, reference);
  const step = resolveLoadStep({
    equipment: input.equipment,
    ...(input.loadIncrementKg === undefined ? {} : { loadIncrementKg: input.loadIncrementKg }),
  });
  const suggested = ideal === undefined ? 0 : floorLoad(ideal, best.set.weight!, step);

  if (!(suggested > 0)) {
    // Une charge sous le premier cran du matériel n'est pas une proposition.
    return { ...base, verdict: 'no_load', zone, tested, oneRepMax: best.oneRepMax };
  }

  const weights = working.flatMap((set) => (set.targetWeight === undefined ? [] : [set.targetWeight]));
  const currentKg = weights.length === 0 ? undefined : Math.max(...weights);
  const rough = Math.abs(best.set.reps! - reference) > BENCHMARK_ROUGH_GAP;

  const line: BenchmarkLine = {
    ...base,
    verdict: 'calibrated',
    tested,
    zone,
    oneRepMax: best.oneRepMax,
    plannedSets: planned,
    referenceReps: reference,
    suggestedKg: suggested,
    ...(currentKg === undefined ? {} : { currentKg }),
    ...(rough ? { rough: true as const } : {}),
  };

  if (input.routine === undefined || first === undefined) return line;

  if (first.targetWeight !== undefined && first.targetWeight === suggested) {
    return { ...line, aligned: true };
  }

  const targetSetIds = working.map((set) => set.id);
  const proposal: BenchmarkProposal =
    first.targetWeight === undefined
      ? {
          routineExerciseId: input.routine.routineExerciseId,
          exerciseId: input.exerciseId,
          targetSetIds,
          anchorSetId: first.id,
          proposedWeight: suggested,
        }
      : {
          routineExerciseId: input.routine.routineExerciseId,
          exerciseId: input.exerciseId,
          targetSetIds,
          anchorSetId: first.id,
          fromWeight: first.targetWeight,
          proposedWeight: suggested,
          deltaKg: round3(suggested - first.targetWeight),
        };

  return { ...line, proposal };
}

const round1 = (value: number): number => Math.round(value * 10) / 10;

/**
 * Ce que le coach lit du benchmark : la charge de la fourchette de l'exercice, tenue sur ses séries, comme objectif.
 *
 * Un objectif de charge comme un autre — affiché sur la carte de l'exercice à la séance suivante, jamais
 * prérempli, écrit sur les séries restantes sur un geste —, avec les chiffres qui l'ont produit : jamais
 * un « 77,5 kg » nu.
 *
 * **Aucun signal pour une estimation approximative** : le coach ne pousse pas une extrapolation, la
 * personne la lit sur le bilan et décide de l'écrire ou non dans la routine. Aucun non plus sans charge à
 * proposer (trop léger, sans charge, au poids du corps). **Un signal même quand la routine porte déjà la
 * charge** : il remplace l'objectif que le coach avait posé avant, qui sinon resterait affiché à côté.
 */
export function benchmarkSignal(line: BenchmarkLine): CoachSignal | undefined {
  if (
    line.verdict !== 'calibrated' ||
    line.rough === true ||
    line.suggestedKg === undefined ||
    line.tested?.weight === undefined ||
    line.tested.reps === undefined ||
    line.oneRepMax === undefined ||
    line.zone === undefined ||
    line.plannedSets === undefined ||
    line.referenceReps === undefined
  ) {
    return undefined;
  }

  return {
    code: 'benchmark_calibrated',
    exerciseId: line.exerciseId,
    nextLoadKg: line.suggestedKg,
    severity: SEVERITY.benchmark_calibrated,
    evidence: [
      { label: 'tested_load_kg', value: line.tested.weight },
      { label: 'tested_reps', value: line.tested.reps },
      { label: 'one_rep_max_kg', value: round1(line.oneRepMax) },
      { label: 'target_reps', value: line.zone.low },
      { label: 'target_reps_max', value: line.zone.high },
      { label: 'planned_sets', value: line.plannedSets },
      { label: 'reference_reps', value: round1(line.referenceReps) },
      ...(line.currentKg === undefined ? [] : [{ label: 'current_load_kg', value: line.currentKg }]),
    ],
  };
}
