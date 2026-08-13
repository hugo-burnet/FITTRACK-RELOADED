import { db } from '@/data/db';
import type { CoachRecommendation, CoachRecommendationStatus } from '@/data/types';
import type { CoachSignal } from '@/lib/coach';
import { alive, newEntity, touch } from './base';

/**
 * A refusal silences *that proposal*, not the rule that produced it.
 *
 * Only a signal carrying a load can be refused durably: "no, not 50 kg" is a
 * statement about a number, and the number is what comes back. An observation
 * has no number — dismissing "reps dropped" once would otherwise mute the rule
 * on that exercise for good, and a rule that can be killed by one tap is a rule
 * you cannot trust to warn you later. Its dismissal ends with its session.
 */
function sameProposal(a: CoachRecommendation, signal: CoachSignal): boolean {
  if (signal.nextLoadKg === undefined) return false;
  if (a.exerciseId !== signal.exerciseId || a.code !== signal.code) return false;
  return a.nextLoadKg === signal.nextLoadKg;
}

/** Newest-first history for one exercise (fiche exercice). */
export async function listRecommendationsForExercise(
  exerciseId: string,
): Promise<CoachRecommendation[]> {
  const rows = alive(
    await db.coachRecommendations.where('exerciseId').equals(exerciseId).toArray(),
  );
  return rows.sort((a, b) => b.recommendedAt - a.recommendedAt || b.createdAt - a.createdAt);
}

/** Pending objective per exercise — never pre-fills a set, only proposes a target. */
export async function listPendingRecommendations(
  exerciseIds?: readonly string[],
): Promise<CoachRecommendation[]> {
  if (exerciseIds === undefined) {
    return newestPerExercise(
      alive(await db.coachRecommendations.where('status').equals('pending').toArray()),
    );
  }
  if (exerciseIds.length === 0) return [];

  // `[exerciseId+status]` — the session screen only ever asks about the
  // exercises on today's card, never about the whole journal.
  const keys = [...new Set(exerciseIds)].map((id) => [id, 'pending']);
  return newestPerExercise(
    alive(await db.coachRecommendations.where('[exerciseId+status]').anyOf(keys).toArray()),
  );
}

function newestPerExercise(rows: CoachRecommendation[]): CoachRecommendation[] {
  const best = new Map<string, CoachRecommendation>();
  for (const row of rows) {
    const current = best.get(row.exerciseId);
    if (
      current === undefined ||
      row.recommendedAt > current.recommendedAt ||
      (row.recommendedAt === current.recommendedAt && row.createdAt > current.createdAt)
    ) {
      best.set(row.exerciseId, row);
    }
  }
  return [...best.values()];
}

/**
 * Resolves numeric program-owned objectives inside the caller's Dexie transaction.
 * Observations stay pending, and `superseded` is deliberately not a dismissal.
 */
export async function supersedePendingLoadRecommendations(
  exerciseIds: readonly string[],
  resolvedAt = Date.now(),
): Promise<void> {
  const uniqueIds = [...new Set(exerciseIds)];
  if (uniqueIds.length === 0) return;

  const pendingLoads = alive(
    await db.coachRecommendations.where('exerciseId').anyOf(uniqueIds).toArray(),
  ).filter((row) => row.status === 'pending' && row.nextLoadKg !== undefined);
  if (pendingLoads.length === 0) return;

  await db.coachRecommendations.bulkPut(
    pendingLoads.map((row) =>
      touch(row, {
        status: 'superseded' as CoachRecommendationStatus,
        resolvedAt,
      }),
    ),
  );
}

/**
 * Persist signals the user will see. Skips a proposal already dismissed with the
 * same exercise + code + next load so a refused tip does not come back.
 */
export async function recordCoachSignals(
  signals: readonly CoachSignal[],
  context: { workoutId?: string; recommendedAt?: number } = {},
): Promise<CoachRecommendation[]> {
  if (signals.length === 0) return [];

  const recommendedAt = context.recommendedAt ?? Date.now();
  const exerciseIds = [...new Set(signals.map((signal) => signal.exerciseId))];
  const existing = alive(
    await db.coachRecommendations.where('exerciseId').anyOf(exerciseIds).toArray(),
  );

  const created: CoachRecommendation[] = [];

  await db.transaction('rw', db.coachRecommendations, async () => {
    for (const signal of signals) {
      const dismissed = existing.some(
        (row) => row.status === 'dismissed' && sameProposal(row, signal),
      );
      if (dismissed) continue;

      // Replace prior pending for this exercise — one live objective at a time.
      // `superseded`, never `dismissed`: the user did not answer this one.
      const priorPending = existing.filter(
        (row) =>
          row.exerciseId === signal.exerciseId &&
          row.status === 'pending' &&
          row.deletedAt === 0,
      );
      for (const prior of priorPending) {
        const replaced = touch(prior, {
          status: 'superseded' as CoachRecommendationStatus,
          resolvedAt: recommendedAt,
        });
        await db.coachRecommendations.put(replaced);
        prior.status = replaced.status;
        prior.resolvedAt = replaced.resolvedAt;
      }

      const row = newEntity<CoachRecommendation>({
        exerciseId: signal.exerciseId,
        code: signal.code,
        recommendedAt,
        nextLoadKg: signal.nextLoadKg,
        evidence: signal.evidence.map((item) => ({ ...item })),
        status: 'pending',
        sourceWorkoutId: context.workoutId,
      });
      await db.coachRecommendations.add(row);
      created.push(row);
      existing.push(row);
    }
  });

  return created;
}

export async function dismissRecommendation(id: string): Promise<void> {
  const row = await db.coachRecommendations.get(id);
  if (row === undefined || row.deletedAt !== 0) return;
  if (row.status !== 'pending') return;
  await db.coachRecommendations.put(
    touch(row, { status: 'dismissed', resolvedAt: Date.now() }),
  );
}

/**
 * Accepting an objective in session: applying *is* accepting, and the card
 * closes because the row leaves `pending`, not by a local flag a remount would
 * forget.
 *
 * Complémentaire de `reconcileFollowedLoads`, pas concurrent : les deux ne
 * touchent qu'une ligne `pending`, donc la charge réellement tenue en fin de
 * séance ne réécrit pas un objectif déjà accepté à la main.
 */
export async function markRecommendationFollowed(
  id: string,
  outcome: { workoutId?: string; loadKg?: number } = {},
): Promise<void> {
  const row = await db.coachRecommendations.get(id);
  if (row === undefined || row.deletedAt !== 0) return;
  if (row.status !== 'pending') return;
  await db.coachRecommendations.put(
    touch(row, {
      status: 'followed',
      resolvedAt: Date.now(),
      outcomeWorkoutId: outcome.workoutId,
      outcomeLoadKg: outcome.loadKg,
    }),
  );
}

/**
 * After a session, if the working load matched a pending nextLoad, mark followed.
 * Does not invent follow without a numeric proposal.
 */
export async function reconcileFollowedLoads(
  outcomes: readonly { exerciseId: string; loadKg: number; workoutId?: string }[],
): Promise<void> {
  if (outcomes.length === 0) return;
  const pending = await listPendingRecommendations(outcomes.map((item) => item.exerciseId));
  const byExercise = new Map(pending.map((row) => [row.exerciseId, row]));

  await db.transaction('rw', db.coachRecommendations, async () => {
    for (const outcome of outcomes) {
      const row = byExercise.get(outcome.exerciseId);
      if (row === undefined || row.nextLoadKg === undefined) continue;
      if (row.nextLoadKg !== outcome.loadKg) continue;
      await db.coachRecommendations.put(
        touch(row, {
          status: 'followed',
          resolvedAt: Date.now(),
          outcomeWorkoutId: outcome.workoutId,
          outcomeLoadKg: outcome.loadKg,
        }),
      );
    }
  });
}
