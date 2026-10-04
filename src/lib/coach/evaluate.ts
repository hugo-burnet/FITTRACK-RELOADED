import { isWorkingSet } from '@/lib/records';
import { measurementShape, type WeightRole } from '@/lib/measurement';
import { estimateOneRepMax, type OneRepMaxFormula } from '@/lib/oneRepMax';
import {
  defaultLoadIncrementKg,
  inferLoadIncrementKg,
  nextLoad,
  previousLoad,
} from '@/lib/loadIncrement';
import type {
  CoachAction,
  CoachEvaluateOptions,
  CoachEvaluation,
  CoachEvidence,
  CoachExerciseLine,
  CoachSetInput,
  CoachSignal,
  CoachSignalCode,
} from './types';

const DEFAULT_PLATEAU_SESSIONS = 3;
const DEFAULT_DROP_REPS = 2;
const DEFAULT_LONG_REST_MS = 180_000;
/** Consecutive sessions under the floor, at the same load, before backing off. */
const MISSED_SESSIONS = 2;
/**
 * Effort thresholds (spec coach v2, R1). Product policy, not physiology: the
 * corpus has no source for them, and the card says « règle de l'app ».
 */
export const CEILING_GRINDING_RPE = 9.5;
export const CONSOLIDATION_RPE_DROP = 0.5;
export const AT_FAILURE_RPE = 9.5;
/** RPE comes by halves; a mean can land a hair under a threshold in floats. */
const RPE_EPSILON = 1e-9;
/** Spec coach v2, R5 (décision Q4): from this gap on, a session is a comeback. */
export const RETURN_GAP_DAYS = 14;
const DAY_MS = 86_400_000;

/** Severity ladder — UI keeps one signal per exercise; higher wins. */
const SEVERITY: Record<CoachSignalCode, number> = {
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
  range_satisfied: 35,
  plateau: 30,
  intra_session_drop: 20,
  long_rest: 10,
};

const CODE_ORDER: CoachSignalCode[] = [
  'range_missed',
  'returning',
  'range_ceiling_reached',
  'range_completed',
  'consolidating',
  'range_satisfied',
  'plateau',
  'intra_session_drop',
  'long_rest',
];

function completedWorkingSets(sets: readonly CoachSetInput[]): CoachSetInput[] {
  return sets
    .filter((set) => set.isCompleted === 1 && isWorkingSet(set) && set.performedAt > 0)
    .slice()
    .sort((a, b) => a.order - b.order || a.performedAt - b.performedAt);
}

/** Is `weight` an easier set than `reference`? Assistance reads the other way. */
function isEasierLoad(weight: number, reference: number, role: WeightRole): boolean {
  return role === 'assist' ? weight > reference : weight < reference;
}

/**
 * The sets a progression rule may judge: working sets at the session's top load.
 *
 * A drop set and a back-off set are lighter *on purpose* — reading their reps as
 * a collapse, or their load as the one to beat next time, turns a deliberate
 * choice into a diagnosis. `isWorkingSet` only knows about warm-ups.
 */
function progressionSets(line: CoachExerciseLine): CoachSetInput[] {
  const working = completedWorkingSets(line.sets).filter((set) => set.setType !== 'dropset');
  const role = measurementShape(line.measurementType).weightRole;
  const reference = working.find((set) => set.weight !== undefined)?.weight;
  if (role === undefined || reference === undefined) return working;
  return working.filter(
    (set) => set.weight === undefined || !isEasierLoad(set.weight, reference, role),
  );
}

/**
 * The sets the floor of a prescription may judge: progression sets, minus the
 * ones taken to failure on purpose (spec coach v2, R2). The ceiling still reads
 * them — see `rangeFlags`.
 *
 * A failure set is the last one pushed past the prescription. Its reps fall by
 * design: `12 @8,5` then `F 8 @9,5` is the plan working, and reading it as « Baisse
 * de reps » three sessions running — or as a floor missed, which proposed 5 → 2,5 kg
 * on lateral raises — taught the user to ignore the card. The 1RM, the top load
 * and the rep record still read failure sets: they are the best-measured of the
 * session.
 */
function judgedSets(line: CoachExerciseLine): CoachSetInput[] {
  return progressionSets(line).filter((set) => set.setType !== 'failure');
}

/**
 * Mean RPE of the judged sets (spec coach v2, R1), failure sets excluded: they
 * are at 10 by design and would drag every session toward « à l'échec ».
 * Undefined unless at least half of those sets carry an RPE — an absent RPE is
 * neither a 10 nor a 7, and a mean of one set out of four is not the session's.
 */
function sessionEffort(line: CoachExerciseLine): number | undefined {
  const judged = judgedSets(line);
  const rated = judged
    .map((set) => set.rpe)
    .filter((rpe): rpe is number => typeof rpe === 'number' && Number.isFinite(rpe));
  if (judged.length === 0 || rated.length * 2 < judged.length) return undefined;
  return rated.reduce((sum, rpe) => sum + rpe, 0) / rated.length;
}

function roundRpe(value: number): number {
  return Math.round(value * 10) / 10;
}

/** The load step the engine uses, and whether it was read from the history. */
interface CoachIncrement {
  kg: number;
  inferred: boolean;
}

/**
 * Exercise setting → step read from the loads lifted, when finer than the
 * table → equipment table (spec coach v2, R3.1). A machine the user has loaded
 * at 10, 12,5 and 15 kg has a 2,5 kg step, whatever the table says.
 */
function coachIncrement(newestFirst: readonly CoachExerciseLine[]): CoachIncrement {
  const latest = newestFirst[0]!;
  const override = latest.loadIncrementKg;
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
    return { kg: override, inferred: false };
  }
  const table = defaultLoadIncrementKg(latest.equipment);
  const loads: number[] = [];
  for (const line of newestFirst) {
    for (const set of completedWorkingSets(line.sets)) {
      if (typeof set.weight === 'number') loads.push(set.weight);
    }
  }
  const inferred = inferLoadIncrementKg(loads);
  return inferred !== undefined && inferred < table
    ? { kg: inferred, inferred: true }
    : { kg: table, inferred: false };
}

function withIncrementEvidence(evidence: CoachEvidence[], increment: CoachIncrement): void {
  if (increment.inferred) evidence.push({ label: 'inferred_increment_kg', value: increment.kg });
}

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

function isDeloadLine(line: CoachExerciseLine): boolean {
  return line.programIsDeload === 1 ||
    (typeof line.deloadPercent === 'number' &&
      line.deloadPercent > 0 &&
      line.deloadPercent < 100);
}

/**
 * Same exercise twice in one workout is two lines. Merge sets so drop/rest/range
 * see one continuous block, like `muscleInvolvement` accumulates two lines.
 */
export function mergeLinesForWorkout(lines: readonly CoachExerciseLine[]): CoachExerciseLine[] {
  const byKey = new Map<string, CoachExerciseLine>();

  for (const line of lines) {
    const key = `${line.workoutId}::${line.exerciseId}`;
    const existing = byKey.get(key);
    if (existing === undefined) {
      byKey.set(key, {
        ...line,
        sets: line.sets.map((set) => ({ ...set })),
      });
      continue;
    }
    existing.sets.push(...line.sets.map((set) => ({ ...set })));
  }

  return [...byKey.values()];
}

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

/** Ceiling of the prescribed rep contract: open top of a range, or the single target. */
function effectiveCeiling(set: CoachSetInput): number | undefined {
  return set.targetRepsMax ?? set.targetReps;
}

/**
 * Exclusive partition of the rep contract (spec §4.1).
 * Never both `ceiling` and `satisfied`; single-target hit is ceiling only.
 */
function rangeFlags(
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
 * One of `range_ceiling_reached` | `range_satisfied`, never both, never on deload.
 * `range_completed` is not written — journal rows keep it as a read alias only.
 */
function rangePartitionSignal(
  line: CoachExerciseLine,
  increment: CoachIncrement,
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
    const proposed = nextLoad(lastWeight, increment.kg, line.measurementType);
    if (proposed !== lastWeight) {
      nextLoadKg = proposed;
      evidence.push({ label: 'next_load_kg', value: proposed });
      withIncrementEvidence(evidence, increment);
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
 * Build the action set from performance signals only (phase does not touch this).
 * Plateau strips every prescription escalation, including `add_set`.
 */
function buildAllowedActions(signals: readonly CoachSignal[]): CoachAction[] {
  const allowed = new Set<CoachAction>(['maintain']);
  const codes = new Set(signals.map((signal) => signal.code));

  if (codes.has('range_satisfied')) {
    allowed.add('increase_reps');
  }
  const grinding = signals.some((signal) =>
    signal.evidence.some((item) => item.label === 'ceiling_grinding' && item.value === 1),
  );
  // Un plafond arraché n'autorise ni charge ni série de plus : consolider, c'est
  // refaire la même séance plus facilement.
  if ((codes.has('range_ceiling_reached') || codes.has('range_completed')) && !grinding) {
    allowed.add('increase_load');
    allowed.add('add_set');
  }
  if (codes.has('range_missed')) {
    allowed.add('reduce_load');
  }

  if (codes.has('plateau')) {
    for (const action of ['increase_reps', 'increase_load', 'add_set'] as const) {
      allowed.delete(action);
    }
  }
  // Reprise : ni charge ni série de plus. Les répétitions, elles, peuvent monter.
  if (codes.has('returning')) {
    allowed.delete('increase_load');
    allowed.delete('add_set');
  }

  return [...allowed];
}

function sortNewestFirst(lines: readonly CoachExerciseLine[]): CoachExerciseLine[] {
  return lines
    .slice()
    .sort(
      (a, b) =>
        b.workoutStartedAt - a.workoutStartedAt || b.workoutId.localeCompare(a.workoutId),
    );
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
function rangeMissedSignal(
  historyNewestFirst: readonly CoachExerciseLine[],
  increment: CoachIncrement,
): CoachSignal | undefined {
  const comparable = historyNewestFirst.filter((line) => !isDeloadLine(line));
  if (comparable.length < MISSED_SESSIONS) return undefined;

  const window = comparable.slice(0, MISSED_SESSIONS);
  const misses = window.map(floorMiss);
  if (misses.some((miss) => miss === undefined)) return undefined;

  const [latest, ...earlier] = misses as { loadKg: number; lowReps: number; floor: number }[];
  if (earlier.some((miss) => miss.loadKg !== latest!.loadKg)) return undefined;

  const line = window[0]!;
  const proposed = previousLoad(latest!.loadKg, increment.kg, line.measurementType);
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
  if (usable) {
    evidence.push({ label: 'next_load_kg', value: proposed });
    withIncrementEvidence(evidence, increment);
  }

  return {
    code: 'range_missed',
    exerciseId: line.exerciseId,
    ...(usable ? { nextLoadKg: proposed } : {}),
    evidence,
    severity: SEVERITY.range_missed,
  };
}

/** Two loads that are the same figure — or two sets that carry no figure. */
function sameLoad(left: number | undefined, right: number | undefined): boolean {
  return left === right;
}

/**
 * The set a later one may be compared with: the first set of the session that
 * carries the **same load** and a rep count.
 *
 * **A heavier bar is not a collapse.** `100 × 10` then `110 × 7` is a pyramid —
 * the load went up and the reps followed it down, which is what going up a
 * load is. Reading the second set against the first turned a deliberate step
 * into « Baisse de reps observée », and a coach that calls a progression a
 * regression is a coach you stop reading. Reps only mean something against
 * reps done at the same weight; a set that opens a new load has nothing behind
 * it to fall from, so it says nothing until a second set at that load answers.
 *
 * Lighter sets never reach here — `progressionSets` already drops them.
 */
function dropReference(
  working: readonly CoachSetInput[],
  index: number,
): CoachSetInput | undefined {
  const set = working[index]!;
  for (let i = 0; i < index; i += 1) {
    const candidate = working[i]!;
    if (candidate.reps === undefined) continue;
    if (sameLoad(candidate.weight, set.weight)) return candidate;
  }
  return undefined;
}

function intraSessionDropSignal(
  line: CoachExerciseLine,
  dropReps: number,
): CoachSignal | undefined {
  const working = judgedSets(line);
  if (working.length < 2) return undefined;

  let worst: { set: CoachSetInput; reference: CoachSetInput; drop: number } | undefined;
  for (let i = 1; i < working.length; i++) {
    const set = working[i]!;
    const reps = set.reps;
    if (reps === undefined) continue;
    const reference = dropReference(working, i);
    if (reference === undefined) continue;
    const drop = reference.reps! - reps;
    if (drop < dropReps) continue;
    // A set that lands inside its own prescription is not a defect. `12, 12, 12,
    // 10` on an 8–12 range is the range being respected, and calling it a drop
    // is noise the user has to learn to ignore — which is how a coach stops
    // being read at all. Only a set that falls *through the floor* is news.
    if (set.targetReps !== undefined && reps >= set.targetReps) continue;
    if (worst === undefined || drop > worst.drop) {
      worst = { set, reference, drop };
    }
  }
  if (worst === undefined) return undefined;

  return {
    code: 'intra_session_drop',
    exerciseId: line.exerciseId,
    evidence: [
      { label: 'first_reps', value: worst.reference.reps! },
      { label: 'low_reps', value: worst.set.reps! },
      { label: 'drop_reps', value: worst.drop },
    ],
    severity: SEVERITY.intra_session_drop,
  };
}

function restGapsMs(sets: readonly CoachSetInput[]): number[] {
  const working = completedWorkingSets(sets);
  const gaps: number[] = [];
  for (let i = 1; i < working.length; i++) {
    const gap = working[i]!.performedAt - working[i - 1]!.performedAt;
    if (gap > 0) gaps.push(gap);
  }
  return gaps;
}

function longRestSignal(
  line: CoachExerciseLine,
  drop: CoachSignal | undefined,
  longRestMs: number,
): CoachSignal | undefined {
  // Correlates with rule 2 only — a long rest alone is not a defect.
  if (drop === undefined) return undefined;

  const gaps = restGapsMs(line.sets);
  if (gaps.length === 0) return undefined;
  const maxGap = Math.max(...gaps);
  if (maxGap < longRestMs) return undefined;

  return {
    code: 'long_rest',
    exerciseId: line.exerciseId,
    evidence: [
      { label: 'max_rest_seconds', value: Math.round(maxGap / 1000) },
      { label: 'threshold_seconds', value: Math.round(longRestMs / 1000) },
    ],
    severity: SEVERITY.long_rest,
  };
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

function plateauSignal(
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
function consolidationSignal(
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

function isLoadlessCeiling(signal: CoachSignal): boolean {
  return (
    (signal.code === 'range_ceiling_reached' || signal.code === 'range_completed') &&
    signal.nextLoadKg === undefined
  );
}

/** A shaped escalate / deferred hold must not erase the plateau constat (spec §5.2). */
function hidesPlateau(signal: CoachSignal): boolean {
  if (signal.code === 'plateau') return false;
  if (isLoadlessCeiling(signal)) return true;
  return signal.evidence.some(
    (item) => item.label === 'progression_deferred' && item.value === 1,
  );
}

/** Rank signals and keep the single strongest per exercise. */
export function pickSignals(signals: readonly CoachSignal[]): CoachSignal[] {
  const best = new Map<string, CoachSignal>();

  for (const signal of signals) {
    const current = best.get(signal.exerciseId);
    if (current === undefined) {
      best.set(signal.exerciseId, signal);
      continue;
    }
    if (signal.code === 'plateau' && hidesPlateau(current)) {
      best.set(signal.exerciseId, signal);
      continue;
    }
    if (current.code === 'plateau' && hidesPlateau(signal)) {
      continue;
    }
    if (signal.severity > current.severity) {
      best.set(signal.exerciseId, signal);
      continue;
    }
    if (signal.severity < current.severity) continue;
    if (CODE_ORDER.indexOf(signal.code) < CODE_ORDER.indexOf(current.code)) {
      best.set(signal.exerciseId, signal);
    }
  }

  return [...best.values()].sort(
    (a, b) => b.severity - a.severity || CODE_ORDER.indexOf(a.code) - CODE_ORDER.indexOf(b.code),
  );
}

/**
 * The rep contract a session was prescribed (spec coach v2, R4): its distinct
 * `targetReps–targetRepsMax` pairs. Sessions without any target share the
 * empty contract — the stream Hevy imports and free sessions live in.
 *
 * Half the exercises of the measured history are trained under two ranges or
 * more (A/B variants, « reprise » routines). Read as one sequence, a lighter
 * comeback day in 10–12 after weeks in 12–15 became a plateau. What is
 * comparable is the prescription, not the routine: two routines can prescribe
 * the same contract, and a renamed routine is still the same one.
 */
function contractKey(line: CoachExerciseLine): string {
  const pairs = new Set(
    completedWorkingSets(line.sets).map(
      (set) => `${set.targetReps ?? ''}-${set.targetRepsMax ?? ''}`,
    ),
  );
  return [...pairs].sort().join('|');
}

/**
 * The sessions since the latest comeback, and the gap that opened it when the
 * comeback is the session under review (spec coach v2, R5).
 *
 * The gap is measured from the previous session of the exercise *whatever its
 * contract*: a week in 12–15 between two weeks in 8–12 is not a break. Rules
 * that compare sessions do not reach across a break — three weeks off is not
 * the same lifter, and a plateau or a missed floor from before says nothing
 * about after.
 */
function sinceLatestReturn(newestFirst: readonly CoachExerciseLine[]): {
  lines: CoachExerciseLine[];
  gapDays: number | undefined;
} {
  for (let i = 0; i + 1 < newestFirst.length; i += 1) {
    const gap = newestFirst[i]!.workoutStartedAt - newestFirst[i + 1]!.workoutStartedAt;
    if (gap >= RETURN_GAP_DAYS * DAY_MS) {
      return {
        lines: newestFirst.slice(0, i + 1),
        gapDays: i === 0 ? Math.floor(gap / DAY_MS) : undefined,
      };
    }
  }
  return { lines: [...newestFirst], gapDays: undefined };
}

function returningSignal(line: CoachExerciseLine, gapDays: number): CoachSignal {
  return {
    code: 'returning',
    exerciseId: line.exerciseId,
    evidence: [
      { label: 'gap_days', value: gapDays },
      { label: 'threshold_days', value: RETURN_GAP_DAYS },
    ],
    severity: SEVERITY.returning,
  };
}

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

  // Le pas se lit sur tout l'historique : une charge soulevée prouve un cran,
  // quelle que soit la fourchette du jour et même avant une pause.
  const increment = coachIncrement(newestFirst);
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

  return {
    signals,
    allowedActions: buildAllowedActions(signals),
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
