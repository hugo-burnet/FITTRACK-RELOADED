import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type { CoachSignal } from '@/lib/coach';
import { resetDb } from '@/test/resetDb';
import {
  dismissRecommendation,
  listPendingRecommendations,
  listRecommendationsForExercise,
  recordCoachSignals,
  reconcileFollowedLoads,
  supersedePendingLoadRecommendations,
} from './coachRecommendations';

const signal = (partial: Partial<CoachSignal> & Pick<CoachSignal, 'exerciseId' | 'code'>): CoachSignal => ({
  severity: 40,
  evidence: [{ label: 'next_load_kg', value: partial.nextLoadKg ?? 102.5 }],
  nextLoadKg: 102.5,
  ...partial,
});

describe('coachRecommendations repository', () => {
  beforeEach(resetDb);

  it('opens at schema version 10 with the coach journal table', async () => {
    expect(db.verno).toBe(12);
    expect(db.tables.map((table) => table.name)).toContain('coachRecommendations');
  });

  it('records signals and lists them on the exercise sheet newest first', async () => {
    await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 102.5 })],
      { workoutId: 'w1', recommendedAt: 1_000 },
    );
    await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'plateau', nextLoadKg: undefined, evidence: [] })],
      { workoutId: 'w2', recommendedAt: 2_000 },
    );

    const history = await listRecommendationsForExercise('bench');
    expect(history.map((row) => row.code)).toEqual(['plateau', 'range_completed']);
  });

  it('does not repeat a dismissed proposal with the same next load', async () => {
    const [first] = await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 102.5 })],
      { recommendedAt: 1_000 },
    );
    expect(first).toBeDefined();
    await dismissRecommendation(first!.id);

    const again = await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 102.5 })],
      { recommendedAt: 2_000 },
    );
    expect(again).toEqual([]);

    // A different load is a new proposal and may show again.
    const nextStep = await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 105 })],
      { recommendedAt: 3_000 },
    );
    expect(nextStep).toHaveLength(1);
    expect(nextStep[0]!.nextLoadKg).toBe(105);
  });

  it('exposes one pending objective per exercise for session reinjection', async () => {
    await recordCoachSignals(
      [
        signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 102.5 }),
        signal({ exerciseId: 'squat', code: 'range_completed', nextLoadKg: 140 }),
      ],
      { recommendedAt: 1_000 },
    );

    const pending = await listPendingRecommendations(['bench', 'squat', 'deadlift']);
    expect(pending).toHaveLength(2);
    expect(pending.map((row) => row.exerciseId).sort()).toEqual(['bench', 'squat']);
  });

  /**
   * A replaced objective is not a refusal. Writing `dismissed` here would both
   * lie to the journal — the only dataset that can say whether the engine is
   * useful — and block the same proposal from ever coming back.
   */
  it('supersedes a replaced objective instead of calling it dismissed', async () => {
    await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 102.5 })],
      { recommendedAt: 1_000 },
    );
    await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 105 })],
      { recommendedAt: 2_000 },
    );

    const history = await listRecommendationsForExercise('bench');
    expect(history.map((row) => ({ load: row.nextLoadKg, status: row.status }))).toEqual([
      { load: 105, status: 'pending' },
      { load: 102.5, status: 'superseded' },
    ]);
  });

  it('lets a superseded proposal come back — only a refusal is final', async () => {
    await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 102.5 })],
      { recommendedAt: 1_000 },
    );
    await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 105 })],
      { recommendedAt: 2_000 },
    );

    const back = await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 102.5 })],
      { recommendedAt: 3_000 },
    );
    expect(back).toHaveLength(1);
    expect((await listPendingRecommendations(['bench']))[0]!.nextLoadKg).toBe(102.5);
  });

  it('marks a pending recommendation followed when the next load is used', async () => {
    await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 102.5 })],
      { recommendedAt: 1_000 },
    );

    await reconcileFollowedLoads([{ exerciseId: 'bench', loadKg: 102.5, workoutId: 'w2' }]);

    const history = await listRecommendationsForExercise('bench');
    expect(history[0]!.status).toBe('followed');
    expect(history[0]!.outcomeLoadKg).toBe(102.5);
    expect(await listPendingRecommendations(['bench'])).toEqual([]);
  });

  it('supersedes only pending numeric recommendations for the selected exercises', async () => {
    await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 102.5 })],
      { recommendedAt: 1_000 },
    );
    await recordCoachSignals(
      [signal({ exerciseId: 'row', code: 'intra_session_drop', nextLoadKg: undefined })],
      { recommendedAt: 1_100 },
    );
    await recordCoachSignals(
      [signal({ exerciseId: 'squat', code: 'range_completed', nextLoadKg: 140 })],
      { recommendedAt: 1_200 },
    );
    await reconcileFollowedLoads([{ exerciseId: 'squat', loadKg: 140 }]);
    await recordCoachSignals(
      [signal({ exerciseId: 'deadlift', code: 'range_completed', nextLoadKg: 180 })],
      { recommendedAt: 1_300 },
    );

    await supersedePendingLoadRecommendations(['bench', 'row', 'squat'], 2_000);

    expect((await listRecommendationsForExercise('bench'))[0]).toMatchObject({
      status: 'superseded',
      resolvedAt: 2_000,
    });
    const observation = (await listRecommendationsForExercise('row'))[0];
    expect(observation?.status).toBe('pending');
    expect(observation?.resolvedAt).toBeUndefined();
    expect((await listRecommendationsForExercise('squat'))[0]?.status).toBe('followed');
    expect((await listRecommendationsForExercise('deadlift'))[0]?.status).toBe('pending');
  });

  it('allows an identical proposal after program supersession', async () => {
    const proposal = signal({
      exerciseId: 'bench',
      code: 'range_completed',
      nextLoadKg: 102.5,
    });
    await recordCoachSignals([proposal], { recommendedAt: 1_000 });
    await supersedePendingLoadRecommendations(['bench'], 1_500);

    const created = await recordCoachSignals([proposal], { recommendedAt: 2_000 });

    expect(created).toHaveLength(1);
    expect((await listRecommendationsForExercise('bench')).map((row) => row.status)).toEqual([
      'pending',
      'superseded',
    ]);
  });
});

describe('un refus ne tue que la proposition, pas la règle', () => {
  beforeEach(resetDb);

  it('laisse une observation revenir à la séance suivante', async () => {
    const drop: CoachSignal = {
      exerciseId: 'bench',
      code: 'intra_session_drop',
      severity: 20,
      evidence: [{ label: 'drop_reps', value: 4 }],
    };

    const [first] = await recordCoachSignals([drop], { recommendedAt: 1_000 });
    await dismissRecommendation(first!.id);

    // Terrain, 2026-08-12 : refuser une fois éteignait la règle définitivement.
    await recordCoachSignals([drop], { recommendedAt: 2_000 });
    expect(await listPendingRecommendations(['bench'])).toHaveLength(1);
  });

  it('garde une charge refusée hors de la route', async () => {
    const proposal: CoachSignal = {
      exerciseId: 'bench',
      code: 'range_completed',
      severity: 40,
      nextLoadKg: 50,
      evidence: [{ label: 'next_load_kg', value: 50 }],
    };

    const [first] = await recordCoachSignals([proposal], { recommendedAt: 1_000 });
    await dismissRecommendation(first!.id);

    await recordCoachSignals([proposal], { recommendedAt: 2_000 });
    expect(await listPendingRecommendations(['bench'])).toEqual([]);

    // Une autre charge, en revanche, est une autre proposition.
    await recordCoachSignals([{ ...proposal, nextLoadKg: 52.5 }], { recommendedAt: 3_000 });
    expect(await listPendingRecommendations(['bench'])).toHaveLength(1);
  });
});
