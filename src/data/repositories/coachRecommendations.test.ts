import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type { CoachSignal } from '@/lib/coach';
import { resetDb } from '@/test/resetDb';
import { DAY_MS } from '@/lib/coach/constants';
import { newEntity, touch } from './base';
import { applyCoachRecommendation } from './coachApply';
import { saveArchivedWorkout, deleteArchivedWorkout } from './history';
import { deleteWorkout, discardWorkout } from './workoutLifecycle';
import { seedWorkout } from '@/test/factories';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import {
  DISMISSAL_DAYS,
  PENDING_MAX_AGE_DAYS,
  dismissRecommendation,
  isRefused,
  listPendingRecommendations,
  listRecommendationsForExercise,
  listRecommendationsForWorkout,
  recordCoachSignals,
  reconcileFollowedLoads,
  supersedePendingLoadRecommendations,
} from './coachRecommendations';

// Dates relatives à maintenant : une carte chiffrée de plus de 28 jours n'est plus rendue, donc des
// dates de 1970 la feraient disparaître de la lecture.
const NOW = Date.now();

const signal = (partial: Partial<CoachSignal> & Pick<CoachSignal, 'exerciseId' | 'code'>): CoachSignal => ({
  severity: 40,
  evidence: [{ label: 'next_load_kg', value: partial.nextLoadKg ?? 102.5 }],
  nextLoadKg: 102.5,
  ...partial,
});

describe('coachRecommendations repository', () => {
  beforeEach(resetDb);

  // Le numéro de version n'est pas épinglé ici : il l'était, à 12, sous un titre
  // qui annonçait 10 — la dérive s'est produite. `data/schemaVersion.test.ts`
  // tient ce numéro, et `dbMigration.test.ts` les montées. Ce test-ci ne répond
  // que de la présence de la table.
  it('ouvre la table du journal du coach', async () => {
    expect(db.tables.map((table) => table.name)).toContain('coachRecommendations');
  });

  it('records signals and lists them on the exercise sheet newest first', async () => {
    await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 102.5 })],
      { workoutId: 'w1', recommendedAt: NOW + 1_000 },
    );
    await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'plateau', nextLoadKg: undefined, evidence: [] })],
      { workoutId: 'w2', recommendedAt: NOW + 2_000 },
    );

    const history = await listRecommendationsForExercise('bench');
    expect(history.map((row) => row.code)).toEqual(['plateau', 'range_completed']);
  });

  it('does not repeat a dismissed proposal with the same next load', async () => {
    const [first] = await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 102.5 })],
      { recommendedAt: NOW + 1_000 },
    );
    expect(first).toBeDefined();
    await dismissRecommendation(first!.id);

    const again = await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 102.5 })],
      { recommendedAt: NOW + 2_000 },
    );
    expect(again).toEqual([]);

    // A different load is a new proposal and may show again.
    const nextStep = await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 105 })],
      { recommendedAt: NOW + 3_000 },
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
      { recommendedAt: NOW + 1_000 },
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
      { recommendedAt: NOW + 1_000 },
    );
    await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 105 })],
      { recommendedAt: NOW + 2_000 },
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
      { recommendedAt: NOW + 1_000 },
    );
    await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 105 })],
      { recommendedAt: NOW + 2_000 },
    );

    const back = await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 102.5 })],
      { recommendedAt: NOW + 3_000 },
    );
    expect(back).toHaveLength(1);
    expect((await listPendingRecommendations(['bench']))[0]!.nextLoadKg).toBe(102.5);
  });

  it('marks a pending recommendation followed when the next load is used', async () => {
    await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 102.5 })],
      { recommendedAt: NOW + 1_000 },
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
      { recommendedAt: NOW + 1_000 },
    );
    await recordCoachSignals(
      [signal({ exerciseId: 'row', code: 'intra_session_drop', nextLoadKg: undefined })],
      { recommendedAt: NOW + 1_100 },
    );
    await recordCoachSignals(
      [signal({ exerciseId: 'squat', code: 'range_completed', nextLoadKg: 140 })],
      { recommendedAt: NOW + 1_200 },
    );
    await reconcileFollowedLoads([{ exerciseId: 'squat', loadKg: 140 }]);
    await recordCoachSignals(
      [signal({ exerciseId: 'deadlift', code: 'range_completed', nextLoadKg: 180 })],
      { recommendedAt: NOW + 1_300 },
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
    await recordCoachSignals([proposal], { recommendedAt: NOW + 1_000 });
    await supersedePendingLoadRecommendations(['bench'], 1_500);

    const created = await recordCoachSignals([proposal], { recommendedAt: NOW + 2_000 });

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

    const [first] = await recordCoachSignals([drop], { recommendedAt: NOW + 1_000 });
    await dismissRecommendation(first!.id);

    // Terrain, 2026-08-12 : refuser une fois éteignait la règle définitivement.
    await recordCoachSignals([drop], { recommendedAt: NOW + 2_000 });
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

    const [first] = await recordCoachSignals([proposal], { recommendedAt: NOW + 1_000 });
    await dismissRecommendation(first!.id);

    await recordCoachSignals([proposal], { recommendedAt: NOW + 2_000 });
    expect(await listPendingRecommendations(['bench'])).toEqual([]);

    // Une autre charge, en revanche, est une autre proposition.
    await recordCoachSignals([{ ...proposal, nextLoadKg: 52.5 }], { recommendedAt: NOW + 3_000 });
    expect(await listPendingRecommendations(['bench'])).toHaveLength(1);
  });
});

describe('un refus dure 14 jours', () => {
  beforeEach(resetDb);

  const T = 1_800_000_000_000;
  const proposal: CoachSignal = {
    exerciseId: 'bench',
    code: 'range_ceiling_reached',
    severity: 40,
    nextLoadKg: 102.5,
    evidence: [{ label: 'next_load_kg', value: 102.5 }],
  };

  /** Pose le refus à `T` : `dismissRecommendation` date de « maintenant », pas du temps du test. */
  async function dismissAt(at: number): Promise<string> {
    const [first] = await recordCoachSignals([proposal], { recommendedAt: at - 1_000 });
    const row = (await db.coachRecommendations.get(first!.id))!;
    await db.coachRecommendations.put(touch(row, { status: 'dismissed', resolvedAt: at }));
    return first!.id;
  }

  it('garde les constantes de la spec', () => {
    expect(DISMISSAL_DAYS).toBe(14);
    expect(PENDING_MAX_AGE_DAYS).toBe(28);
  });

  it('ne recrée rien à 13 jours, recrée une carte à 14 jours', async () => {
    await dismissAt(T);

    expect(await recordCoachSignals([proposal], { recommendedAt: T + 13 * DAY_MS })).toEqual([]);

    const back = await recordCoachSignals([proposal], { recommendedAt: T + 14 * DAY_MS });
    expect(back).toHaveLength(1);
    expect(back[0]!.status).toBe('pending');
  });

  it('retombe sur updatedAt pour un refus d’avant le correctif (sans resolvedAt)', async () => {
    const id = await dismissAt(T);
    const row = (await db.coachRecommendations.get(id))!;
    const legacy = { ...row, updatedAt: T };
    delete legacy.resolvedAt;
    await db.coachRecommendations.put(legacy);

    expect(isRefused([legacy], proposal, T + 13 * DAY_MS)).toBe(true);
    expect(isRefused([legacy], proposal, T + 14 * DAY_MS)).toBe(false);
    expect(await recordCoachSignals([proposal], { recommendedAt: T + 13 * DAY_MS })).toEqual([]);
    expect(await recordCoachSignals([proposal], { recommendedAt: T + 14 * DAY_MS })).toHaveLength(1);
  });

  it('ne refuse pas une observation sans charge', async () => {
    const drop: CoachSignal = { exerciseId: 'bench', code: 'intra_session_drop', severity: 20, evidence: [] };
    const [first] = await recordCoachSignals([drop], { recommendedAt: T - 1_000 });
    const row = (await db.coachRecommendations.get(first!.id))!;
    await db.coachRecommendations.put(touch(row, { status: 'dismissed', resolvedAt: T }));
    expect(isRefused([{ ...row, status: 'dismissed', resolvedAt: T }], drop, T + DAY_MS)).toBe(false);
  });
});

describe('une carte chiffrée périme à 28 jours', () => {
  beforeEach(resetDb);

  const T = 1_800_000_000_000;
  const load: CoachSignal = {
    exerciseId: 'bench',
    code: 'range_completed',
    severity: 40,
    nextLoadKg: 102.5,
    evidence: [{ label: 'next_load_kg', value: 102.5 }],
  };

  it('ne rend pas une carte chiffrée de 29 jours, la rend à 28 jours, et la garde en base', async () => {
    await recordCoachSignals([load], { recommendedAt: T });

    expect(await listPendingRecommendations(['bench'], T + 28 * DAY_MS)).toHaveLength(1);
    expect(await listPendingRecommendations(['bench'], T + 29 * DAY_MS)).toEqual([]);
    expect(await listPendingRecommendations(undefined, T + 29 * DAY_MS)).toEqual([]);

    const rows = await listRecommendationsForExercise('bench');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe('pending');
  });

  it('rend toujours une carte sans charge, même de 60 jours', async () => {
    const drop: CoachSignal = { exerciseId: 'bench', code: 'intra_session_drop', severity: 20, evidence: [] };
    await recordCoachSignals([drop], { recommendedAt: T });
    expect(await listPendingRecommendations(['bench'], T + 60 * DAY_MS)).toHaveLength(1);
  });
});

describe('une séance abandonnée, supprimée ou corrigée ne laisse pas de carte fausse', () => {
  beforeEach(resetDb);

  const load: CoachSignal = {
    exerciseId: 'bench',
    code: 'range_completed',
    severity: 40,
    nextLoadKg: 102.5,
    evidence: [{ label: 'next_load_kg', value: 102.5 }],
  };

  /** Séance en cours avec une série non validée sur le développé couché. */
  async function seedActiveWorkout(): Promise<string> {
    const workout = newEntity<Workout>({
      routineId: '',
      name: 'Live',
      status: 'active',
      startedAt: NOW,
      endedAt: 0,
      durationSeconds: 0,
    });
    const row = newEntity<WorkoutExercise>({
      workoutId: workout.id,
      exerciseId: 'bench',
      order: 0,
      supersetGroup: 0,
      restSeconds: 120,
    });
    await db.exercises.add({
      ...newEntity<Exercise>({
        name: 'Développé couché',
        primaryMuscle: 'chest',
        secondaryMuscles: [],
        equipment: 'barbell',
        measurementType: 'weight_reps',
        isCustom: 0,
        isUnilateral: 0,
      }),
      id: 'bench',
    });
    await db.workouts.add(workout);
    await db.workoutExercises.add(row);
    await db.workoutSets.add(
      newEntity<WorkoutSet>({
        workoutExerciseId: row.id,
        exerciseId: 'bench',
        workoutId: workout.id,
        order: 0,
        setType: 'normal',
        side: 'both',
        reps: 5,
        isCompleted: 0,
        performedAt: 0,
      }),
    );
    return workout.id;
  }

  it('C3 : abandonner la séance où un objectif a été appliqué le remet en attente', async () => {
    const workoutId = await seedActiveWorkout();
    const [rec] = await recordCoachSignals([load], { workoutId: 'previous', recommendedAt: NOW });
    expect(await applyCoachRecommendation(rec!.id, workoutId)).toBe(1);
    expect((await db.coachRecommendations.get(rec!.id))?.status).toBe('followed');

    await discardWorkout(workoutId);

    const stored = await db.coachRecommendations.get(rec!.id);
    expect(stored?.status).toBe('pending');
    // Les clés disparaissent, elles ne valent pas `undefined`.
    expect(stored).not.toHaveProperty('resolvedAt');
    expect(stored).not.toHaveProperty('outcomeWorkoutId');
    expect(stored).not.toHaveProperty('outcomeLoadKg');
    expect((await listPendingRecommendations(['bench'])).map((row) => row.id)).toEqual([rec!.id]);
  });

  it('C3 : abandonner une séance ne rouvre pas une carte suivie dans une autre séance', async () => {
    const workoutId = await seedActiveWorkout();
    const [rec] = await recordCoachSignals([load], { recommendedAt: NOW });
    await db.coachRecommendations.put(
      touch((await db.coachRecommendations.get(rec!.id))!, {
        status: 'followed',
        resolvedAt: NOW,
        outcomeWorkoutId: 'autre',
        outcomeLoadKg: 102.5,
      }),
    );

    await discardWorkout(workoutId);

    expect((await db.coachRecommendations.get(rec!.id))?.status).toBe('followed');
  });

  it('C4 : supprimer la séance source retire sa carte en attente, pas celle d’une autre séance', async () => {
    const source = await seedWorkout({ exerciseId: 'bench', performedAt: NOW - DAY_MS, sets: [[100, 5]] });
    const [fromSource] = await recordCoachSignals([load], { workoutId: source.id, recommendedAt: NOW });
    const other = { ...load, exerciseId: 'squat' };
    const [fromOther] = await recordCoachSignals([other], { workoutId: 'autre', recommendedAt: NOW });

    await deleteWorkout(source.id);

    const stored = await db.coachRecommendations.get(fromSource!.id);
    expect(stored?.status).toBe('superseded');
    expect(stored?.resolvedAt).toBeGreaterThan(0);
    expect((await db.coachRecommendations.get(fromOther!.id))?.status).toBe('pending');
  });

  it('C4 : une carte d’une autre séance du même exercice n’est pas touchée', async () => {
    const source = await seedWorkout({ exerciseId: 'bench', performedAt: NOW - 2 * DAY_MS, sets: [[100, 5]] });
    const [rec] = await recordCoachSignals([load], { workoutId: 'plus-recente', recommendedAt: NOW });

    await deleteWorkout(source.id);

    expect((await db.coachRecommendations.get(rec!.id))?.status).toBe('pending');
  });

  it('C4 : corriger la séance source retire sa carte en attente', async () => {
    const source = await seedWorkout({ exerciseId: 'bench', performedAt: NOW - DAY_MS, sets: [[100, 5]] });
    const [rec] = await recordCoachSignals([load], { workoutId: source.id, recommendedAt: NOW });
    const row = (await db.workoutExercises.where('workoutId').equals(source.id).toArray())[0]!;
    const set = (await db.workoutSets.where('workoutId').equals(source.id).toArray())[0]!;

    await saveArchivedWorkout({
      workoutId: source.id,
      name: source.name,
      startedAt: source.startedAt,
      durationSeconds: 3600,
      exercises: [
        {
          id: row.id,
          exerciseId: 'bench',
          supersetGroup: 0,
          restSeconds: 120,
          sets: [{ id: set.id, setType: 'normal', side: 'both', weight: 90, reps: 5 }],
        },
      ],
    });

    expect((await db.coachRecommendations.get(rec!.id))?.status).toBe('superseded');
  });

  it('C4 : supprimer une séance de l’historique retire aussi sa carte', async () => {
    const source = await seedWorkout({ exerciseId: 'bench', performedAt: NOW - DAY_MS, sets: [[100, 5]] });
    const [rec] = await recordCoachSignals([load], { workoutId: source.id, recommendedAt: NOW });

    await deleteArchivedWorkout(source.id);

    expect((await db.coachRecommendations.get(rec!.id))?.status).toBe('superseded');
  });

  it('M4 : supprimer la séance qui avait suivi une carte la remet en attente', async () => {
    const source = await seedWorkout({ exerciseId: 'bench', performedAt: NOW - DAY_MS, sets: [[102.5, 5]] });
    const [rec] = await recordCoachSignals([load], { workoutId: 'previous', recommendedAt: NOW });
    await db.coachRecommendations.put(
      touch(rec!, { status: 'followed', resolvedAt: NOW, outcomeWorkoutId: source.id, outcomeLoadKg: 102.5 }),
    );

    await deleteWorkout(source.id);

    const stored = await db.coachRecommendations.get(rec!.id);
    expect(stored?.status).toBe('pending');
    expect(stored).not.toHaveProperty('outcomeWorkoutId');
  });

  it('M4 : supprimer une séance de l’historique remet aussi en attente la carte qu’elle avait suivie', async () => {
    const source = await seedWorkout({ exerciseId: 'bench', performedAt: NOW - DAY_MS, sets: [[102.5, 5]] });
    const [rec] = await recordCoachSignals([load], { workoutId: 'previous', recommendedAt: NOW });
    await db.coachRecommendations.put(
      touch(rec!, { status: 'followed', resolvedAt: NOW, outcomeWorkoutId: source.id, outcomeLoadKg: 102.5 }),
    );

    await deleteArchivedWorkout(source.id);

    expect((await db.coachRecommendations.get(rec!.id))?.status).toBe('pending');
  });

  it('lit ce que le coach a conclu d’une séance : ses propositions, plus récentes d’abord, sans celles des autres', async () => {
    await recordCoachSignals(
      [
        signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 82.5 }),
        signal({ exerciseId: 'press', code: 'range_completed', nextLoadKg: 52.5 }),
      ],
      { workoutId: 'w1', recommendedAt: NOW },
    );
    await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'range_completed', nextLoadKg: 85 })],
      { workoutId: 'w2', recommendedAt: NOW + 1_000 },
    );

    const rows = await listRecommendationsForWorkout('w1');

    expect(rows.map((row) => row.exerciseId).sort()).toEqual(['bench', 'press']);
    expect(rows.every((row) => row.sourceWorkoutId === 'w1')).toBe(true);
  });

  it('ne rend rien pour une séance sans proposition, ni les lignes supprimées', async () => {
    const [row] = await recordCoachSignals(
      [signal({ exerciseId: 'bench', code: 'range_completed' })],
      { workoutId: 'w1', recommendedAt: NOW },
    );
    await db.coachRecommendations.put(touch(row!, { deletedAt: NOW }));

    expect(await listRecommendationsForWorkout('w1')).toEqual([]);
    expect(await listRecommendationsForWorkout('absente')).toEqual([]);
  });
});
