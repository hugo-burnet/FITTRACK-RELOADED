import { describe, expect, it } from 'vitest';
import type { Exercise, Syncable, WorkoutExercise } from '@/data/types';
import { exerciseSnapshotOfRow, snapshotOf } from './exerciseSnapshot';

const stamps: Syncable = {
  id: 'id',
  createdAt: 0,
  updatedAt: 0,
  deletedAt: 0,
};

const exercise = (over: Partial<Exercise> = {}): Exercise => ({
  ...stamps,
  name: 'Développé couché',
  primaryMuscle: 'chest',
  secondaryMuscles: ['triceps'],
  equipment: 'barbell',
  measurementType: 'weight_reps',
  isCustom: 0,
  isUnilateral: 0,
  ...over,
});

const row = (over: Partial<WorkoutExercise> = {}): WorkoutExercise => ({
  ...stamps,
  workoutId: 'w',
  exerciseId: 'e',
  order: 0,
  supersetGroup: 0,
  restSeconds: 90,
  ...over,
});

describe('snapshotOf', () => {
  it('copie les quatre métadonnées lues par les exports et les graphiques', () => {
    expect(snapshotOf(exercise())).toEqual({
      exerciseName: 'Développé couché',
      exerciseMeasurementType: 'weight_reps',
      exercisePrimaryMuscle: 'chest',
      exerciseEquipment: 'barbell',
    });
  });

  it('ne copie ni les muscles secondaires ni le caractère unilatéral', () => {
    const snapshot = snapshotOf(exercise({ isUnilateral: 1 }));

    expect(snapshot).not.toHaveProperty('secondaryMuscles');
    expect(snapshot).not.toHaveProperty('isUnilateral');
  });

  it("n'invente rien quand l'exercice est absent", () => {
    expect(snapshotOf(undefined)).toEqual({});
  });
});

describe('exerciseSnapshotOfRow', () => {
  it('rend les quatre champs déjà portés par la ligne', () => {
    const source = row(snapshotOf(exercise()));

    expect(exerciseSnapshotOfRow(source)).toEqual(snapshotOf(exercise()));
  });

  it("omet les clés absentes plutôt que d'écrire undefined", () => {
    const partial = exerciseSnapshotOfRow(row({ exerciseName: 'Squat' }));

    expect(partial).toEqual({ exerciseName: 'Squat' });
    expect(Object.keys(partial)).toEqual(['exerciseName']);
  });

  it('rend un objet vide pour une ligne antérieure au champ', () => {
    expect(exerciseSnapshotOfRow(row())).toEqual({});
  });
});
