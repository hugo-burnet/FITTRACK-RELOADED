import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { DEFAULT_PLATES_KG } from '@/lib/plates';
import { estimateOneRepMax } from '@/lib/oneRepMax';
import { resetDb } from '@/test/resetDb';
import {
  getAvailablePlateWeightsKg,
  getOneRepMaxFormula,
  getWeeklyTrainingGoalHistory,
  setAvailablePlateWeightsKg,
  setOneRepMaxFormula,
  setWeeklyTrainingGoal,
} from './settings';
import { rebuildAllRecords } from './personalRecords';
import { newEntity } from './base';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';

const WITHOUT_25_KG = DEFAULT_PLATES_KG.filter((weight) => weight !== 25);

describe('available plate weights setting', () => {
  beforeEach(resetDb);
  afterEach(() => vi.restoreAllMocks());

  it('retourne la liste canonique complète en absence de réglage', async () => {
    expect(await getAvailablePlateWeightsKg()).toEqual([...DEFAULT_PLATES_KG]);
  });

  it('conserve une sélection sans plaque de 25 kg après une nouvelle lecture', async () => {
    await setAvailablePlateWeightsKg(WITHOUT_25_KG);

    expect(await getAvailablePlateWeightsKg()).toEqual(WITHOUT_25_KG);
  });

  it('conserve un inventaire explicitement vide', async () => {
    await setAvailablePlateWeightsKg([]);

    expect(await getAvailablePlateWeightsKg()).toEqual([]);
  });

  it('retire les doublons et restaure l’ordre canonique', async () => {
    await db.settings.put({
      key: 'availablePlateWeightsKg',
      value: [1, 25, 1, 2.5, 20],
      updatedAt: 1,
    });

    expect(await getAvailablePlateWeightsKg()).toEqual([25, 20, 2.5, 1]);
  });

  it('revient au défaut quand la valeur stockée n’est pas un tableau', async () => {
    await db.settings.put({
      key: 'availablePlateWeightsKg',
      value: { weight: 25 },
      updatedAt: 1,
    });

    expect(await getAvailablePlateWeightsKg()).toEqual([...DEFAULT_PLATES_KG]);
  });

  it('revient au défaut quand un tableau non vide ne contient aucune valeur exploitable', async () => {
    await db.settings.put({
      key: 'availablePlateWeightsKg',
      value: [0, -1, 30, Number.NaN, '25'],
      updatedAt: 1,
    });

    expect(await getAvailablePlateWeightsKg()).toEqual([...DEFAULT_PLATES_KG]);
  });

  it('renouvelle updatedAt à chaque écriture', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    await setAvailablePlateWeightsKg(WITHOUT_25_KG);
    const first = await db.settings.get('availablePlateWeightsKg');

    now.mockReturnValue(2_000);
    await setAvailablePlateWeightsKg(DEFAULT_PLATES_KG);
    const second = await db.settings.get('availablePlateWeightsKg');

    expect(first?.updatedAt).toBe(1_000);
    expect(second?.updatedAt).toBe(2_000);
  });
});
describe('weekly training goal history setting', () => {
  beforeEach(resetDb);
  afterEach(() => vi.restoreAllMocks());

  const july25 = new Date(2026, 6, 25, 12).getTime();
  const august4 = new Date(2026, 7, 4, 12).getTime();
  const august8 = new Date(2026, 7, 8, 20).getTime();
  const augustMonday = new Date(2026, 7, 3).getTime();

  it('rend un historique vide tant que l’utilisateur n’a rien choisi', async () => {
    expect(await getWeeklyTrainingGoalHistory()).toEqual([]);
  });

  it('enregistre le premier objectif comme base rétroactive', async () => {
    await setWeeklyTrainingGoal(4, july25);

    expect(await getWeeklyTrainingGoalHistory()).toEqual([
      { effectiveFromWeek: 0, sessions: 4 },
    ]);
  });

  it('ajoute un changement au lundi de sa semaine', async () => {
    await setWeeklyTrainingGoal(4, july25);
    await setWeeklyTrainingGoal(3, august4);

    expect(await getWeeklyTrainingGoalHistory()).toEqual([
      { effectiveFromWeek: 0, sessions: 4 },
      { effectiveFromWeek: augustMonday, sessions: 3 },
    ]);
  });

  it('remplace un changement refait dans la même semaine', async () => {
    await setWeeklyTrainingGoal(4, july25);
    await setWeeklyTrainingGoal(5, august4);
    await setWeeklyTrainingGoal(3, august8);

    expect(await getWeeklyTrainingGoalHistory()).toEqual([
      { effectiveFromWeek: 0, sessions: 4 },
      { effectiveFromWeek: augustMonday, sessions: 3 },
    ]);
  });

  it('ne pose aucun plafond artificiel', async () => {
    await setWeeklyTrainingGoal(12, july25);

    expect(await getWeeklyTrainingGoalHistory()).toEqual([
      { effectiveFromWeek: 0, sessions: 12 },
    ]);
  });

  it.each([0, -1, 2.5, Number.NaN])(
    'refuse une valeur qui n’est pas un entier strictement positif : %s',
    async (sessions) => {
      await expect(setWeeklyTrainingGoal(sessions, july25)).rejects.toThrow(RangeError);
      expect(await db.settings.get('weeklyTrainingGoalHistory')).toBeUndefined();
    },
  );

  it('normalise défensivement une valeur IndexedDB corrompue', async () => {
    await db.settings.put({
      key: 'weeklyTrainingGoalHistory',
      value: [
        { effectiveFromWeek: augustMonday, sessions: 5 },
        null,
        { effectiveFromWeek: -1, sessions: 6 },
        { effectiveFromWeek: 0, sessions: 4 },
        { effectiveFromWeek: augustMonday, sessions: 3 },
        { effectiveFromWeek: augustMonday + 1, sessions: 2.5 },
      ],
      updatedAt: 1,
    });

    expect(await getWeeklyTrainingGoalHistory()).toEqual([
      { effectiveFromWeek: 0, sessions: 4 },
      { effectiveFromWeek: augustMonday, sessions: 3 },
    ]);
  });
});

describe('one-rep-max formula setting', () => {
  beforeEach(resetDb);
  afterEach(() => vi.restoreAllMocks());

  it.each([undefined, null, 'unknown', 42])(
    'normalizes a missing or invalid persisted value to Epley: %s',
    async (value) => {
      if (value !== undefined) {
        await db.settings.put({ key: 'oneRepMaxFormula', value, updatedAt: 1 });
      }

      expect(await getOneRepMaxFormula()).toBe('epley');
    },
  );

  it('rebuilds only best-1RM records and writes the new formula last', async () => {
    const movement = newEntity<Exercise>({
      name: 'Développé couché',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isCustom: 1,
      isUnilateral: 0,
    });
    const workout = newEntity<Workout>({
      routineId: '',
      name: 'Séance',
      status: 'completed',
      startedAt: 1_700_000_000_000,
      endedAt: 1_700_003_600_000,
      durationSeconds: 3600,
    });
    const row = newEntity<WorkoutExercise>({
      workoutId: workout.id,
      exerciseId: movement.id,
      order: 0,
      supersetGroup: 0,
      restSeconds: 120,
      exerciseName: movement.name,
      exerciseMeasurementType: movement.measurementType,
      exercisePrimaryMuscle: movement.primaryMuscle,
      exerciseEquipment: movement.equipment,
    });
    const completedSet = newEntity<WorkoutSet>({
      workoutExerciseId: row.id,
      exerciseId: movement.id,
      workoutId: workout.id,
      order: 0,
      setType: 'normal',
      side: 'both',
      weight: 100,
      reps: 10,
      isCompleted: 1,
      performedAt: workout.startedAt + 60_000,
    });
    await db.transaction('rw', db.exercises, db.workouts, db.workoutExercises, db.workoutSets, async () => {
      await db.exercises.add(movement);
      await db.workouts.add(workout);
      await db.workoutExercises.add(row);
      await db.workoutSets.add(completedSet);
    });
    await rebuildAllRecords();
    const nonFormulaBefore = await db.personalRecords.filter((record) => record.type !== 'best_1rm').toArray();

    await setOneRepMaxFormula('brzycki');

    expect(await getOneRepMaxFormula()).toBe('brzycki');
    expect(await db.personalRecords.filter((record) => record.type !== 'best_1rm').toArray()).toEqual(
      nonFormulaBefore,
    );
    const currentOneRepMax = await db.personalRecords
      .where('[exerciseId+type]')
      .equals([movement.id, 'best_1rm'])
      .filter((record) => record.deletedAt === 0)
      .first();
    expect(currentOneRepMax).toMatchObject({
      formula: 'brzycki',
      value: estimateOneRepMax(100, 10, 'brzycki'),
    });
  });

  it('rolls back both records and setting if formula reconciliation fails', async () => {
    const oldRecord = newEntity<import('@/data/types').PersonalRecord>({
      exerciseId: 'exercise',
      type: 'best_1rm',
      value: 120,
      achievedAt: 10,
      workoutId: 'workout',
      workoutSetId: 'set',
      formula: 'epley',
    });
    await db.personalRecords.add(oldRecord);
    await db.settings.put({ key: 'oneRepMaxFormula', value: 'epley', updatedAt: 1 });
    vi.spyOn(db.personalRecords, 'bulkPut').mockRejectedValueOnce(new Error('reconciliation failed'));

    await expect(setOneRepMaxFormula('brzycki')).rejects.toThrow('reconciliation failed');

    expect(await getOneRepMaxFormula()).toBe('epley');
    expect(await db.personalRecords.toArray()).toEqual([oldRecord]);
  });

  it.each(['invalid', '', null])('rejects an unsupported formula: %s', async (formula) => {
    await expect(
      setOneRepMaxFormula(formula as import('@/lib/oneRepMax').OneRepMaxFormula),
    ).rejects.toThrow(RangeError);
  });
});
