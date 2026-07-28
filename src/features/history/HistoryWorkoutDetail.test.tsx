import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WorkoutDetail } from '@/data/repositories/workouts';
import type { Exercise, Syncable, WorkoutExercise, WorkoutSet } from '@/data/types';
import { HistoryWorkoutDetail } from './HistoryWorkoutDetail';

/**
 * The screen reads the row's snapshot, never today's library. Every fixture here
 * therefore makes the two disagree on purpose: a test where they match cannot
 * tell which one was read.
 */

const startedAt = Date.UTC(2026, 6, 27, 16, 20, 0);

const stamps = (id: string): Syncable => ({
  id,
  createdAt: startedAt,
  updatedAt: startedAt,
  deletedAt: 0,
});

const library = (over: Partial<Exercise> = {}): Exercise => ({
  ...stamps('exercise-1'),
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
  ...stamps('row-1'),
  workoutId: 'workout-1',
  exerciseId: 'exercise-1',
  order: 0,
  supersetGroup: 0,
  restSeconds: 120,
  ...over,
});

const set = (over: Partial<WorkoutSet> = {}): WorkoutSet => ({
  ...stamps('set-1'),
  workoutExerciseId: 'row-1',
  exerciseId: 'exercise-1',
  workoutId: 'workout-1',
  order: 0,
  setType: 'normal',
  side: 'both',
  isCompleted: 1,
  performedAt: startedAt + 60_000,
  ...over,
});

function detail(
  line: Partial<{ row: WorkoutExercise; exercise: Exercise | undefined; sets: WorkoutSet[] }>,
): WorkoutDetail {
  return {
    workout: {
      ...stamps('workout-1'),
      routineId: '',
      name: 'Upper A',
      status: 'completed',
      startedAt,
      endedAt: startedAt + 3_600_000,
      durationSeconds: 3_600,
      startedTimezoneOffsetMinutes: 120,
    },
    exercises: [
      {
        row: line.row ?? row(),
        exercise: 'exercise' in line ? line.exercise : library(),
        sets: line.sets ?? [set({ weight: 80, reps: 10 })],
        previous: [],
      },
    ],
  };
}

describe('HistoryWorkoutDetail — le nom affiché', () => {
  it("montre le nom figé sur la séance, pas celui de la bibliothèque d'aujourd'hui", () => {
    render(
      <HistoryWorkoutDetail
        detail={detail({
          row: row({ exerciseName: 'Développé couché', exerciseMeasurementType: 'weight_reps' }),
          exercise: library({ name: 'Bench press' }),
        })}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Développé couché' })).toBeInTheDocument();
    expect(screen.queryByText('Bench press')).toBeNull();
  });

  it('retombe sur la bibliothèque pour une séance antérieure à l’instantané', () => {
    render(<HistoryWorkoutDetail detail={detail({ row: row() })} />);

    expect(screen.getByRole('heading', { name: 'Développé couché' })).toBeInTheDocument();
  });

  it("nomme le vide quand ni la ligne ni la bibliothèque ne l'ont", () => {
    render(<HistoryWorkoutDetail detail={detail({ row: row(), exercise: undefined })} />);

    expect(screen.getByRole('heading', { name: 'Exercice supprimé' })).toBeInTheDocument();
  });
});

describe('HistoryWorkoutDetail — les chiffres d’une série', () => {
  /**
   * The point of the milestone. `exerciseMeasurementType` decides which stored
   * figures are read at all: a session recorded as load × reps, whose exercise
   * is later re-typed as a plank, must keep reading as load × reps.
   */
  it("lit les valeurs selon le type de mesure figé, pas selon le type d'aujourd'hui", () => {
    render(
      <HistoryWorkoutDetail
        detail={detail({
          // Performed as a plank; the exercise has since been re-typed to load ×
          // reps, and the row still carries kilos from an even earlier life.
          row: row({ exerciseName: 'Gainage', exerciseMeasurementType: 'time_only' }),
          exercise: library({ measurementType: 'weight_reps' }),
          sets: [set({ weight: 80, reps: 10, durationSeconds: 45 })],
        })}
      />,
    );

    expect(screen.getByText('45 s · Normale')).toBeInTheDocument();
    expect(screen.queryByText(/80 kg/)).toBeNull();
  });

  it('compte le tonnage selon le rôle du poids figé', () => {
    render(
      <HistoryWorkoutDetail
        detail={detail({
          row: row({ exerciseName: 'Tractions assistées', exerciseMeasurementType: 'weight_reps' }),
          // Re-typed as assisted since: its kilos would stop counting as tonnage.
          exercise: library({ measurementType: 'assisted_weight_reps' }),
          sets: [set({ weight: 80, reps: 10 })],
        })}
      />,
    );

    expect(screen.getByText('800 kg')).toBeInTheDocument();
  });

  it('conserve toutes les figures stockées quand le type de mesure est perdu', () => {
    render(
      <HistoryWorkoutDetail
        detail={detail({
          row: row(),
          exercise: undefined,
          sets: [set({ weight: 80, reps: 10, distanceMeters: 500, durationSeconds: 45 })],
        })}
      />,
    );

    const reading = screen.getByText(/Normale/);
    expect(reading).toHaveTextContent('80 kg');
    expect(reading).toHaveTextContent('10 reps');
    expect(reading).toHaveTextContent('500 m');
    expect(reading).toHaveTextContent('45 s');
  });
});
