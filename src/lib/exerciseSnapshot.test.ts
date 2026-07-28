import { describe, expect, it } from 'vitest';
import type { Exercise, Syncable, WorkoutExercise } from '@/data/types';
import {
  exerciseSnapshotOfRow,
  resolveExerciseIdentity,
  snapshotOf,
} from './exerciseSnapshot';

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

describe('resolveExerciseIdentity', () => {
  it("préfère l'instantané à la bibliothèque d'aujourd'hui", () => {
    const identity = resolveExerciseIdentity(
      row(snapshotOf(exercise())),
      exercise({
        name: 'Développé couché (barre)',
        measurementType: 'reps_only',
        primaryMuscle: 'shoulders',
        equipment: 'dumbbell',
      }),
    );

    expect(identity).toEqual({
      name: 'Développé couché',
      measurementType: 'weight_reps',
      primaryMuscle: 'chest',
      equipment: 'barbell',
    });
  });

  it('retombe sur la bibliothèque pour une ligne sans instantané', () => {
    expect(resolveExerciseIdentity(row(), exercise())).toEqual({
      name: 'Développé couché',
      measurementType: 'weight_reps',
      primaryMuscle: 'chest',
      equipment: 'barbell',
    });
  });

  it('arbitre champ par champ, pas en bloc', () => {
    const identity = resolveExerciseIdentity(
      row({ exerciseName: 'Squat avant' }),
      exercise({ name: 'Squat', measurementType: 'weight_reps' }),
    );

    expect(identity).toMatchObject({
      name: 'Squat avant',
      measurementType: 'weight_reps',
    });
  });

  it("n'invente rien quand ni la ligne ni la bibliothèque ne savent", () => {
    const identity = resolveExerciseIdentity(row(), undefined);

    expect(identity).toEqual({});
    expect(Object.keys(identity)).toEqual([]);
  });
});
