import { resolveLoadIncrementKg, nextLoad } from '@/lib/loadIncrement';
import { measurementShape, type WeightRole } from '@/lib/measurement';
import { isWorkingSet } from '@/lib/records';
import type {
  PerformedSessionInput,
  PerformedSetInput,
  RoutineMissingExercise,
  RoutineTargetLineInput,
  RoutineTargetProposal,
  RoutineUnchangedLine,
  RoutineUnchangedReason,
  RoutineUpdateInput,
  RoutineUpdateReview,
} from './types';

/**
 * Ce que l'historique dit d'une routine — **proposé, jamais appliqué**.
 *
 * Les cibles d'une routine sont figées à sa création ; l'historique, lui,
 * progresse. Un rowing prescrit à 57,5 kg et réalisé à 70 depuis trois séances
 * fait de la routine une donnée morte, que toute fonctionnalité la lisant comme
 * source de vérité propage ensuite. Ce module compare les deux et rend une
 * liste de propositions. Il n'écrit rien : `applyRoutineTargetProposals` est le
 * seul chemin d'écriture, et il part d'un geste.
 *
 * Pur par construction (architecture §7) : des enregistrements entrent, une
 * revue sort. Ni Dexie, ni `Date.now()` — ce qui rend les quatre règles
 * vérifiables en une passe Vitest sans base.
 *
 * **Trois lectures décident de tout, et aucune n'est négociable :**
 *
 * 1. *Sens unique.* Une baisse n'est jamais une proposition. Le réalisé sous la
 *    cible ne produit rien — pas même un avertissement à accepter d'un doigt.
 * 2. *Le sens des kilos vient de la mesure.* `weightRole` distingue une charge,
 *    un lest et une **assistance**, où moins de poids est un effort plus dur.
 *    Comparer les nombres sans lui propose d'alourdir l'assistance d'une
 *    traction — c'est le défaut que la revue Codex a relevé sur
 *    `getLastPerformance`, et il coûte exactement une inversion de signe.
 * 3. *La référence est un palier, pas une séance entière.* Un back-off et une
 *    série dégressive sont légers **exprès** ; lire leurs reps comme un
 *    effondrement ou leur charge comme celle à battre transforme un choix en
 *    diagnostic. On ne compare que le palier le plus dur, de chaque côté.
 */

const DEFAULT_REFERENCE_SESSIONS = 3;

/** Au-delà, l'effort ne laisse pas la marge qu'une hausse suppose (règle 3). */
const MAX_REFERENCE_RPE = 8;

/** Float hygiene : 70 − 57,5 vaut 12,500000000000002 en binaire. */
const clean = (value: number): number => Math.round(value * 1000) / 1000;

/** `a` est-il un effort plus dur que `b` ? L'assistance se lit à l'envers. */
const isHarder = (a: number, b: number, role: WeightRole): boolean =>
  role === 'assist' ? a < b : a > b;

const isEasier = (a: number, b: number, role: WeightRole): boolean => isHarder(b, a, role);

/**
 * Les séries qu'une règle de progression a le droit de juger.
 *
 * Échauffements dehors (règle 5, via l'unique `isWorkingSet` du projet), séries
 * dégressives dehors, et séries sans charge dehors : il n'y a rien à comparer.
 */
function judgeableSets(sets: readonly PerformedSetInput[]): PerformedSetInput[] {
  return sets.filter(
    (set) => isWorkingSet(set) && set.setType !== 'dropset' && set.weight !== undefined,
  );
}

/** La charge la plus dure d'un bloc. `undefined` : rien de comparable dedans. */
function topLoadOf(sets: readonly PerformedSetInput[], role: WeightRole): number | undefined {
  let top: number | undefined;
  for (const set of judgeableSets(sets)) {
    const weight = set.weight as number;
    if (top === undefined || isHarder(weight, top, role)) top = weight;
  }
  return top;
}

/** Les séries du palier le plus dur — celles qui répondent de la charge du jour. */
function topTierOf(
  sets: readonly PerformedSetInput[],
  top: number,
  role: WeightRole,
): PerformedSetInput[] {
  return judgeableSets(sets).filter((set) => !isEasier(set.weight as number, top, role));
}

interface ReferenceBlock {
  workoutId: string;
  workoutExerciseId: string;
  performedAt: number;
  sets: PerformedSetInput[];
}

/**
 * Les blocs d'un exercice, une entrée par **séance**.
 *
 * Un exercice fait deux fois dans la même séance arrive en deux blocs (la clé
 * de l'historique est `workoutExerciseId`). Les laisser séparés leur ferait
 * manger deux des trois places de la fenêtre : « les 3 dernières séances »
 * compterait alors deux fois le même jour.
 */
function blocksByExercise(
  sessions: readonly PerformedSessionInput[],
): Map<string, ReferenceBlock[]> {
  const byExercise = new Map<string, Map<string, ReferenceBlock>>();

  for (const session of sessions) {
    const perWorkout = byExercise.get(session.exerciseId) ?? new Map<string, ReferenceBlock>();
    const existing = perWorkout.get(session.workoutId);
    if (existing === undefined) {
      perWorkout.set(session.workoutId, {
        workoutId: session.workoutId,
        workoutExerciseId: session.workoutExerciseId,
        performedAt: session.performedAt,
        sets: [...session.sets],
      });
    } else {
      existing.sets.push(...session.sets);
      existing.performedAt = Math.min(existing.performedAt, session.performedAt);
    }
    byExercise.set(session.exerciseId, perWorkout);
  }

  const result = new Map<string, ReferenceBlock[]>();
  for (const [exerciseId, perWorkout] of byExercise) {
    result.set(
      exerciseId,
      [...perWorkout.values()].sort(
        (a, b) => b.performedAt - a.performedAt || b.workoutId.localeCompare(a.workoutId),
      ),
    );
  }
  return result;
}

/** Le plafond du contrat de reps : le haut ouvert d'une fourchette, ou la cible seule. */
function ceilingOf(sets: readonly { targetReps?: number; targetRepsMax?: number }[]): number | undefined {
  let ceiling: number | undefined;
  for (const set of sets) {
    const value = set.targetRepsMax ?? set.targetReps;
    if (value === undefined) continue;
    if (ceiling === undefined || value > ceiling) ceiling = value;
  }
  return ceiling;
}

/** Le RPE le plus haut effectivement noté. `undefined` : aucun ne l'a été. */
function maxRpeOf(sets: readonly PerformedSetInput[]): number | undefined {
  let max: number | undefined;
  for (const set of sets) {
    if (set.rpe === undefined) continue;
    if (max === undefined || set.rpe > max) max = set.rpe;
  }
  return max;
}

function minRepsOf(sets: readonly PerformedSetInput[]): number | undefined {
  let min: number | undefined;
  for (const set of sets) {
    if (set.reps === undefined) continue;
    if (min === undefined || set.reps < min) min = set.reps;
  }
  return min;
}

type LineOutcome =
  | { kind: 'proposal'; proposal: RoutineTargetProposal }
  | { kind: 'unchanged'; reason: RoutineUnchangedReason };

function reviewLine(
  line: RoutineTargetLineInput,
  blocks: readonly ReferenceBlock[],
  referenceCount: number,
): LineOutcome {
  const planned = line.sets.filter(isWorkingSet);
  if (planned.length === 0) return { kind: 'unchanged', reason: 'no_working_sets' };

  const role = measurementShape(line.measurementType).weightRole;
  // Une planche et un rameur n'ont pas de charge : les règles 3 et 4 parlent
  // toutes les deux de kilos, il n'y a rien à proposer ici.
  if (role === undefined) return { kind: 'unchanged', reason: 'no_weight_target' };

  // Règle 2 : la fenêtre d'abord, le meilleur ensuite — et pas l'inverse.
  const window = blocks.slice(0, referenceCount);
  let reference: ReferenceBlock | undefined;
  let performedWeight: number | undefined;
  for (const block of window) {
    const top = topLoadOf(block.sets, role);
    if (top === undefined) continue;
    // `window` est déjà du plus récent au plus ancien : le strict départage
    // donc deux séances de même charge par la plus récente.
    if (performedWeight === undefined || isHarder(top, performedWeight, role)) {
      reference = block;
      performedWeight = top;
    }
  }
  if (reference === undefined || performedWeight === undefined) {
    return { kind: 'unchanged', reason: 'no_history' };
  }

  const referenceTier = topTierOf(reference.sets, performedWeight, role);
  const referenceInfo = {
    workoutId: reference.workoutId,
    workoutExerciseId: reference.workoutExerciseId,
    performedAt: reference.performedAt,
    workingSetCount: referenceTier.length,
    maxRpe: maxRpeOf(referenceTier),
  };

  const common = {
    routineExerciseId: line.routineExerciseId,
    exerciseId: line.exerciseId,
    exerciseName: line.exerciseName,
    isUnilateral: line.isUnilateral,
    measurementType: line.measurementType,
    performedWeight,
    performedReps: minRepsOf(referenceTier),
    targetSetIds: planned.map((set) => set.id),
    reference: referenceInfo,
  };

  // La cible de la ligne est sa série la plus dure : une pyramide 60/70/80
  // se compare par son sommet, puis se décale entière.
  let currentWeight: number | undefined;
  for (const set of planned) {
    if (set.targetWeight === undefined) continue;
    if (currentWeight === undefined || isHarder(set.targetWeight, currentWeight, role)) {
      currentWeight = set.targetWeight;
    }
  }

  // Règle 4 — le réalisé dépasse déjà la cible (ou la ligne n'en portait
  // aucune) : on propose de la rejoindre, jamais de la dépasser.
  if (currentWeight === undefined || isHarder(performedWeight, currentWeight, role)) {
    return {
      kind: 'proposal',
      proposal: {
        ...common,
        kind: 'align_weight',
        currentWeight,
        proposedWeight: performedWeight,
        deltaKg: currentWeight === undefined ? undefined : clean(performedWeight - currentWeight),
      },
    };
  }

  // Règle 1 — une baisse n'est jamais suggérée, même tenue à l'aise.
  if (isEasier(performedWeight, currentWeight, role)) {
    return { kind: 'unchanged', reason: 'below_target' };
  }

  // Règle 3 — la cible est tenue exactement : reste à savoir si elle l'a été
  // en entier, et avec de la marge.
  const plannedTier = planned.filter(
    (set) => set.targetWeight !== undefined && !isEasier(set.targetWeight, currentWeight, role),
  );
  const required = Math.max(1, plannedTier.length);
  if (referenceTier.length < required) {
    return { kind: 'unchanged', reason: 'range_not_completed' };
  }

  const ceiling = ceilingOf(plannedTier.length > 0 ? plannedTier : planned);
  if (ceiling === undefined) return { kind: 'unchanged', reason: 'no_rep_target' };

  const reachedCeiling = referenceTier.every(
    (set) => set.reps !== undefined && set.reps >= ceiling,
  );
  if (!reachedCeiling) return { kind: 'unchanged', reason: 'range_not_completed' };

  // Un RPE absent n'est pas un RPE supérieur à 8. L'entrée est repliée dans la
  // feuille de série et le plus souvent vide (RF-30) : la traiter comme un refus
  // rendrait la règle inapplicable sur un historique réel.
  const maxRpe = referenceInfo.maxRpe;
  if (maxRpe !== undefined && maxRpe > MAX_REFERENCE_RPE) {
    return { kind: 'unchanged', reason: 'effort_too_high' };
  }

  const incrementKg = resolveLoadIncrementKg(line);
  const proposedWeight = nextLoad(currentWeight, incrementKg, line.measurementType);
  // Une assistance déjà à zéro n'a plus de pas à retirer : ne rien proposer
  // vaut mieux qu'une ligne qui ne change rien.
  if (!isHarder(proposedWeight, currentWeight, role)) {
    return { kind: 'unchanged', reason: 'increment_unavailable' };
  }

  return {
    kind: 'proposal',
    proposal: {
      ...common,
      kind: 'increase_weight',
      currentWeight,
      proposedWeight,
      deltaKg: clean(proposedWeight - currentWeight),
      incrementKg,
    },
  };
}

/**
 * Règle 6 — ce qui a été fait dans les séances de **cette** routine sans y
 * figurer.
 *
 * Borné aux séances parties de la routine, et pas à tout l'historique : sinon
 * chaque exercice jamais pratiqué se présenterait comme « manquant » ici.
 */
function missingExercises(
  input: RoutineUpdateInput,
  known: ReadonlySet<string>,
  referenceCount: number,
): RoutineMissingExercise[] {
  const ownSessions = input.sessions.filter(
    (session) => session.fromRoutineId === input.routineId,
  );

  const workoutDates = new Map<string, number>();
  for (const session of ownSessions) {
    const seen = workoutDates.get(session.workoutId);
    workoutDates.set(
      session.workoutId,
      seen === undefined ? session.performedAt : Math.min(seen, session.performedAt),
    );
  }
  const window = new Set(
    [...workoutDates.entries()]
      .sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))
      .slice(0, referenceCount)
      .map(([workoutId]) => workoutId),
  );

  const byExercise = new Map<string, RoutineMissingExercise & { workoutIds: Set<string> }>();
  for (const session of ownSessions) {
    if (!window.has(session.workoutId) || known.has(session.exerciseId)) continue;

    const working = session.sets.filter(isWorkingSet);
    if (working.length === 0) continue;

    const entry = byExercise.get(session.exerciseId) ?? {
      exerciseId: session.exerciseId,
      exerciseName: session.exerciseName ?? '',
      isUnilateral: session.isUnilateral,
      measurementType: session.measurementType,
      lastPerformedAt: session.performedAt,
      sessionCount: 0,
      workingSetCount: 0,
      bestWeight: undefined,
      workoutIds: new Set<string>(),
    };

    entry.workoutIds.add(session.workoutId);
    entry.sessionCount = entry.workoutIds.size;
    entry.workingSetCount += working.length;
    entry.lastPerformedAt = Math.max(entry.lastPerformedAt, session.performedAt);
    if (entry.exerciseName === '' && session.exerciseName !== undefined) {
      entry.exerciseName = session.exerciseName;
    }

    const role =
      session.measurementType === undefined
        ? undefined
        : measurementShape(session.measurementType).weightRole;
    // Sans rôle connu, la lecture par défaut est celle de la charge : c'est le
    // seul chiffre à montrer, et il n'autorise ici aucune écriture.
    const top = topLoadOf(session.sets, role ?? 'load');
    if (top !== undefined && (entry.bestWeight === undefined || isHarder(top, entry.bestWeight, role ?? 'load'))) {
      entry.bestWeight = top;
    }

    byExercise.set(session.exerciseId, entry);
  }

  return [...byExercise.values()]
    .sort((a, b) => b.lastPerformedAt - a.lastPerformedAt)
    .map((entry) => {
      // `workoutIds` n'a servi qu'à compter les séances sans les compter deux
      // fois ; il ne fait pas partie de ce que l'écran lit.
      const listed: RoutineMissingExercise = {
        exerciseId: entry.exerciseId,
        exerciseName: entry.exerciseName,
        isUnilateral: entry.isUnilateral,
        measurementType: entry.measurementType,
        lastPerformedAt: entry.lastPerformedAt,
        sessionCount: entry.sessionCount,
        workingSetCount: entry.workingSetCount,
        bestWeight: entry.bestWeight,
      };
      return listed;
    });
}

/**
 * La revue d'une routine : ce qu'on propose de monter, ce qui manque, et ce
 * qu'on laisse tel quel **avec sa raison**.
 *
 * `unchanged` n'est pas du décor. Un écran qui ne propose rien et ne dit pas
 * pourquoi se lit comme une panne ; et une règle testée contre un tableau vide
 * est verte pour n'importe quel motif, y compris le mauvais.
 */
export function computeRoutineUpdates(input: RoutineUpdateInput): RoutineUpdateReview {
  const referenceCount = Math.max(1, input.referenceSessionCount ?? DEFAULT_REFERENCE_SESSIONS);
  const expected = new Map(input.lines.map((line) => [line.exerciseId, line.measurementType]));

  // La mesure de l'instantané, et pas celle d'aujourd'hui : une traction passée
  // en répétitions seules ramènerait sinon ses kilos d'**assistance** comme une
  // charge à battre. Écarté avant le regroupement, pour qu'un bloc incompatible
  // ne prenne pas non plus une des trois places de la fenêtre.
  const blocks = blocksByExercise(
    input.sessions.filter((session) => {
      const wanted = expected.get(session.exerciseId);
      return (
        wanted === undefined ||
        session.measurementType === undefined ||
        session.measurementType === wanted
      );
    }),
  );
  const known = new Set(expected.keys());

  const proposals: RoutineTargetProposal[] = [];
  const unchanged: RoutineUnchangedLine[] = [];

  for (const line of [...input.lines].sort((a, b) => a.order - b.order)) {
    const outcome = reviewLine(line, blocks.get(line.exerciseId) ?? [], referenceCount);
    if (outcome.kind === 'proposal') proposals.push(outcome.proposal);
    else {
      unchanged.push({
        routineExerciseId: line.routineExerciseId,
        exerciseId: line.exerciseId,
        exerciseName: line.exerciseName,
        isUnilateral: line.isUnilateral,
        reason: outcome.reason,
      });
    }
  }

  return {
    routineId: input.routineId,
    proposals,
    missingExercises: missingExercises(input, known, referenceCount),
    unchanged,
  };
}
