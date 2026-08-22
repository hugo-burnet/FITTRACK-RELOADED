import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import { monthLabel } from '@/i18n/labels';
import { addLocalMonths, startOfLocalMonth } from '@/lib/analytics/months';
import { resetDb } from '@/test/resetDb';
import { MonthlyReportScreen } from './MonthlyReportScreen';

const thisMonth = startOfLocalMonth(Date.now());
const lastMonth = addLocalMonths(thisMonth, -1);

/** Le 15 du mois à 18:00 : jamais au bord, donc jamais dépendant du fuseau. */
const midMonth = (monthStart: number): number =>
  new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth(), 15, 18).getTime();

async function archiveSession(
  startedAt: number,
  sets: { weight: number; reps: number }[],
  exerciseName = 'Développé couché',
): Promise<void> {
  const exercise = newEntity<Exercise>({
    name: exerciseName,
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isUnilateral: 0,
    isCustom: 1,
  });
  const workout = newEntity<Workout>({
    routineId: '',
    name: 'Upper A',
    status: 'completed',
    startedAt,
    endedAt: startedAt + 3_600_000,
    durationSeconds: 3_600,
    startedTimezoneOffsetMinutes: -new Date(startedAt).getTimezoneOffset(),
  });
  const row = newEntity<WorkoutExercise>({
    workoutId: workout.id,
    exerciseId: exercise.id,
    order: 0,
    supersetGroup: 0,
    restSeconds: 120,
  });

  await db.exercises.add(exercise);
  await db.workouts.add(workout);
  await db.workoutExercises.add(row);
  await db.workoutSets.bulkAdd(
    sets.map((set, index) =>
      newEntity<WorkoutSet>({
        workoutExerciseId: row.id,
        workoutId: workout.id,
        exerciseId: exercise.id,
        order: index,
        setType: 'normal',
        side: 'both',
        weight: set.weight,
        reps: set.reps,
        isCompleted: 1,
        performedAt: startedAt,
      }),
    ),
  );
}

const renderScreen = () =>
  render(
    <MemoryRouter>
      <MonthlyReportScreen />
    </MemoryRouter>,
  );

describe('MonthlyReportScreen', () => {
  beforeEach(resetDb);

  it('says the report is waiting for a first session rather than showing zeros', async () => {
    renderScreen();

    expect(
      await screen.findByText(
        'Aucune séance enregistrée : le premier rapport arrivera avec la première séance.',
      ),
    ).toBeVisible();
  });

  it('opens on the current month and reads its six figures', async () => {
    await archiveSession(midMonth(thisMonth), [
      { weight: 100, reps: 5 },
      { weight: 100, reps: 5 },
    ]);

    renderScreen();

    expect(
      await screen.findByRole('button', { name: new RegExp(monthLabel(thisMonth), 'i') }),
    ).toBeVisible();
    const sets = await screen.findByText('Séries de travail');
    expect(within(sets.closest('div')!).getByText('2')).toBeVisible();
    expect(screen.getByText('1 000 kg')).toBeVisible();
  });

  it('compares the month with the one before it', async () => {
    await archiveSession(midMonth(lastMonth), [{ weight: 100, reps: 5 }]);
    await archiveSession(midMonth(thisMonth), [
      { weight: 100, reps: 5 },
      { weight: 100, reps: 5 },
    ]);

    renderScreen();

    expect(
      await screen.findByText(`Comparé à ${monthLabel(lastMonth)}.`),
    ).toBeVisible();
    expect(screen.getByText('+500 kg')).toBeVisible();
  });

  it('lets an older month be picked, and says a blank month is blank', async () => {
    await archiveSession(midMonth(addLocalMonths(thisMonth, -2)), [{ weight: 100, reps: 5 }]);

    renderScreen();

    await userEvent.click(
      await screen.findByRole('button', { name: new RegExp(monthLabel(thisMonth), 'i') }),
    );
    await userEvent.click(screen.getByRole('radio', { name: monthLabel(lastMonth) }));

    await waitFor(() => expect(screen.getByText('Aucune séance ce mois-ci.')).toBeVisible());
  });

  it('names the exercise that weighed most in the month', async () => {
    await archiveSession(midMonth(thisMonth), [{ weight: 60, reps: 5 }], 'Rowing');
    await archiveSession(midMonth(thisMonth), [{ weight: 140, reps: 5 }], 'Squat');

    renderScreen();

    const exercises = await screen.findByText('Ce qui a le plus pesé');
    const section = exercises.closest('section');
    const rows = within(section!).getAllByText(/Squat|Rowing/);
    expect(rows[0]).toHaveTextContent('Squat');
  });
});
