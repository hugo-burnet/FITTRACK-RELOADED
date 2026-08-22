import { describe, expect, it } from 'vitest';
import type { Exercise, Syncable, WorkoutExercise } from '@/data/types';
import {
  exerciseSnapshotOfRow,
  resolveExerciseIdentity,
  resolveWorkoutExerciseIdentity,
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
  it('copie les métadonnées lues par les exports et les graphiques', () => {
    expect(snapshotOf(exercise())).toEqual({
      exerciseName: 'Développé couché',
      exerciseMeasurementType: 'weight_reps',
      exercisePrimaryMuscle: 'chest',
      exerciseSecondaryMuscles: ['triceps'],
      exerciseEquipment: 'barbell',
      exerciseIsUnilateral: 0,
    });
  });

  it('copie le tableau des secondaires au lieu de le partager', () => {
    const source = exercise();
    const snapshot = snapshotOf(source);

    source.secondaryMuscles.push('shoulders');

    // Partager la référence ferait qu'éditer l'exercice réécrirait la séance —
    // exactement ce que l'instantané existe pour empêcher.
    expect(snapshot.exerciseSecondaryMuscles).toEqual(['triceps']);
  });

  it("omet la clé pour un exercice qui n'a aucun secondaire", () => {
    expect(snapshotOf(exercise({ secondaryMuscles: [] }))).not.toHaveProperty(
      'exerciseSecondaryMuscles',
    );
  });

  it('fige le coefficient de charge au poids du corps', () => {
    expect(snapshotOf(exercise({ bodyweightLoadFactor: 1 }))).toMatchObject({
      exerciseBodyweightLoadFactor: 1,
    });
  });

  /**
   * Les secondaires étaient volontairement exclus jusqu'au Lot 5bis : rien ne
   * les lisait. Le schéma musculaire les lit, donc ils sont figés comme les
   * autres — un développé couché qui laisse les triceps éteints est faux.
   * L'unilatéral, lui, reste dehors : toujours aucun lecteur.
   */
  it('ne copie pas le caractère unilatéral', () => {
    expect(snapshotOf(exercise({ isUnilateral: 1 }))).not.toHaveProperty('isUnilateral');
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
        secondaryMuscles: ['lats'],
        equipment: 'dumbbell',
      }),
    );

    expect(identity).toEqual({
      name: 'Développé couché',
      measurementType: 'weight_reps',
      primaryMuscle: 'chest',
      secondaryMuscles: ['triceps'],
      equipment: 'barbell',
      isUnilateral: 0,
    });
  });

  it('retombe sur la bibliothèque pour une ligne sans instantané', () => {
    expect(resolveExerciseIdentity(row(), exercise())).toEqual({
      name: 'Développé couché',
      measurementType: 'weight_reps',
      primaryMuscle: 'chest',
      secondaryMuscles: ['triceps'],
      equipment: 'barbell',
      isUnilateral: 0,
    });
  });

  /**
   * Le cas que le champ par champ ne doit **pas** attraper. Une ligne
   * instantanée qui ne porte aucun secondaire est soit antérieure au champ, soit
   * celle d'un exercice qui n'en a réellement aucun. Retomber sur la
   * bibliothèque d'aujourd'hui dans le second cas réécrirait la séance passée —
   * c'est précisément ce que 08B interdit.
   */
  it("n'emprunte pas les secondaires d'aujourd'hui à une ligne déjà instantanée", () => {
    const identity = resolveExerciseIdentity(
      row({ exercisePrimaryMuscle: 'chest', exerciseName: 'Développé couché' }),
      exercise({ secondaryMuscles: ['triceps', 'shoulders'] }),
    );

    expect(identity).not.toHaveProperty('secondaryMuscles');
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

  it("préfère le coefficient de l'instantané à celui de la bibliothèque", () => {
    expect(
      resolveExerciseIdentity(
        row({ exerciseBodyweightLoadFactor: 0.7 }),
        exercise({ bodyweightLoadFactor: 1 }),
      ).bodyweightLoadFactor,
    ).toBe(0.7);
  });

  it("n'invente rien quand ni la ligne ni la bibliothèque ne savent", () => {
    const identity = resolveExerciseIdentity(row(), undefined);

    expect(identity).toEqual({});
    expect(Object.keys(identity)).toEqual([]);
  });
});

describe('resolveWorkoutExerciseIdentity', () => {
  it("conserve le type de l'instantané avant celui de la bibliothèque", () => {
    expect(
      resolveWorkoutExerciseIdentity(
        row({ exerciseMeasurementType: 'assisted_weight_reps' }),
        exercise({ measurementType: 'weight_reps' }),
      ).measurementType,
    ).toBe('assisted_weight_reps');
  });

  it("conserve le type de bibliothèque d'une ancienne ligne sans instantané", () => {
    expect(
      resolveWorkoutExerciseIdentity(
        row(),
        exercise({ measurementType: 'time_only', deletedAt: 1 }),
      ).measurementType,
    ).toBe('time_only');
  });

  it("n'utilise weight_reps que lorsque les deux sources sont absentes", () => {
    expect(resolveWorkoutExerciseIdentity(row(), undefined).measurementType).toBe('weight_reps');
  });
});

describe('le drapeau unilatéral', () => {
  it('est gelé avec le reste de l’identité', () => {
    expect(snapshotOf(exercise({ isUnilateral: 1 }))).toMatchObject({
      exerciseIsUnilateral: 1,
    });
    expect(snapshotOf(exercise({ isUnilateral: 0 }))).toMatchObject({
      exerciseIsUnilateral: 0,
    });
  });

  it('se recopie d’une ligne, et ne s’invente pas quand il manque', () => {
    expect(exerciseSnapshotOfRow(row({ exerciseIsUnilateral: 1 }))).toMatchObject({
      exerciseIsUnilateral: 1,
    });
    expect(exerciseSnapshotOfRow(row())).not.toHaveProperty('exerciseIsUnilateral');
  });

  // L'instantané gagne, comme les autres champs : décocher l'exercice
  // aujourd'hui ne réécrit pas la séance où il était unilatéral.
  it('se lit dans l’instantané avant la bibliothèque', () => {
    expect(
      resolveExerciseIdentity(row({ exerciseIsUnilateral: 1 }), exercise({ isUnilateral: 0 }))
        .isUnilateral,
    ).toBe(1);
    expect(resolveExerciseIdentity(row(), exercise({ isUnilateral: 1 })).isUnilateral).toBe(1);
    expect(resolveExerciseIdentity(row(), undefined).isUnilateral).toBeUndefined();
  });
});
