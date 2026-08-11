import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { Exercise, PersonalRecord, Workout, WorkoutExercise, WorkoutSet } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { ExerciseDetailScreen } from './ExerciseDetailScreen';

const exercise: Exercise = {
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
};

const workout: Workout = {
  ...newEntity<Workout>({
    routineId: '',
    name: 'Haut du corps',
    status: 'completed',
    startedAt: Date.UTC(2026, 6, 1, 18),
    endedAt: Date.UTC(2026, 6, 1, 19),
    durationSeconds: 3_600,
  }),
  id: 'workout',
};

const row: WorkoutExercise = {
  ...newEntity<WorkoutExercise>({
    workoutId: workout.id,
    exerciseId: exercise.id,
    order: 0,
    supersetGroup: 0,
    restSeconds: 120,
    exerciseName: exercise.name,
    exerciseMeasurementType: exercise.measurementType,
  }),
  id: 'row',
};

const rawSet: WorkoutSet = {
  ...newEntity<WorkoutSet>({
    workoutExerciseId: row.id,
    exerciseId: exercise.id,
    workoutId: workout.id,
    order: 0,
    setType: 'normal',
    side: 'both',
    weight: 100,
    reps: 5,
    isCompleted: 1,
    performedAt: workout.startedAt,
  }),
  id: 'raw-set',
};

const record = (
  id: string,
  type: PersonalRecord['type'],
  value: number,
  context: Partial<PersonalRecord> = {},
): PersonalRecord => ({
  ...newEntity<PersonalRecord>({
    exerciseId: exercise.id,
    type,
    value,
    achievedAt: workout.startedAt,
    workoutId: workout.id,
    ...context,
  }),
  id,
});

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="URL courante">{`${location.pathname}${location.search}`}</output>;
}

const renderScreen = () =>
  render(
    <MemoryRouter initialEntries={['/exercises/bench']}>
      <LocationProbe />
      <Routes>
        <Route path="/exercises/:id" element={<ExerciseDetailScreen />} />
        <Route path="/analytics/records" element={<p>Rail filtré</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe('ExerciseDetailScreen persisted records', () => {
  beforeEach(async () => {
    await resetDb();
    await db.transaction(
      'rw',
      db.exercises,
      db.workouts,
      db.workoutExercises,
      db.workoutSets,
      db.personalRecords,
      async () => {
        await db.exercises.add(exercise);
        await db.workouts.add(workout);
        await db.workoutExercises.add(row);
        await db.workoutSets.add(rawSet);
        await db.personalRecords.bulkAdd([
          record('persisted-weight', 'max_weight', 122.5, { weight: 122.5, reps: 3 }),
          record('persisted-1rm', 'best_1rm', 137.34, {
            weight: 120,
            reps: 5,
            formula: 'epley',
            workoutSetId: rawSet.id,
          }),
        ]);
      },
    );
  });

  it('reads the persisted projection even when raw sets contain different best values', async () => {
    renderScreen();

    const section = (await screen.findByText('Records')).closest('section');
    expect(section).not.toBeNull();
    expect(within(section!).getByText('Charge max')).toBeVisible();
    expect(within(section!).getByText('122,5 kg')).toBeVisible();
    expect(within(section!).getByText('1RM estimé')).toBeVisible();
    /**
     * Une décimale, pas deux, et c'est voulu côté code : `recordNumber` arrondit
     * au centième par défaut, mais `recordValue` passe explicitement `10` pour
     * `best_1rm`. Un 1RM est une estimation — deux décimales y seraient une
     * fausse précision. Le test attendait le format par défaut et échouait donc
     * sur `master` avant toute fusion ; c'est lui qui était périmé, pas l'app.
     */
    expect(within(section!).getByText('137,3 kg')).toBeVisible();
    expect(within(section!).getByText('120 kg × 5 · Epley')).toBeVisible();
    expect(within(section!).queryByText('100 kg × 5')).toBeNull();
  });

  it('opens the dedicated record rail filtered to this exercise', async () => {
    const user = userEvent.setup();
    renderScreen();

    await user.click(await screen.findByRole('button', { name: 'Voir tous les records' }));
    await waitFor(() =>
      expect(screen.getByLabelText('URL courante')).toHaveTextContent(
        '/analytics/records?exerciseId=bench',
      ),
    );
  });
});
