import { db } from '@/data/db';
import type { CoachRecommendation, CoachRecommendationStatus } from '@/data/types';
import type { CoachSignal } from '@/lib/coach';
import { DAY_MS } from '@/lib/coach/constants';
import { alive, newEntity, touch } from './base';

/** Un refus se tait deux semaines, puis la proposition peut revenir : la forme du jour change. */
export const DISMISSAL_DAYS = 14;

/**
 * Une carte chiffrée ne se rend plus passé ce délai : « 102,5 kg » posé il y a cinq semaines parle d'un
 * corps et d'une barre qui ont bougé. La ligne reste `pending` en base ; seule la lecture l'écarte.
 */
export const PENDING_MAX_AGE_DAYS = 28;

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

/**
 * Vrai si cette proposition a été refusée il y a moins de `DISMISSAL_DAYS` jours.
 *
 * Une ligne `dismissed` d'avant le correctif n'a pas de `resolvedAt` : on lit alors `updatedAt` (la
 * date du refus, faute de mieux) plutôt que de la tenir pour refusée à jamais ou de planter.
 */
export function isRefused(
  rows: readonly CoachRecommendation[],
  signal: CoachSignal,
  at: number,
): boolean {
  return rows.some(
    (row) =>
      row.status === 'dismissed' &&
      sameProposal(row, signal) &&
      at - (row.resolvedAt ?? row.updatedAt) < DISMISSAL_DAYS * DAY_MS,
  );
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

/**
 * Ce que le coach a conclu d'une séance (détail d'une séance passée) : les lignes qu'elle a produites.
 *
 * `sourceWorkoutId` n'est pas indexé : on filtre la table entière. À ce volume (une ligne par exercice et
 * par séance, au plus quelques milliers sur des années) c'est plus rapide qu'une migration de schéma.
 */
export async function listRecommendationsForWorkout(
  workoutId: string,
): Promise<CoachRecommendation[]> {
  const rows = alive(await db.coachRecommendations.toArray()).filter(
    (row) => row.sourceWorkoutId === workoutId,
  );
  return rows.sort((a, b) => b.recommendedAt - a.recommendedAt || b.createdAt - a.createdAt);
}

/** Pending objective per exercise — never pre-fills a set, only proposes a target. */
export async function listPendingRecommendations(
  exerciseIds?: readonly string[],
  now = Date.now(),
): Promise<CoachRecommendation[]> {
  if (exerciseIds === undefined) {
    return newestPerExercise(
      alive(await db.coachRecommendations.where('status').equals('pending').toArray()),
      now,
    );
  }
  if (exerciseIds.length === 0) return [];

  // `[exerciseId+status]` — the session screen only ever asks about the
  // exercises on today's card, never about the whole journal.
  const keys = [...new Set(exerciseIds)].map((id) => [id, 'pending']);
  return newestPerExercise(
    alive(await db.coachRecommendations.where('[exerciseId+status]').anyOf(keys).toArray()),
    now,
  );
}

function newestPerExercise(rows: CoachRecommendation[], now: number): CoachRecommendation[] {
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
  // Après le choix de la plus récente : une vieille carte ne remonte pas parce que la récente est écartée.
  return [...best.values()].filter(
    (row) => row.nextLoadKg === undefined || now - row.recommendedAt <= PENDING_MAX_AGE_DAYS * DAY_MS,
  );
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
 * Retire les cartes en attente **sans charge** des exercices donnés : les observations (« reprise »,
 * « plafond de volume »…) parlent d'une séance qui n'est plus la dernière. Une carte chiffrée reste :
 * elle attend une vraie séance pour être tenue ou remplacée. À appeler dans la transaction de l'appelant.
 */
export async function supersedePendingObservations(
  exerciseIds: readonly string[],
  resolvedAt = Date.now(),
): Promise<void> {
  const uniqueIds = [...new Set(exerciseIds)];
  if (uniqueIds.length === 0) return;

  const keys = uniqueIds.map((id) => [id, 'pending']);
  const observations = alive(
    await db.coachRecommendations.where('[exerciseId+status]').anyOf(keys).toArray(),
  ).filter((row) => row.nextLoadKg === undefined);
  if (observations.length === 0) return;

  await db.coachRecommendations.bulkPut(
    observations.map((row) =>
      touch(row, { status: 'superseded' as CoachRecommendationStatus, resolvedAt }),
    ),
  );
}

/**
 * Retire every pending card of exercises a closed session worked — observations included.
 *
 * `recordCoachSignals` only replaces a card with a new one. A session where the coach has nothing new to
 * say left the old card live: « Reprise après 20 jours » kept showing in the next sessions, whatever the
 * routine, on an exercise done two days earlier. A card speaks for the latest session of its exercise or
 * not at all. `superseded`, never `dismissed`: the user did not answer it.
 */
export async function supersedePendingRecommendations(
  exerciseIds: readonly string[],
  resolvedAt = Date.now(),
): Promise<void> {
  const uniqueIds = [...new Set(exerciseIds)];
  if (uniqueIds.length === 0) return;

  const keys = uniqueIds.map((id) => [id, 'pending']);
  const pending = alive(
    await db.coachRecommendations.where('[exerciseId+status]').anyOf(keys).toArray(),
  );
  if (pending.length === 0) return;

  await db.coachRecommendations.bulkPut(
    pending.map((row) =>
      touch(row, {
        status: 'superseded' as CoachRecommendationStatus,
        resolvedAt,
      }),
    ),
  );
}

/**
 * Remet en attente les cartes qu'une séance avait fait passer `followed`, quand cette séance disparaît.
 *
 * Abandonner une séance où l'objectif avait été appliqué laissait la carte « suivie » alors que rien n'a
 * été tenu : le coach croyait le conseil pris et ne le reproposait plus. Les champs de résultat sont
 * retirés (clés absentes, pas `undefined`) : ils décrivaient une séance qui n'existe plus.
 * À appeler dans la transaction de l'appelant, qui doit lister `db.coachRecommendations`.
 */
export async function reopenRecommendationsFollowedBy(
  workoutId: string,
  exerciseIds: readonly string[],
): Promise<void> {
  const uniqueIds = [...new Set(exerciseIds)];
  if (uniqueIds.length === 0) return;

  const keys = uniqueIds.map((id) => [id, 'followed']);
  const followed = alive(
    await db.coachRecommendations.where('[exerciseId+status]').anyOf(keys).toArray(),
  ).filter((row) => row.outcomeWorkoutId === workoutId);
  if (followed.length === 0) return;

  await db.coachRecommendations.bulkPut(
    followed.map((row) => {
      const reopened = touch(row, { status: 'pending' as CoachRecommendationStatus });
      delete reopened.resolvedAt;
      delete reopened.outcomeWorkoutId;
      delete reopened.outcomeLoadKg;
      return reopened;
    }),
  );
}

/**
 * Retire les cartes en attente nées d'une séance qu'on supprime ou qu'on corrige.
 *
 * Une carte « 102,5 kg » calculée sur une séance effacée, ou sur des charges qu'on vient de rectifier,
 * parle d'une performance qui n'existe plus telle quelle. `superseded`, jamais `dismissed` : l'utilisateur
 * n'a pas répondu. Les cartes issues d'une autre séance du même exercice ne bougent pas.
 * À appeler dans la transaction de l'appelant, qui doit lister `db.coachRecommendations`.
 */
export async function retirePendingRecommendationsFrom(
  workoutId: string,
  exerciseIds: readonly string[],
  at: number,
): Promise<void> {
  const uniqueIds = [...new Set(exerciseIds)];
  if (uniqueIds.length === 0) return;

  const keys = uniqueIds.map((id) => [id, 'pending']);
  const pending = alive(
    await db.coachRecommendations.where('[exerciseId+status]').anyOf(keys).toArray(),
  ).filter((row) => row.sourceWorkoutId === workoutId);
  if (pending.length === 0) return;

  await db.coachRecommendations.bulkPut(
    pending.map((row) =>
      touch(row, { status: 'superseded' as CoachRecommendationStatus, resolvedAt: at }),
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
      if (isRefused(existing, signal, recommendedAt)) continue;

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
    // Plusieurs charges peuvent concerner un exercice : une ligne ne s'écrit qu'une fois.
    const written = new Set<string>();
    for (const outcome of outcomes) {
      const row = byExercise.get(outcome.exerciseId);
      if (row === undefined || row.nextLoadKg === undefined) continue;
      if (row.nextLoadKg !== outcome.loadKg || written.has(row.id)) continue;
      written.add(row.id);
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
