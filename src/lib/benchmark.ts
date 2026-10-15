import type { BenchmarkGoal, Equipment, MeasurementType, SetType } from '@/data/types';
import { SEVERITY } from '@/lib/coach/constants';
import type { CoachSignal } from '@/lib/coach/types';
import type { ExerciseClass } from '@/lib/exerciseClass';
import { resolveLoadStep, type LoadStep } from '@/lib/loadIncrement';
import type { Performed } from '@/lib/measurement';
import { isWorkingSet } from '@/lib/records';
import {
  capacityForSets,
  goalZone,
  isPyramid,
  loadForReps,
  oneRepMaxOf,
  plannedSets,
  repsHeldAt,
  repZone,
  setFatigue,
  type RepZone,
} from './benchmarkModel';

/**
 * Le benchmark : une série menée à l'échec par exercice, lue comme un maximum,
 * et ce que ce maximum dit de la charge de travail **de la fourchette de cet
 * exercice, tenue sur toutes ses séries** (spec benchmark, §3).
 *
 * Pur par construction : des séries et une ligne de routine en entrée, un
 * verdict et — quand il y a lieu — une proposition d'écriture en sortie. Lire
 * la base et écrire dans la routine est l'affaire de `repositories/benchmark`.
 *
 * Le modèle — du maximum à la charge, par Epley, avec la fatigue d'une série à l'autre — est dans
 * `benchmarkModel` ; ce module en fait un verdict par exercice, une proposition d'écriture et le signal
 * que le coach lit.
 */

/**
 * L'écart, en répétitions, entre l'essai et la capacité que la première série doit avoir au-delà duquel
 * l'estimation est dite approximative. Convertir 22 répétitions en 17 est une petite extrapolation ;
 * convertir 25 en 7 n'est plus une mesure, et la charge qui en sort ne s'écrit pas d'office dans la routine.
 */
export const BENCHMARK_ROUGH_GAP = 6;

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

/** Une fourchette de répétitions à écrire sur des séries de travail de la routine. */
export interface BenchmarkZoneWrite extends RepZone {
  /** Les séries qui la reçoivent : celles de travail, sans les dégressives, qui gardent leurs répétitions. */
  setIds: string[];
}

/**
 * Ce qu'accepter écrit — la partie de `RoutineTargetProposal` que
 * `applyRoutineTargetProposals` lit, plus la fourchette du style choisi.
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
  /**
   * La fourchette du style choisi au lancement, écrite avec la charge : la routine dit alors « 15 – 20 » et
   * non plus ce qu'elle disait. Absente sans style (la routine garde sa fourchette), et quand les séries
   * portent déjà celle du style.
   */
  zone?: BenchmarkZoneWrite;
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
  /**
   * Le style choisi au lancement : sa fourchette remplace celle de la routine, et la routine reçoit la sienne
   * en acceptant. Absent : la fourchette de la première série de travail de la routine, exercice par exercice.
   */
  goal?: BenchmarkGoal;
}

export interface BenchmarkLine {
  exerciseId: string;
  exerciseName: string;
  measurementType: MeasurementType;
  verdict: BenchmarkVerdict;
  tested?: Performed;
  /** Le style du benchmark, quand la personne en a choisi un au lancement. */
  goal?: BenchmarkGoal;
  /** La fourchette sur laquelle la charge est dimensionnée : celle du style, ou celle de la routine. */
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
  /**
   * La charge conseillée. Pour une pyramide, celle de sa série la plus lourde après le décalage : c'est la
   * série qui limite, et celle que `currentKg` désigne dans la routine.
   */
  suggestedKg?: number;
  /**
   * Ce que chacune des séries tient à fond à la charge conseillée (`repsHeldAt`) — « 13, 11, 10 » : c'est ainsi
   * qu'on lit une charge sur trois séries. Absent pour une pyramide, dont chaque série a sa charge.
   */
  holdReps?: number[];
  /** La cible actuelle de la routine : la plus dure de ses séries de travail. */
  currentKg?: number;
  proposal?: BenchmarkProposal;
  /**
   * `true` quand les séries de travail de la routine portent des charges différentes. Le décalage garde la
   * forme de la pyramide ; un objectif du coach, lui, est un seul chiffre qui l'aplatirait : il n'en pose pas.
   */
  pyramid?: true;
  /** `true` quand la routine porte déjà la charge calibrée — et la fourchette du style, s'il y en a un : rien à écrire. */
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
  // Les séries qui donnent sa forme au bloc : jamais une dégressive (plus légère par construction). Celles-ci
  // suivent le décalage de charge avec les autres, via `targetSetIds`, mais ne donnent ni fourchette ni départ.
  const straight = working.filter((set) => set.setType !== 'dropset');
  const block = straight.length > 0 ? straight : working;
  const first = block[0];
  // Le style choisi au lancement, sinon la fourchette que la routine écrit sur la série concernée.
  const style = input.goal === undefined ? undefined : goalZone(input.goal);
  const zoneOf = (set: BenchmarkRoutineSet | undefined): RepZone =>
    style === undefined ? repZone(set?.targetReps, set?.targetRepsMax) : { ...style };
  const zone = zoneOf(first);

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
  const fatigue = setFatigue(klass, input.restSeconds);
  const planned = plannedSets(working, klass);
  const step = resolveLoadStep({
    equipment: input.equipment,
    ...(input.loadIncrementKg === undefined ? {} : { loadIncrementKg: input.loadIncrementKg }),
  });

  /** La charge qui tient `count` séries dont la dernière garde la réserve au bas de la fourchette `low`. */
  const sizeFor = (low: number, count: number): number => {
    const ideal = loadForReps(best.oneRepMax, capacityForSets(low, count, fatigue));
    return ideal === undefined ? 0 : floorLoad(ideal, best.set.weight!, step);
  };

  const loads = block.flatMap((set) =>
    set.targetWeight === undefined ? [] : [{ set, weight: set.targetWeight }],
  );
  const pyramid = isPyramid(block);

  // Une charge, ou une pyramide. Une pyramide se dimensionne série par série, chacune seule et sur sa propre
  // fourchette ; l'écart retenu est le plus prudent des écarts, de sorte qu'aucune série ne dépasse ce que le
  // max autorise pour elle. Dimensionnée sur la seule première, une pyramide ascendante montait son sommet à
  // 94 % du max (77,5 / 87,5 / 97,5 pour 60 / 70 / 80 testé à 80 × 9).
  let suggested: number;
  let reference: number;
  let pyramidShift: number | undefined;
  if (pyramid) {
    const sizes = loads.map(({ set, weight }) => {
      const low = zoneOf(set).low;
      return { low, weight, gap: sizeFor(low, 1) - weight };
    });
    const tightest = sizes.reduce((a, b) => (b.gap < a.gap ? b : a));
    pyramidShift = round3(tightest.gap);
    suggested = round3(Math.max(...loads.map((load) => load.weight)) + pyramidShift);
    reference = capacityForSets(tightest.low, 1, fatigue);
  } else {
    suggested = sizeFor(zone.low, planned);
    reference = capacityForSets(zone.low, planned, fatigue);
  }

  if (!(suggested > 0)) {
    // Une charge sous le premier cran du matériel n'est pas une proposition.
    return { ...base, verdict: 'no_load', zone, tested, oneRepMax: best.oneRepMax };
  }

  const currentKg = loads.length === 0 ? undefined : Math.max(...loads.map((load) => load.weight));
  const rough = Math.abs(best.set.reps! - reference) > BENCHMARK_ROUGH_GAP;
  const held = pyramid ? [] : repsHeldAt(best.oneRepMax, suggested, planned, fatigue);

  const line: BenchmarkLine = {
    ...base,
    verdict: 'calibrated',
    tested,
    ...(input.goal === undefined ? {} : { goal: input.goal }),
    zone,
    oneRepMax: best.oneRepMax,
    plannedSets: planned,
    referenceReps: reference,
    suggestedKg: suggested,
    ...(held.length === 0 ? {} : { holdReps: held }),
    ...(currentKg === undefined ? {} : { currentKg }),
    ...(pyramid ? { pyramid: true as const } : {}),
    ...(rough ? { rough: true as const } : {}),
  };

  if (input.routine === undefined || first === undefined) return line;

  // La série dont le bilan lit la charge : la première de travail — la première qui en porte une, dans une
  // pyramide, pour que « ce qu'elle portait alors » existe.
  const anchor = pyramid ? (loads[0]?.set ?? first) : first;
  const deltaKg =
    anchor.targetWeight === undefined
      ? undefined
      : (pyramidShift ?? round3(suggested - anchor.targetWeight));
  const zoneWrite: BenchmarkZoneWrite | undefined =
    style !== undefined && block.some((set) => !carriesZone(set, style))
      ? { ...style, setIds: block.map((set) => set.id) }
      : undefined;

  if (deltaKg === 0 && zoneWrite === undefined) return { ...line, aligned: true };

  const proposal: BenchmarkProposal = {
    routineExerciseId: input.routine.routineExerciseId,
    exerciseId: input.exerciseId,
    targetSetIds: working.map((set) => set.id),
    anchorSetId: anchor.id,
    ...(anchor.targetWeight === undefined ? {} : { fromWeight: anchor.targetWeight }),
    proposedWeight: suggested,
    ...(deltaKg === undefined ? {} : { deltaKg }),
    ...(zoneWrite === undefined ? {} : { zone: zoneWrite }),
  };

  return { ...line, proposal };
}

/** La série porte-t-elle déjà cette fourchette ? Une cible unique est une fourchette d'un seul point. */
function carriesZone(set: BenchmarkRoutineSet, zone: RepZone): boolean {
  return set.targetReps === zone.low && (set.targetRepsMax ?? set.targetReps) === zone.high;
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
 * proposer (trop léger, sans charge, au poids du corps), ni pour une pyramide : un objectif est un seul chiffre,
 * que « Appliquer » met sur toutes les séries restantes — 60 / 70 / 80 deviendrait 77,5 trois fois. Le bilan,
 * lui, décale la pyramide en gardant sa forme. **Un signal même quand la routine porte déjà la
 * charge** : il remplace l'objectif que le coach avait posé avant, qui sinon resterait affiché à côté.
 */
export function benchmarkSignal(line: BenchmarkLine): CoachSignal | undefined {
  if (
    line.verdict !== 'calibrated' ||
    line.rough === true ||
    line.pyramid === true ||
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
