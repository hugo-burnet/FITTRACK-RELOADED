import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import { deleteExercise } from '@/data/repositories/exercises';
import type { Exercise, PersonalRecord, Workout, WorkoutExercise } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { HistoryRecords } from './HistoryRecords';

const SLOW = { timeout: 5_000 };
const at = Date.UTC(2026, 10, 16, 18);

async function seed() {
  const exercise: Exercise = {
    ...newEntity<Exercise>({
      name: 'Développé couché',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isCustom: 1,
      isUnilateral: 0,
    }),
    id: 'ex',
  };
  await db.exercises.add(exercise);
  await db.workouts.add({
    ...newEntity<Workout>({
      routineId: '',
      name: 'Haut',
      status: 'completed',
      startedAt: at,
      endedAt: at + 3_600_000,
      durationSeconds: 3_600,
    }),
    id: 'w1',
  });
  await db.workoutExercises.add({
    ...newEntity<WorkoutExercise>({
      workoutId: 'w1',
      exerciseId: 'ex',
      order: 0,
      supersetGroup: 0,
      restSeconds: 120,
      exerciseName: exercise.name,
      exerciseMeasurementType: 'weight_reps',
    }),
    id: 'row',
  });
  await db.personalRecords.add({
    ...newEntity<PersonalRecord>({
      exerciseId: 'ex',
      type: 'max_weight',
      value: 100,
      weight: 100,
      reps: 5,
      achievedAt: at,
      workoutId: 'w1',
    }),
    id: 'rec',
  });
}

const renderRecords = () =>
  render(
    <MemoryRouter>
      <HistoryRecords workoutId="w1" />
    </MemoryRouter>,
  );

describe('HistoryRecords — le lien vers la fiche', () => {
  beforeEach(async () => {
    await resetDb();
    await seed();
  });

  it('ouvre la fiche d’un exercice vivant', async () => {
    renderRecords();

    expect(await screen.findByRole('button', { name: /Charge max/ }, SLOW)).toBeInTheDocument();
  });

  it('n’ouvre pas la fiche d’un exercice supprimé : la ligne reste lisible, sans lien', async () => {
    await deleteExercise('ex');
    renderRecords();

    await screen.findByText(/Charge max/, undefined, SLOW);
    await waitFor(() => expect(screen.queryByRole('button', { name: /Charge max/ })).toBeNull());
  });
});
