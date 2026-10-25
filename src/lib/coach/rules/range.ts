import {
  BENCHMARK_MAX_JUMP,
  BENCHMARK_MAX_REPS,
  floorLoad,
  loadForRange,
  setFatigue,
} from '@/lib/benchmarkModel';
import { measurementShape } from '@/lib/measurement';
import { nextLoad, previousLoad, type LoadStep } from '@/lib/loadIncrement';
import { repsToAbsorbStep } from '@/lib/oneRepMax';
import { CEILING_GRINDING_RPE, MISSED_SESSIONS, RPE_EPSILON, SEVERITY } from '../constants';
import {
  effectiveCeiling,
  isDeloadLine,
  judgedSets,
  progressionSets,
  roundRpe,
  sessionEffort,
} from '../sets';
import type { CoachEvidence, CoachExerciseLine, CoachSetInput, CoachSignal } from '../types';

/**
 * La fourchette de répétitions : le plafond atteint ou la fourchette tenue (jamais les deux), et
 * le bas manqué deux fois de suite. C'est la double progression — répétitions d'abord, charge
 * ensuite — dans ses deux sens.
 */

/**
 * How far a failure set at the session's reference load went past the
 * ceiling — information only (spec coach v2, decision Q5): it never turns a
 * range into a ceiling.
 */
function failureRepsOverCeiling(line: CoachExerciseLine, ceilingReps: number): number | undefined {
  let over: number | undefined;
  for (const set of progressionSets(line)) {
    if (set.setType !== 'failure' || set.reps === undefined) continue;
    const margin = set.reps - ceilingReps;
    if (margin > 0 && (over === undefined || margin > over)) over = margin;
  }
  return over;
}

/**
 * Exclusive partition of the rep contract (spec §4.1).
 * Never both `ceiling` and `satisfied`; single-target hit is ceiling only.
 */
export function rangeFlags(
  working: CoachSetInput[],
  judged: CoachSetInput[],
): {
  ceiling: boolean;
  satisfied: boolean;
} {
  if (working.length === 0) return { ceiling: false, satisfied: false };
  if (working.some((set) => effectiveCeiling(set) === undefined)) {
    return { ceiling: false, satisfied: false };
  }
  // **Le plafond se lit sur toutes les séries, échec compris.** Une série à
  // l'échec qui s'arrête sous le haut de la fourchette dit que la charge n'est
  // pas maîtrisée : pec fly `5 × 15 · F 5 × 14` sur 12–15 n'est pas un plafond
  // — l'utilisateur l'a corrigé au premier rejeu qui l'affirmait.
  const ceiling = working.every(
    (set) => set.reps !== undefined && set.reps >= effectiveCeiling(set)!,
  );
  // Le bas de fourchette, lui, se juge hors échec (R2) : c'est là que la série
  // poussée à fond faisait mentir le coach (« 5 → 2,5 kg »).
  if (ceiling || judged.length === 0) return { ceiling, satisfied: false };
  const hasRange = judged.every(
    (set) =>
      set.targetReps !== undefined &&
      set.targetRepsMax !== undefined &&
      set.targetRepsMax > set.targetReps,
  );
  const satisfied =
    hasRange && judged.every((set) => set.reps !== undefined && set.reps >= set.targetReps!);
  return { ceiling, satisfied };
}

/**
 * Reps every set still has to reach before the next step, `undefined` when the
 * session already carries it (spec coach v2, R3.2, décision Q2 révisée).
 *
 * Asked for: enough reps at today's load to land at least on the floor of the
 * range once the step is on. On a heavy bar that is at most the ceiling and the
 * rule says nothing new; on a 10 kg curl with a 2 kg step it is 18. Loads only:
 * a weighted vest sits on top of the body, an assistance comes off it, and the
 * ratio between two steps means nothing there.
 *
 * **Une cible unique n'a pas de bas de fourchette.** Un 5×5 ou un 3×10 prescrit
 * un nombre de répétitions, pas un intervalle : « retomber au bas » après le cran
 * y exigerait toujours une répétition de plus que la cible (6 pour un 5×5 de 40 à
 * 160 kg), que le programme ne demande pas et que personne ne fera. Le coach
 * réclamait l'impossible et ne proposait jamais la hausse. Sans fourchette, la
 * progression du programme, c'est la charge : la règle se tait.
 */
function repsNeededForStep(
  line: CoachExerciseLine,
  working: readonly CoachSetInput[],
  load: number,
  next: number,
): number | undefined {
  if (measurementShape(line.measurementType).weightRole !== 'load') return undefined;
  const floor = working[0]?.targetReps;
  const ceilingReps = working[0] === undefined ? undefined : effectiveCeiling(working[0]);
  if (floor === undefined || ceilingReps === undefined) return undefined;
  if (floor >= ceilingReps) return undefined;
  const absorb = repsToAbsorbStep(load, next, floor);
  if (absorb === undefined || absorb <= ceilingReps) return undefined;
  return working.every((set) => set.reps !== undefined && set.reps >= absorb) ? undefined : absorb;
}

/**
 * Ce qu'une séance dit du maximum de la personne, quand la remise dans la fourchette peut le lire — dans un sens
 * comme dans l'autre : une fourchette ouverte, une seule charge sur toutes les séries, une charge qu'on soulève.
 *
 * La capacité est ce que la personne a fait (sa série la plus longue) plus la réserve que dit le RPE moyen quand il
 * existe : 25 répétitions à RPE 7 sont une capacité de 28. Sans RPE, c'est un plancher — on ne compte que sur ce
 * qu'elle a montré. Epley en tire un max (`oneRepMax`).
 *
 * Une cible unique n'a pas de fourchette où remettre ; une pyramide n'a pas « la » charge ; le poids du corps, lesté ou
 * assisté, ne suit pas la formule.
 */
function capacityReading(
  line: CoachExerciseLine,
  working: readonly CoachSetInput[],
  load: number,
  effort: number | undefined,
):
  | {
      targetReps: number;
      targetRepsMax: number;
      topReps: number;
      reserve: number;
      capacity: number;
      oneRepMax: number;
    }
  | undefined {
  if (measurementShape(line.measurementType).weightRole !== 'load') return undefined;
  const first = working[0];
  if (first?.targetReps === undefined || first.targetRepsMax === undefined) return undefined;
  if (first.targetRepsMax <= first.targetReps) return undefined;
  if (working.some((set) => set.weight !== load || set.reps === undefined)) return undefined;

  const topReps = Math.max(...working.map((set) => set.reps!));
  const reserve = effort === undefined ? 0 : Math.max(0, 10 - effort);
  const capacity = Math.min(BENCHMARK_MAX_REPS, topReps + reserve);
  return {
    targetReps: first.targetReps,
    targetRepsMax: first.targetRepsMax,
    topReps,
    reserve,
    capacity,
    oneRepMax: load * (1 + capacity / 30),
  };
}

/**
 * La charge qui remet dans la fourchette quelqu'un qui en dépasse le plafond : celle qu'un benchmark lui aurait
 * proposée (même formule, `loadForRange`), pas un cran de plus.
 *
 * Un cran de plus suffit presque toujours — 22 répétitions sur un 15 – 20 —, et la règle le garde. Mais 30
 * répétitions à 40 kg disent un max d'au moins 80 kg : trois séries d'un 15 – 20 en demandent 21 à la première,
 * soit 47 kg et non 42,5. Le cran ne remettrait pas dans la fourchette, il en faudrait trois séances.
 *
 * - **Seulement si un cran ne suffit pas.** Si, un cran plus haut, les répétitions qu'on taperait retombent sous le
 *   plafond (la capacité d'alors, moins la réserve qu'on se garde), la règle garde le cran : c'est la double
 *   progression. Sur une large fourchette (un 5 – 12), viser le bas serait un saut de trois crans pour qui vient
 *   d'atteindre le haut — 100 × 12 passe à 102,5, pas à 107,5 — et 12 × 3 à RPE 8 a de la marge : un cran suffit.
 * - **Une fourchette ouverte, une seule charge, une charge.** Une cible unique n'a pas de fourchette où remettre ;
 *   une pyramide n'a pas « la » charge ; le poids du corps, lesté ou assisté, ne suit pas la formule.
 * - **La capacité est ce que la personne a fait** (sa série la plus longue), plus la réserve que dit le RPE moyen
 *   quand il existe : 25 répétitions à RPE 7 sont une capacité de 28. Sans RPE, c'est un plancher — la proposition
 *   ne compte que sur ce que la personne a montré, à un demi-pas près (arrondie au pas le plus proche, `roundLoad`).
 * - **La classe et le repos de l'exercice ne sont pas dans la ligne du coach** : polyarticulaire, deux minutes,
 *   la lecture la plus prudente (la fatigue la plus haute demande la charge la plus basse).
 * - **Jamais plus de 30 % de plus que la charge d'aujourd'hui** (`BENCHMARK_MAX_JUMP`) : un seul essai n'en
 *   justifie pas davantage.
 */
function rebalancedLoad(
  line: CoachExerciseLine,
  working: readonly CoachSetInput[],
  load: number,
  oneStepUp: number,
  increment: LoadStep,
  effort: number | undefined,
): { loadKg: number; topReps: number } | undefined {
  const reading = capacityReading(line, working, load, effort);
  if (reading === undefined) return undefined;

  const { oneRepMax, reserve, topReps } = reading;
  // Un cran plus haut, les répétitions qu'on taperait retombent-elles sous le plafond ? Ce qu'on tape est la capacité
  // d'alors moins la réserve qu'on se garde : 12 répétitions à RPE 8 sont une capacité de 14, et un cran la ramène à 13,
  // soit 11 tapées. Alors le cran suffit, la règle le garde.
  if (30 * (oneRepMax / oneStepUp - 1) - reserve <= reading.targetRepsMax) return undefined;
  const wanted = loadForRange(
    oneRepMax,
    reading.targetReps,
    working.length,
    setFatigue('compound'),
    load,
    increment,
  );
  const ceiling = floorLoad(load * (1 + BENCHMARK_MAX_JUMP), load, increment);
  const loadKg = Math.min(wanted, ceiling);
  return loadKg > 0 ? { loadKg, topReps } : undefined;
}

/** Des répétitions, c'est un compte entier : 7,97 prévues, c'est 8. */
const HALF_REP = 0.5;
/** Le bruit flottant d'une comparaison de charges ou de répétitions calculées. */
const FLOAT_EPSILON = 1e-9;

/**
 * Le nombre de crans de moins qui remettent dans la fourchette quelqu'un qui en manque le bas deux séances de suite —
 * pas un seul quand un seul ne suffit pas. Le cas inverse du plafond très dépassé.
 *
 * Une série de 8 répétitions sur un 15 – 20 à 40 kg ne se corrige pas d'un cran de 2,5 kg : il en faudrait quatre
 * séances. On enlève donc des crans, un par un, jusqu'à ce que la pire série retombe au bas de la fourchette d'après
 * ce que la personne a fait : ce qu'elle a tenu, plus ce que chaque cran lui rend (`(30 + capacité) × (charge /
 * charge allégée − 1)`, la même lecture d'Epley que le benchmark), à une demi-répétition près — des répétitions, c'est
 * un compte entier.
 *
 * - **Le moins de crans possible.** C'est une correction, pas un réétalonnage : 14, 13, 13 sur un 15 – 20 gardent un
 *   cran ; 8, 8, 7 sur un 8 – 12 aussi. La charge qu'un benchmark proposerait garde deux répétitions de réserve à la
 *   dernière série, ce qu'une correction n'a pas à exiger — elle ferait passer 100 kg à 87,5 pour une répétition de
 *   manque.
 * - **Même lecture que le plafond** (`capacityReading`) : une fourchette ouverte, une seule charge sur toutes les
 *   séries, la capacité du meilleur set et la réserve du RPE moyen. Sinon, un cran, comme avant.
 * - **Jamais plus de 30 % de moins que la charge d'aujourd'hui** (`BENCHMARK_MAX_JUMP`) : deux séances ne
 *   justifient pas davantage, et un cran déjà plus loin que ça (5 kg, un pas de 2,5) reste ce qu'il était.
 */
function stepsBackIntoRange(
  line: CoachExerciseLine,
  load: number,
  lowReps: number,
  floorReps: number,
  oneStepDown: number,
  increment: LoadStep,
): { loadKg: number; steps: number; targetReps: number; targetRepsMax: number } | undefined {
  if (!(oneStepDown > 0)) return undefined;
  const reading = capacityReading(line, progressionSets(line), load, sessionEffort(line));
  if (reading === undefined) return undefined;

  /** Les répétitions de la pire série à `candidate` : celles d'aujourd'hui, plus ce que l'allègement rend. */
  const worstRepsAt = (candidate: number): number =>
    lowReps + (30 + reading.capacity) * (load / candidate - 1);
  const lightest = load * (1 - BENCHMARK_MAX_JUMP);

  let candidate = oneStepDown;
  let steps = 1;
  while (worstRepsAt(candidate) < floorReps - HALF_REP - FLOAT_EPSILON) {
    const next = previousLoad(candidate, increment, line.measurementType);
    if (!(next < candidate) || next <= 0 || next < lightest - FLOAT_EPSILON) break;
    candidate = next;
    steps += 1;
  }
  return steps > 1
    ? {
        loadKg: candidate,
        steps,
        targetReps: reading.targetReps,
        targetRepsMax: reading.targetRepsMax,
      }
    : undefined;
}

/**
 * One of `range_ceiling_reached` | `range_satisfied`, never both, never on deload.
 * `range_completed` is not written — journal rows keep it as a read alias only.
 */
export function rangePartitionSignal(
  line: CoachExerciseLine,
  increment: LoadStep,
  returning: boolean,
): CoachSignal | undefined {
  if (isDeloadLine(line)) return undefined;

  // Les deux revues se rejoignent ici : la partition plafond/fourchette du
  // Lot 17 se lit sur les séries que le Lot 18 juge progressables — ni
  // échauffement, ni drop set, ni série allégée à dessein. Depuis le coach v2,
  // la série à l'échec compte pour le plafond mais pas pour le bas de fourchette.
  const working = progressionSets(line);
  if (working.length === 0) return undefined;
  const judged = judgedSets(line);
  const { ceiling, satisfied } = rangeFlags(working, judged);
  if (!ceiling && !satisfied) return undefined;

  const over = failureRepsOverCeiling(line, effectiveCeiling(working[0]!)!);
  const failureEvidence: CoachEvidence[] =
    over === undefined ? [] : [{ label: 'failure_reps_over_ceiling', value: over }];

  if (satisfied) {
    const floor = judged[0]!.targetReps!;
    const max = judged[0]!.targetRepsMax!;
    return {
      code: 'range_satisfied',
      exerciseId: line.exerciseId,
      evidence: [
        { label: 'working_sets', value: judged.length },
        { label: 'target_reps', value: floor },
        { label: 'target_reps_max', value: max },
        ...failureEvidence,
      ],
      severity: SEVERITY.range_satisfied,
    };
  }

  // ceiling
  const ceilingReps = effectiveCeiling(working[0]!)!;
  const lastWeight = [...working].reverse().find((set) => set.weight !== undefined)?.weight;
  const evidence: CoachEvidence[] = [
    { label: 'working_sets', value: working.length },
    { label: 'target_reps_max', value: ceilingReps },
  ];

  // **Plafond arraché : on consolide (décision Q1).** Douze répétitions à RPE 10
  // ne sont pas douze répétitions maîtrisées ; monter maintenant, c'est arriver
  // la fois d'après sous le plancher. Le constat reste, sans charge proposée.
  const effort = sessionEffort(line);
  const grinding = effort !== undefined && effort >= CEILING_GRINDING_RPE - RPE_EPSILON;
  if (grinding) {
    evidence.push({ label: 'ceiling_grinding', value: 1 });
    evidence.push({ label: 'session_rpe', value: roundRpe(effort) });
  }

  let nextLoadKg: number | undefined;
  if (lastWeight !== undefined) {
    evidence.push({ label: 'current_load_kg', value: lastWeight });
  }
  // Reprise (R5) : le constat reste, la charge attend la séance d'après.
  if (lastWeight !== undefined && !grinding && !returning) {
    const proposed = nextLoad(lastWeight, increment, line.measurementType);
    const needed = repsNeededForStep(line, working, lastWeight, proposed);
    if (needed !== undefined && needed > BENCHMARK_MAX_REPS) {
      // **Au-delà de 30, la règle n'a plus de sortie.** 2,5 → 5 kg aux élévations sur un 15 – 20
      // demandait 60 répétitions : Epley n'y mesure plus rien, personne ne les fera, et la charge ne
      // montait plus jamais. Le cran passe, et la carte dit que la marche est haute.
      nextLoadKg = proposed;
      evidence.push(
        { label: 'next_load_kg', value: proposed },
        { label: 'step_oversized', value: 1 },
        { label: 'target_reps', value: working[0]!.targetReps! },
      );
    } else if (needed !== undefined) {
      // Le cran est celui du matériel ; tant que les répétitions ne l'absorbent
      // pas, on vise des répétitions, pas des kilos (R3.2).
      evidence.push(
        { label: 'step_needs_reps', value: needed },
        { label: 'next_step_kg', value: proposed },
        { label: 'target_reps', value: working[0]!.targetReps! },
      );
    } else if (proposed !== lastWeight) {
      // Très au-dessus du plafond, un cran ne remet pas dans la fourchette : on propose la charge qui le fait,
      // jamais moins qu'un cran de plus.
      const back = rebalancedLoad(line, working, lastWeight, proposed, increment, effort);
      if (back !== undefined && back.loadKg > proposed) {
        nextLoadKg = back.loadKg;
        evidence.push(
          { label: 'next_load_kg', value: back.loadKg },
          { label: 'ceiling_rebalanced', value: 1 },
          { label: 'top_reps', value: back.topReps },
          { label: 'target_reps', value: working[0]!.targetReps! },
        );
      } else {
        nextLoadKg = proposed;
        evidence.push({ label: 'next_load_kg', value: proposed });
      }
    }
  }
  evidence.push(...failureEvidence);

  return {
    code: 'range_ceiling_reached',
    exerciseId: line.exerciseId,
    nextLoadKg,
    evidence,
    severity: SEVERITY.range_ceiling_reached,
  };
}

/**
 * What one session says about the floor of its range: the load worked, and the
 * worst set under the prescribed minimum. `undefined` means "this session did
 * not miss", which includes every session the engine cannot read (no range, no
 * reps, no weight) — silence is the only honest answer there.
 *
 * Lit sur `progressionSets`, comme la partition de fourchette et la chute de
 * reps — et pas sur toutes les séries de travail, ce qui était le défaut. Une
 * dégressive terminait la ligne : c'est *elle* qui donnait `loadKg`, et le
 * coach annonçait « 3,5 → 0 kg » sur un exercice travaillé à 5 kg. La charge de
 * référence d'une séance est celle du haut, jamais celle qu'on a allégée exprès
 * pour finir la série.
 */
function floorMiss(
  line: CoachExerciseLine,
): { loadKg: number; lowReps: number; floor: number } | undefined {
  const working = judgedSets(line);
  if (working.length === 0) return undefined;

  let worst: { reps: number; floor: number } | undefined;
  for (const set of working) {
    if (set.targetReps === undefined || set.reps === undefined) return undefined;
    if (set.reps >= set.targetReps) continue;
    if (worst === undefined || set.reps < worst.reps) {
      worst = { reps: set.reps, floor: set.targetReps };
    }
  }
  if (worst === undefined) return undefined;

  const loadKg = [...working].reverse().find((set) => set.weight !== undefined)?.weight;
  if (loadKg === undefined) return undefined;

  return { loadKg, lowReps: worst.reps, floor: worst.floor };
}

/**
 * The other half of double progression, promised by the roadmap: a range missed
 * twice in a row at the same load earns one increment back down — or as many as
 * it takes to put the worst set back at the floor, when one is not enough
 * (`stepsBackIntoRange`).
 *
 * **Two sessions, not one.** A single miss is a bad day — bad sleep, a late
 * meal, a busy rack. Backing off on one is how a coach teaches you to stop
 * reading it. And the roadmap's "hold, then decrease" needs no signal for the
 * hold: saying nothing *is* holding, which is already what the app does.
 *
 * **Same load in both**, otherwise the two sessions are not the same attempt
 * and there is nothing to conclude. Deload sessions are skipped, like
 * everywhere else — the charges drop on purpose there.
 */
export function rangeMissedSignal(
  historyNewestFirst: readonly CoachExerciseLine[],
  increment: LoadStep,
): CoachSignal | undefined {
  const comparable = historyNewestFirst.filter((line) => !isDeloadLine(line));
  if (comparable.length < MISSED_SESSIONS) return undefined;

  const window = comparable.slice(0, MISSED_SESSIONS);
  const misses = window.map(floorMiss);
  if (misses.some((miss) => miss === undefined)) return undefined;

  const [latest, ...earlier] = misses as { loadKg: number; lowReps: number; floor: number }[];
  if (earlier.some((miss) => miss.loadKg !== latest!.loadKg)) return undefined;

  const line = window[0]!;
  const oneStepDown = previousLoad(latest!.loadKg, increment, line.measurementType);
  if (oneStepDown === latest!.loadKg) return undefined;

  const evidence: CoachEvidence[] = [
    { label: 'sessions', value: MISSED_SESSIONS },
    { label: 'target_reps', value: latest!.floor },
    { label: 'low_reps', value: latest!.lowReps },
    { label: 'current_load_kg', value: latest!.loadKg },
  ];

  // Très sous le bas de la fourchette, un cran de moins ne remet pas dedans : on en enlève autant qu'il faut,
  // jamais moins d'un.
  const back = stepsBackIntoRange(
    line,
    latest!.loadKg,
    latest!.lowReps,
    latest!.floor,
    oneStepDown,
    increment,
  );
  const proposed = back?.loadKg ?? oneStepDown;
  if (back !== undefined) {
    evidence.push(
      { label: 'floor_steps', value: back.steps },
      { label: 'target_reps_max', value: back.targetRepsMax },
    );
  }

  // Alléger, c'est charger moins — pas ne rien charger. Un pas de 2,5 kg sous
  // une charge de 3,5 kg retombe sur la grille à zéro, et « → 0 kg » n'est pas
  // une consigne : c'est une barre vide affichée en gros chiffre sur la carte.
  // Le constat reste — le bas de fourchette a bien été manqué deux fois — mais
  // sans proposition chiffrée, il n'y a rien de plus léger à mettre.
  const usable = proposed > 0;
  if (usable) evidence.push({ label: 'next_load_kg', value: proposed });

  return {
    code: 'range_missed',
    exerciseId: line.exerciseId,
    ...(usable ? { nextLoadKg: proposed } : {}),
    evidence,
    severity: SEVERITY.range_missed,
  };
}
