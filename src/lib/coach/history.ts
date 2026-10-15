import { DAY_MS, RETURN_GAP_DAYS } from './constants';
import { completedWorkingSets } from './sets';
import type { CoachExerciseLine, CoachSetInput } from './types';

/**
 * Remettre l'historique d'un exercice dans l'ordre où on peut le lire : les deux blocs d'une même
 * séance recollés, les séances de la plus récente à la plus ancienne, celles qui partagent le même
 * contrat de répétitions, et la coupure d'une reprise.
 */

/**
 * Same exercise twice in one workout is two lines. Merge sets so drop/rest/range
 * see one continuous block, like `muscleInvolvement` accumulates two lines.
 */
export function mergeLinesForWorkout(lines: readonly CoachExerciseLine[]): CoachExerciseLine[] {
  const byKey = new Map<string, CoachExerciseLine[]>();

  for (const line of lines) {
    const key = `${line.workoutId}::${line.exerciseId}`;
    const blocks = byKey.get(key);
    if (blocks === undefined) byKey.set(key, [line]);
    else blocks.push(line);
  }

  return [...byKey.values()].map(mergeBlocks);
}

/** When the block was first worked; `undefined` for one that carries no timing. */
function firstDoneAt(line: CoachExerciseLine): number | undefined {
  let first: number | undefined;
  for (const set of line.sets) {
    if (set.isCompleted !== 1 || set.performedAt <= 0) continue;
    if (first === undefined || set.performedAt < first) first = set.performedAt;
  }
  return first;
}

/**
 * Two blocks of one exercise, laid end to end in the order they were worked.
 *
 * **Chaque bloc repart de `order: 0`.** Recollées telles quelles, les séries de
 * deux blocs s'entrelacent (A0, B0, A1, B1, A2) et toute règle qui lit la suite
 * des séries lit une séance qui n'a pas eu lieu : les écarts de repos comptent
 * deux fois le temps qui sépare les blocs (un « Repos long » sur deux minutes de
 * repos partout), la dernière série n'est plus la dernière faite, la référence
 * d'une chute de reps vient d'un autre bloc. Les blocs sont donc rangés par
 * l'heure de leur première série faite — l'ordre des lignes est celui des cartes
 * dans la séance, que l'on réarrange — puis chacun est décalé derrière le
 * précédent. Un bloc sans horaire garde sa place d'arrivée, après les autres.
 *
 * Une ligne seule garde ses `order` tels quels.
 */
function mergeBlocks(blocks: readonly CoachExerciseLine[]): CoachExerciseLine {
  const first = blocks[0]!;
  if (blocks.length === 1) {
    return { ...first, sets: first.sets.map((set) => ({ ...set })) };
  }

  const chronological = blocks
    .map((line, arrival) => ({ line, arrival, at: firstDoneAt(line) }))
    .sort((a, b) => {
      if (a.at !== undefined && b.at !== undefined && a.at !== b.at) return a.at - b.at;
      if (a.at !== undefined && b.at === undefined) return -1;
      if (a.at === undefined && b.at !== undefined) return 1;
      return a.arrival - b.arrival;
    });

  const sets: CoachSetInput[] = [];
  let offset = 0;
  for (const { line } of chronological) {
    let last = offset - 1;
    for (const set of line.sets) {
      const order = offset + set.order;
      sets.push({ ...set, order });
      if (order > last) last = order;
    }
    offset = last + 1;
  }

  return { ...first, sets };
}

export function sortNewestFirst(lines: readonly CoachExerciseLine[]): CoachExerciseLine[] {
  return lines
    .slice()
    .sort(
      (a, b) =>
        b.workoutStartedAt - a.workoutStartedAt || b.workoutId.localeCompare(a.workoutId),
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
export function contractKey(line: CoachExerciseLine): string {
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
export function sinceLatestReturn(newestFirst: readonly CoachExerciseLine[]): {
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
