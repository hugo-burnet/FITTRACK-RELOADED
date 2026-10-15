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
    if (needed !== undefined) {
      // Le cran est celui du matériel ; tant que les répétitions ne l'absorbent
      // pas, on vise des répétitions, pas des kilos (R3.2).
      evidence.push(
        { label: 'step_needs_reps', value: needed },
        { label: 'next_step_kg', value: proposed },
        { label: 'target_reps', value: working[0]!.targetReps! },
      );
    } else if (proposed !== lastWeight) {
      nextLoadKg = proposed;
      evidence.push({ label: 'next_load_kg', value: proposed });
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
 * twice in a row at the same load earns one increment back down.
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
  const proposed = previousLoad(latest!.loadKg, increment, line.measurementType);
  if (proposed === latest!.loadKg) return undefined;

  const evidence: CoachEvidence[] = [
    { label: 'sessions', value: MISSED_SESSIONS },
    { label: 'target_reps', value: latest!.floor },
    { label: 'low_reps', value: latest!.lowReps },
    { label: 'current_load_kg', value: latest!.loadKg },
  ];

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
