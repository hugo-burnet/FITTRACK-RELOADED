import type { BenchmarkGoal, Equipment, MeasurementType, SetType } from '@/data/types';
import { SEVERITY } from '@/lib/coach/constants';
import type { CoachSignal } from '@/lib/coach/types';
import type { ExerciseClass } from '@/lib/exerciseClass';
import { resolveLoadStep } from '@/lib/loadIncrement';
import type { Performed } from '@/lib/measurement';
import { isWorkingSet } from '@/lib/records';
import {
  BENCHMARK_MAX_JUMP,
  BENCHMARK_MAX_REPS,
  capacityForSets,
  floorLoad,
  goalZone,
  isPyramid,
  loadForRange,
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
 * L'écart, en répétitions, entre l'essai et la capacité que la première série doit avoir, **quand l'essai est en
 * dessous**, au-delà duquel l'estimation est dite approximative : convertir 3 répétitions en 12 est une extrapolation
 * que la formule fait mal, et la charge qui en sort ne s'écrit pas d'office dans la routine.
 *
 * Au-dessus de la capacité exigée, ce n'est plus l'écart de répétitions qui juge mais le saut de charge
 * (`BENCHMARK_MAX_JUMP`) : 27 répétitions pour un 15 – 20 ne demandent que 6 % de plus, c'est une consigne claire
 * — plus lourd — que le bilan applique ; 25 répétitions pour un 5 – 8 en demandent 37 %, et la formule n'est plus
 * une mesure.
 */
export const BENCHMARK_ROUGH_GAP = 6;

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

export { floorLoad };

export type BenchmarkVerdict =
  /** Un maximum lisible, une charge de travail en découle. */
  | 'calibrated'
  /** Des répétitions que la formule ne sait pas lire (pas un nombre entier) : rien à dimensionner. */
  | 'unreadable'
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
  /** `true` quand la ligne de routine existe mais ne porte aucune série de travail (des échauffements seuls). */
  routineEmpty?: true;
  /**
   * `true` quand une série de la routine a été modifiée après ce benchmark : la proposition date, et le bilan
   * ne l'allume pas d'office. Posé par le dépôt, seul à connaître les dates de la routine.
   */
  routineChanged?: true;
  /**
   * `true` quand les séries de travail de la routine portent des charges différentes. Le décalage garde la
   * forme de la pyramide ; un objectif du coach, lui, est un seul chiffre qui l'aplatirait : il n'en pose pas.
   */
  pyramid?: true;
  /** `true` quand la routine porte déjà la charge calibrée — et la fourchette du style, s'il y en a un : rien à écrire. */
  aligned?: true;
  /**
   * `true` quand la charge est une extrapolation trop longue : l'essai est à plus de `BENCHMARK_ROUGH_GAP`
   * répétitions **sous** la capacité exigée de la première série, ou la charge conseillée dépasse l'essai de plus
   * de `BENCHMARK_MAX_JUMP`. Elle est proposée, mais n'est cochée ni écrite d'office, et le coach ne la reprend pas.
   */
  rough?: true;
  /**
   * `true` quand l'essai a plus de `BENCHMARK_MAX_REPS` répétitions : le max ne se calcule plus, on sait
   * seulement qu'il est au moins celui d'une série de 30 (`oneRepMax`). La charge conseillée est alors un
   * **minimum** — elle ne dit pas ce qu'on tiendra, donc pas de `holdReps` — et la personne la reprend pour
   * refaire l'exercice. Elle est écrite et lue par le coach comme les autres, sauf si elle est approximative.
   */
  minimum?: true;
}

interface Estimated {
  set: Performed;
  oneRepMax: number;
  /** Plus de 30 répétitions : `oneRepMax` est le plancher d'une série de 30, pas une estimation. */
  minimum?: true;
}

/** Le meilleur max : celui qui monte le plus haut ; à égalité, un max qui se calcule l'emporte sur un plancher. */
const beats = (candidate: Estimated, top: Estimated): boolean =>
  candidate.oneRepMax > top.oneRepMax ||
  (candidate.oneRepMax === top.oneRepMax && top.minimum === true && candidate.minimum !== true);

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
 * Les séries de travail de la ligne de routine (l'échauffement n'en est pas une). Leur nombre est celui sur
 * lequel la charge doit tenir ; elles reçoivent toutes le même décalage de charge. La première série « droite »
 * donne la fourchette et la charge de départ — sauf pour une pyramide, dont chaque série se dimensionne seule.
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
    if (oneRepMax !== undefined) return [{ set, oneRepMax }];
    // Plus de 30 répétitions : Epley ne mesure plus, mais il ne décroît pas — le max est au moins celui d'une
    // série de 30. On dimensionne sur ce plancher : la charge qui en sort est un minimum, jamais trop haute.
    if (Number.isInteger(set.reps) && set.reps! > BENCHMARK_MAX_REPS) {
      return [{ set, oneRepMax: oneRepMaxOf(set.weight!, BENCHMARK_MAX_REPS)!, minimum: true as const }];
    }
    return [];
  });

  if (estimated.length === 0) {
    // Aucune série que la formule sache lire, ni plancher à en tirer : des répétitions qui ne sont pas un compte
    // entier. On garde la série la plus chargée, puis la plus longue.
    const heaviest = loaded.reduce((best, set) =>
      set.weight! > best.weight! || (set.weight === best.weight && set.reps! > best.reps!)
        ? set
        : best,
    );
    return { ...base, verdict: 'unreadable', zone, tested: resultOf(heaviest) };
  }

  const best = estimated.reduce((top, candidate) => (beats(candidate, top) ? candidate : top));
  const tested = resultOf(best.set);

  const klass = input.exerciseClass ?? 'compound';
  const fatigue = setFatigue(klass, input.restSeconds);
  const planned = plannedSets(working, klass);
  const step = resolveLoadStep({
    equipment: input.equipment,
    ...(input.loadIncrementKg === undefined ? {} : { loadIncrementKg: input.loadIncrementKg }),
  });

  /** La charge qui tient `count` séries dont la dernière garde la réserve au bas de la fourchette `low`. */
  const sizeFor = (low: number, count: number): number =>
    loadForRange(best.oneRepMax, low, count, fatigue, best.set.weight!, step);

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
  // Au-dessus de la capacité exigée, ce qui compte est de combien la charge monte (la consigne est claire : plus
  // lourd) ; en dessous, de combien de répétitions on est loin de ce que la formule fait bien.
  const testedKg = best.set.weight!;
  const testedReps = best.set.reps!;
  const rough =
    testedReps > reference
      ? suggested - testedKg > testedKg * BENCHMARK_MAX_JUMP + 1e-9
      : reference - testedReps > BENCHMARK_ROUGH_GAP;
  // Un plancher ne dit pas ce qu'on tiendra, une pyramide a une charge par série.
  const held = pyramid || best.minimum === true ? [] : repsHeldAt(best.oneRepMax, suggested, planned, fatigue);

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
    ...(best.minimum === true ? { minimum: true as const } : {}),
  };

  if (input.routine === undefined) return line;
  if (first === undefined) return { ...line, routineEmpty: true };

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
 * Ce que le coach lit du benchmark : la charge de la fourchette de l'exercice, tenue sur ses séries, comme objectif
 * — y compris un minimum (plus de 30 répétitions), que sa carte dit « au moins ».
 *
 * Un objectif de charge comme un autre — affiché sur la carte de l'exercice à la séance suivante, jamais
 * prérempli, écrit sur les séries restantes sur un geste —, avec les chiffres qui l'ont produit : jamais
 * un « 77,5 kg » nu.
 *
 * **Aucun signal pour une estimation approximative** : le coach ne pousse pas une extrapolation, la
 * personne la lit sur le bilan et décide de l'écrire ou non dans la routine. Aucun non plus sans charge à
 * proposer (sans charge, répétitions illisibles, au poids du corps), ni pour une pyramide : un objectif est un seul chiffre,
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
      // Au-delà de 30 répétitions le max est un plancher : la carte du coach dit « au moins », pas « environ ».
      ...(line.minimum === true ? [{ label: 'one_rep_max_floor', value: 1 }] : []),
      { label: 'target_reps', value: line.zone.low },
      { label: 'target_reps_max', value: line.zone.high },
      { label: 'planned_sets', value: line.plannedSets },
      { label: 'reference_reps', value: round1(line.referenceReps) },
      ...(line.currentKg === undefined ? [] : [{ label: 'current_load_kg', value: line.currentKg }]),
    ],
  };
}
