import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCustomExercise } from '@/data/repositories/exercises';
import { addExercisesToRoutine, createRoutine } from '@/data/repositories/routines';
import { getWorkoutDetail, startWorkoutFromRoutine } from '@/data/repositories/workouts';
import type { RecordTimelineEntry } from '@/data/repositories/personalRecords';
import { resetDb } from '@/test/resetDb';

const { announceMock, listRecordsForWorkoutMock, primeAnnouncerMock } = vi.hoisted(() => ({
  announceMock: vi.fn(),
  listRecordsForWorkoutMock: vi.fn(),
  primeAnnouncerMock: vi.fn(),
}));

vi.mock('@/audio/announce', () => ({
  announce: announceMock,
  primeAnnouncer: primeAnnouncerMock,
}));

vi.mock('@/data/repositories/personalRecords', async () => {
  const actual = await vi.importActual<typeof import('@/data/repositories/personalRecords')>(
    '@/data/repositories/personalRecords',
  );
  return { ...actual, listRecordsForWorkout: listRecordsForWorkoutMock };
});

import { WorkoutScreen } from './WorkoutScreen';

describe('WorkoutScreen — reprise des records', () => {
  beforeEach(async () => {
    announceMock.mockReset();
    primeAnnouncerMock.mockReset();
    listRecordsForWorkoutMock.mockReset();
    await resetDb();
  });

  it("prend les records déjà présents comme référence sans les réannoncer", async () => {
    const exercise = await createCustomExercise({
      name: 'Développé couché',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const routine = await createRoutine('Poussée');
    await addExercisesToRoutine(routine.id, [exercise.id]);
    const workout = await startWorkoutFromRoutine(routine.id);
    const set = (await getWorkoutDetail(workout.id))?.exercises[0]?.sets[0];
    if (set === undefined) throw new Error('série absente');

    let resolveRecords!: (entries: RecordTimelineEntry[]) => void;
    listRecordsForWorkoutMock.mockImplementation(
      () => new Promise<RecordTimelineEntry[]>((resolve) => (resolveRecords = resolve)),
    );

    render(
      <MemoryRouter initialEntries={['/workout']}>
        <Routes>
          <Route path="/workout" element={<WorkoutScreen />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByText('Développé couché');
    await waitFor(() => expect(listRecordsForWorkoutMock).toHaveBeenCalledWith(workout.id));

    await act(async () => {
      resolveRecords([
        {
          record: {
            id: 'record-current',
            createdAt: 1,
            updatedAt: 1,
            deletedAt: 0,
            exerciseId: exercise.id,
            type: 'max_weight',
            value: 80,
            achievedAt: 1,
            workoutId: workout.id,
            workoutSetId: set.id,
          },
          exerciseName: exercise.name,
          workoutStatus: 'active',
          previousValue: 70,
          triggerWorkoutSetId: set.id,
        },
      ]);
    });

    await waitFor(() => expect(screen.getByText(/Charge max/)).toBeVisible());
    expect(announceMock).not.toHaveBeenCalledWith('record-beaten');
  });
});
