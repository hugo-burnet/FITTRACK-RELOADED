import { describe, expect, it } from 'vitest';
import {
  MUSCLE_GROUPS,
  type Exercise,
  type MuscleGroup,
  type Workout,
  type WorkoutExercise,
  type WorkoutSet,
} from '@/data/types';
import type { ExportSource } from '@/lib/export/types';
import { MUSCLE_SCOPE, muscleBalance, toMuscleRows, type MuscleRow } from './muscles';

const workout = (values: Partial<Workout>): Workout => ({
  id: 'w1',
  createdAt: 0,
  updatedAt: 0,
  deletedAt: 0,
  routineId: '',
  name: 'Upper A',
  status: 'completed',
  startedAt: 1_000,
  endedAt: 2_000,
  durationSeconds: 1_000,
  ...values,
});

const row = (values: Partial<WorkoutExercise>): WorkoutExercise => ({
  id: 'we1',
  createdAt: 0,
  updatedAt: 0,
  deletedAt: 0,
  workoutId: 'w1',
  exerciseId: 'ex1',
  order: 0,
  supersetGroup: 0,
  restSeconds: 120,
  ...values,
});

const exercise = (values: Partial<Exercise>): Exercise => ({
  id: 'ex1',
  createdAt: 0,
  updatedAt: 0,
  deletedAt: 0,
  name: 'Développé couché',
  primaryMuscle: 'chest',
  secondaryMuscles: [],
  equipment: 'barbell',
  measurementType: 'weight_reps',
  isCustom: 0,
  isUnilateral: 0,
  ...values,
});

const set = (values: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: `s-${Math.random()}`,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: 0,
  workoutExerciseId: 'we1',
  exerciseId: 'ex1',
  workoutId: 'w1',
  order: 0,
  setType: 'normal',
  side: 'both',
  isCompleted: 1,
  performedAt: 1,
  weight: 80,
  reps: 8,
  ...values,
});

/** N séries de travail sur un muscle, en une ligne de séance. */
const rows = (muscle: MuscleGroup | undefined, count: number): MuscleRow => ({
  ...(muscle === undefined ? {} : { primaryMuscle: muscle }),
  sets: Array.from({ length: count }, () => set()),
});

const countOf = (list: readonly { muscle: MuscleGroup | undefined; sets: number }[], muscle: MuscleGroup) =>
  list.find((entry) => entry.muscle === muscle)?.sets;

describe('MUSCLE_SCOPE', () => {
  it('classe les dix-huit groupes, sans en laisser un silencieux', () => {
    // Un `Record<MuscleGroup, …>` : ajouter une valeur à MUSCLE_GROUPS sans la
    // classer casse le typecheck. Ce test fixe le versant runtime.
    for (const muscle of MUSCLE_GROUPS) {
      expect(MUSCLE_SCOPE[muscle]).toMatch(/^(region|unscoped)$/);
    }
  });

  it('sort cardio, full_body et other de la répartition, et eux seuls', () => {
    const unscoped = MUSCLE_GROUPS.filter((muscle) => MUSCLE_SCOPE[muscle] === 'unscoped');
    expect(unscoped).toEqual(['full_body', 'cardio', 'other']);
  });
});

describe('muscleBalance', () => {
  it('liste les quinze régions même sans aucune séance', () => {
    // La liste vient de l’anatomie, pas des données : un muscle négligé qui
    // disparaît est un muscle qu’on ne remarque pas.
    const { ranked, unscoped, total } = muscleBalance([]);
    expect(ranked).toHaveLength(15);
    expect(ranked.every((entry) => entry.sets === 0)).toBe(true);
    expect(unscoped).toEqual([]);
    expect(total).toBe(0);
  });

  it('garde à zéro une région jamais travaillée', () => {
    const { ranked } = muscleBalance([rows('chest', 4)]);
    expect(countOf(ranked, 'calves')).toBe(0);
    expect(countOf(ranked, 'chest')).toBe(4);
  });

  it('classe du plus servi au moins servi', () => {
    const { ranked } = muscleBalance([rows('calves', 2), rows('chest', 9), rows('quads', 5)]);
    expect(ranked.slice(0, 3).map((entry) => entry.muscle)).toEqual(['chest', 'quads', 'calves']);
  });

  it('départage une égalité par l’ordre canonique, pour que rien ne danse', () => {
    // `lats` précède `triceps` dans MUSCLE_GROUPS.
    const { ranked } = muscleBalance([rows('triceps', 3), rows('lats', 3)]);
    const order = ranked.map((entry) => entry.muscle);
    expect(order.indexOf('lats')).toBeLessThan(order.indexOf('triceps'));
  });

  it('n’expose un groupe hors répartition que s’il porte quelque chose', () => {
    // « 0 série de Corps entier » ne dit rien à personne : ce n’est pas un
    // muscle, c’est une case de rangement.
    const { ranked, unscoped } = muscleBalance([rows('chest', 3), rows('cardio', 6)]);
    expect(ranked.map((entry) => entry.muscle)).not.toContain('cardio');
    expect(unscoped).toEqual([{ muscle: 'cardio', sets: 6 }]);
  });

  it('garde un muscle non résolu à part, jamais fondu dans « other »', () => {
    // `other` est un choix de l’utilisateur, l’inconnu est un trou de l’app.
    const { unscoped } = muscleBalance([rows(undefined, 2), rows('other', 1)]);
    expect(unscoped).toEqual([
      { muscle: undefined, sets: 2 },
      { muscle: 'other', sets: 1 },
    ]);
  });

  it('exclut les échauffements et compte dégressives et échecs', () => {
    const balance = muscleBalance([
      {
        primaryMuscle: 'chest',
        sets: [
          set({ setType: 'warmup' }),
          set({ setType: 'normal' }),
          set({ setType: 'dropset' }),
          set({ setType: 'failure' }),
        ],
      },
    ]);

    expect(countOf(balance.ranked, 'chest')).toBe(3);
    expect(balance.total).toBe(3);
  });

  it('additionne un exercice repris deux fois dans la même séance', () => {
    // L’unité est la série, pas la séance : contrairement à G1, deux passages
    // ne se fondent pas en un.
    const { ranked } = muscleBalance([rows('lats', 3), rows('lats', 2)]);
    expect(countOf(ranked, 'lats')).toBe(5);
  });

  it('totalise les deux listes, pour que rien ne s’évapore', () => {
    const { total } = muscleBalance([rows('chest', 4), rows('cardio', 6), rows(undefined, 1)]);
    expect(total).toBe(11);
  });
});

describe('toMuscleRows', () => {
  it('lit le muscle de l’instantané, pas celui de la bibliothèque', () => {
    // Les deux se contredisent EXPRÈS (leçon 08B) : deux valeurs concordantes
    // ne pourraient pas dire laquelle a été lue. Reclasser un exercice
    // aujourd’hui ne doit pas redistribuer six mois de séries passées.
    const sources: ExportSource[] = [
      {
        workout: workout({}),
        exercises: [
          {
            row: row({ exercisePrimaryMuscle: 'chest' }),
            exercise: exercise({ primaryMuscle: 'shoulders' }),
            sets: [set()],
          },
        ],
      },
    ];

    expect(toMuscleRows(sources)[0]!.primaryMuscle).toBe('chest');
  });

  it('retombe sur la bibliothèque quand la ligne n’a pas d’instantané', () => {
    // Les séances d’avant la migration v2 n’en portent aucun.
    const sources: ExportSource[] = [
      {
        workout: workout({}),
        exercises: [{ row: row({}), exercise: exercise({ primaryMuscle: 'glutes' }), sets: [set()] }],
      },
    ];

    expect(toMuscleRows(sources)[0]!.primaryMuscle).toBe('glutes');
  });

  it('ne nomme aucun muscle quand ni l’instantané ni la bibliothèque n’en portent', () => {
    const sources: ExportSource[] = [
      { workout: workout({}), exercises: [{ row: row({}), exercise: undefined, sets: [set()] }] },
    ];

    expect(toMuscleRows(sources)[0]!.primaryMuscle).toBeUndefined();
  });

  it('rend une ligne par exercice de séance, pas une par séance', () => {
    const sources: ExportSource[] = [
      {
        workout: workout({}),
        exercises: [
          { row: row({ exercisePrimaryMuscle: 'chest' }), exercise: undefined, sets: [set()] },
          { row: row({ exercisePrimaryMuscle: 'triceps' }), exercise: undefined, sets: [set()] },
        ],
      },
    ];

    expect(toMuscleRows(sources).map((entry) => entry.primaryMuscle)).toEqual(['chest', 'triceps']);
  });
});
