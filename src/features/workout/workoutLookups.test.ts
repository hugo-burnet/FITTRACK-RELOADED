import { describe, expect, it } from 'vitest';
import type { WorkoutExerciseDetail } from '@/data/repositories/workouts';
import type { Exercise, WorkoutExercise, WorkoutSet } from '@/data/types';
import { resolveWorkoutExerciseIdentity } from '@/lib/exerciseSnapshot';
import {
  workoutExerciseLoads,
  workoutExerciseNameOf,
  workoutLineOf,
  workoutSetOf,
  workoutSetTypeOf,
} from './workoutLookups';

const exercise = (overrides: Partial<Exercise> = {}): Exercise => ({
  id: 'exercise',
  name: 'Développé couché',
  primaryMuscle: 'chest',
  secondaryMuscles: [],
  equipment: 'barbell',
  measurementType: 'weight_reps',
  isCustom: 0,
  isUnilateral: 0,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
  ...overrides,
});

const row: WorkoutExercise = {
  id: 'row',
  workoutId: 'workout',
  exerciseId: 'exercise',
  order: 0,
  supersetGroup: 0,
  restSeconds: 120,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
};

const set = (overrides: Partial<WorkoutSet>): WorkoutSet => ({
  id: crypto.randomUUID(),
  workoutExerciseId: row.id,
  exerciseId: exercise().id,
  workoutId: row.workoutId,
  order: 0,
  setType: 'normal',
  side: 'both',
  isCompleted: 0,
  performedAt: 0,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
  ...overrides,
});

const detail = (
  currentExercise: Exercise | undefined,
  sets: WorkoutSet[],
): WorkoutExerciseDetail => ({
  row,
  exercise: currentExercise,
  identity: resolveWorkoutExerciseIdentity(row, currentExercise),
  sets,
  previous: [],
});

/**
 * Ce fichier verrouille **les replis**, pas les chemins heureux.
 *
 * Les cas nominaux sont couverts de bout en bout par les 34 cas d'intégration de
 * l'écran de séance. Ce qu'ils ne peuvent pas atteindre est l'instant où une
 * feuille demande une ligne que la base n'a plus : il dure le temps d'une
 * animation de fermeture, et c'est précisément là qu'une exception ferait
 * tomber une séance en cours.
 */
describe('les recherches de l’écran de séance', () => {
  it('rend `null` pour une ligne qui n’existe plus, sans lever', () => {
    expect(workoutLineOf([], 'row')).toBeNull();
  });

  it('nomme « Exercice supprimé » une ligne introuvable plutôt que son identifiant', () => {
    expect(workoutExerciseNameOf([], 'row')).toBe('Exercice supprimé');
  });

  it('lit le nom dans l’instantané, et non dans la bibliothèque d’aujourd’hui', () => {
    // L'exercice a disparu de la bibliothèque, mais la ligne de séance porte son
    // nom d'alors : c'est lui qui doit s'afficher, sinon une séance de 2023 se
    // relirait avec le catalogue de 2027.
    const snapshotted: WorkoutExercise = { ...row, exerciseName: 'Développé couché' };
    const line: WorkoutExerciseDetail = {
      row: snapshotted,
      exercise: undefined,
      identity: resolveWorkoutExerciseIdentity(snapshotted, undefined),
      sets: [],
      previous: [],
    };
    expect(workoutExerciseNameOf([line], 'row')).toBe('Développé couché');
  });

  it('retombe sur le libellé quand la ligne n’a ni exercice ni instantané', () => {
    // Une ligne d'avant les instantanés, dont l'exercice a été supprimé depuis :
    // il n'y a rien à afficher, et un identifiant brut serait pire que la phrase.
    expect(workoutExerciseNameOf([detail(undefined, [])], 'row')).toBe('Exercice supprimé');
  });

  it('retrouve une série où qu’elle soit, et rend `undefined` si elle est partie', () => {
    const target = set({ order: 1, weight: 100 });
    const line = detail(exercise(), [set({ order: 0 }), target]);

    expect(workoutSetOf([line], target.id)).toBe(target);
    expect(workoutSetOf([line], 'inconnue')).toBeUndefined();
  });

  it('retombe sur « normal » pour le type d’une série disparue', () => {
    // La feuille de type lit cette valeur pour cocher son option courante ;
    // sans repli elle s'ouvrirait sans aucune sélection.
    expect(workoutSetTypeOf([], 'inconnue')).toBe('normal');
  });

  it('garde les charges distinctes dans l’ordre, échauffement compris', () => {
    // Le calculateur sert à monter **et** à démonter la barre : les 40 kg de
    // l'échauffement comptent autant que les 100 kg de la série de travail.
    const line = detail(exercise(), [
      set({ order: 0, setType: 'warmup', weight: 40 }),
      set({ order: 1, weight: 100 }),
      set({ order: 2, weight: 100 }),
      set({ order: 3, targetWeight: 80 }),
    ]);

    expect(workoutExerciseLoads(line)).toEqual([40, 100, 80]);
  });

  it('écarte les charges absentes et les barres à vide', () => {
    // Zéro n'est pas une charge à poser, et une série sans poids saisi n'en a
    // aucune : les deux feraient une ligne vide dans le calculateur.
    const line = detail(exercise(), [
      set({ order: 0, weight: 0 }),
      set({ order: 1, reps: 10 }),
      set({ order: 2, weight: 60 }),
    ]);

    expect(workoutExerciseLoads(line)).toEqual([60]);
  });
});
