import type { ReactElement } from 'react';
import { fireEvent, render as renderBare, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { WorkoutDetail } from '@/data/repositories/workouts';
import type { Exercise, MuscleGroup, Syncable, WorkoutExercise, WorkoutSet } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { HistoryWorkoutDetail } from './HistoryWorkoutDetail';

/**
 * Le corps dessiné ouvre une feuille du catalogue, qui navigue vers une fiche
 * d'exercice : le détail ne se rend plus hors d'un routeur.
 */
function render(ui: ReactElement) {
  return renderBare(ui, { wrapper: MemoryRouter });
}

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
  line: Partial<{
    row: WorkoutExercise;
    exercise: Exercise | undefined;
    identity: WorkoutDetail['exercises'][number]['identity'];
    sets: WorkoutSet[];
  }>,
  bodyWeightKg?: number,
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
        ...(line.identity === undefined ? {} : { identity: line.identity }),
        sets: line.sets ?? [set({ weight: 80, reps: 10 })],
        previous: [],
      },
    ],
    ...(bodyWeightKg === undefined ? {} : { bodyWeightKg }),
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

  it('compte le poids du corps effectif dans le tonnage archivé', () => {
    render(
      <HistoryWorkoutDetail
        detail={detail(
          {
            row: row({
              exerciseName: 'Pompes',
              exerciseMeasurementType: 'reps_only',
              exerciseBodyweightLoadFactor: 0.7,
            }),
            exercise: library({
              name: 'Pompes renommées',
              measurementType: 'reps_only',
              bodyweightLoadFactor: 0.2,
            }),
            sets: [set({ reps: 8 })],
          },
          80,
        )}
      />,
    );

    expect(screen.getByText('448 kg')).toBeInTheDocument();
  });

  it("garde le tonnage d'une ancienne ligne dont l'exercice est supprimé", () => {
    render(
      <HistoryWorkoutDetail
        detail={detail(
          {
            row: row(),
            exercise: undefined,
            identity: {
              name: 'Pompes supprimées',
              measurementType: 'reps_only',
              bodyweightLoadFactor: 0.7,
            },
            sets: [set({ reps: 8 })],
          },
          80,
        )}
      />,
    );

    expect(screen.getByText('448 kg')).toBeInTheDocument();
  });

  /**
   * The tile used to read the stored seconds and nothing else: an hour and a
   * half of squats totalled zero, and a stray duration left by an import or a
   * re-typed exercise totalled minutes nobody could locate on the screen.
   */
  it('compte le temps de travail des séries en répétitions à la cadence de l’exercice', () => {
    render(
      <HistoryWorkoutDetail
        detail={detail({
          row: row({ exerciseName: 'Squat', exerciseMeasurementType: 'weight_reps' }),
          sets: [
            set({ id: 'set-1', order: 0, weight: 100, reps: 10 }),
            set({ id: 'set-2', order: 1, weight: 100, reps: 8 }),
          ],
        })}
      />,
    );

    // 18 répétitions à 3 s, la cadence par défaut.
    expect(screen.getByText('54 s')).toBeInTheDocument();
  });

  it('garde la durée réelle d’un exercice chronométré', () => {
    render(
      <HistoryWorkoutDetail
        detail={detail({
          row: row({ exerciseName: 'Gainage', exerciseMeasurementType: 'time_only' }),
          sets: [
            set({ id: 'set-1', order: 0, durationSeconds: 60 }),
            set({ id: 'set-2', order: 1, durationSeconds: 45 }),
          ],
        })}
      />,
    );

    expect(screen.getByText('1:45 min')).toBeInTheDocument();
  });

  it('ne compte pas les secondes qu’une série en répétitions traîne encore', () => {
    render(
      <HistoryWorkoutDetail
        detail={detail({
          row: row({ exerciseName: 'Squat', exerciseMeasurementType: 'weight_reps' }),
          // 45 s héritées d'un import ou d'un exercice re-typé : la ligne de
          // série ne les montre pas, le total ne les compte pas non plus.
          sets: [set({ weight: 100, reps: 10, durationSeconds: 45 })],
        })}
      />,
    );

    expect(screen.getByText('30 s')).toBeInTheDocument();
    expect(screen.queryByText('1:15 min')).toBeNull();
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

describe('HistoryWorkoutDetail — le corps travaillé', () => {
  const catalogue = (id: string, name: string, primaryMuscle: MuscleGroup): Exercise => ({
    ...newEntity<Exercise>({
      name,
      primaryMuscle,
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isCustom: 0,
      isUnilateral: 0,
    }),
    id,
  });

  beforeEach(async () => {
    await resetDb();
    await db.exercises.bulkAdd([
      catalogue('bench', 'Développé couché', 'chest'),
      catalogue('fly', 'Écarté à la poulie', 'chest'),
      catalogue('squat', 'Squat', 'quads'),
    ]);
  });

  /** Le path du muscle, une fois la géométrie injectée. */
  async function muscle(container: HTMLElement, id: string): Promise<Element> {
    return await waitFor(() => {
      const path = container.querySelector(`path[data-muscle="${id}"]`);
      if (path === null) throw new Error(`aucun path pour ${id}`);
      return path;
    });
  }

  it('ouvre les exercices du muscle touché, comme sur l’accueil', async () => {
    const { container } = render(<HistoryWorkoutDetail detail={detail({ row: row() })} />);

    fireEvent.click(await muscle(container, 'pectoralis_major'));

    expect(await screen.findByText('Pectoraux')).toBeInTheDocument();
    expect(await screen.findByText('Écarté à la poulie')).toBeInTheDocument();
  });

  it('répond aussi pour un muscle que la séance n’a pas travaillé', async () => {
    // Relire une séance, c'est d'abord voir ce qu'elle a laissé de côté : le
    // muscle éteint est justement celui qu'on touche pour la prochaine fois.
    const { container } = render(<HistoryWorkoutDetail detail={detail({ row: row() })} />);

    fireEvent.click(await muscle(container, 'quadriceps'));

    expect(await screen.findByText('Quadriceps')).toBeInTheDocument();
    expect(await screen.findByText('Squat')).toBeInTheDocument();
  });
});
