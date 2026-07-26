import { describe, expect, it } from 'vitest';
import type { WorkoutDetail } from '@/data/repositories/workouts';
import {
  archivedDraftFromHistory,
  draftFromArchivedDetail,
  localDateValue,
  localTimeValue,
  newHistoryExerciseDraft,
  newHistorySetDraft,
  normalizeHistoryRpe,
  removeHistoryExerciseDraft,
  timestampFromHistoryInputs,
  timestampFromLocalInputs,
} from './historyDraft';

const timestamp = new Date(2026, 6, 25, 15, 5).getTime();

function detailFixture(): WorkoutDetail {
  return {
    workout: {
      id: 'workout-1',
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: 0,
      routineId: '',
      name: 'Poussée',
      notes: 'Séance lourde',
      status: 'completed',
      startedAt: timestamp,
      endedAt: timestamp + 3_600_000,
      durationSeconds: 3_600,
    },
    exercises: [
      {
        row: {
          id: 'row-1',
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: 0,
          workoutId: 'workout-1',
          exerciseId: 'exercise-1',
          order: 0,
          supersetGroup: 0,
          restSeconds: 120,
          notes: 'Banc 2',
        },
        exercise: {
          id: 'exercise-1',
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: 0,
          name: 'Développé couché',
          primaryMuscle: 'chest',
          secondaryMuscles: ['triceps'],
          equipment: 'barbell',
          measurementType: 'weight_reps',
          isCustom: 0,
          isUnilateral: 0,
        },
        sets: [
          {
            id: 'set-1',
            createdAt: timestamp,
            updatedAt: timestamp,
            deletedAt: 0,
            workoutExerciseId: 'row-1',
            exerciseId: 'exercise-1',
            workoutId: 'workout-1',
            order: 0,
            setType: 'normal',
            side: 'both',
            weight: 100,
            reps: 5,
            rpe: 8.5,
            isCompleted: 1,
            performedAt: timestamp + 60_000,
          },
        ],
        previous: [],
      },
    ],
  };
}

describe('local date inputs', () => {
  it('round-trips a local date and time', () => {
    expect(localDateValue(timestamp)).toBe('2026-07-25');
    expect(localTimeValue(timestamp)).toBe('15:05');
    expect(timestampFromLocalInputs('2026-07-25', '15:05')).toBe(timestamp);
  });

  it('rejects impossible dates and times', () => {
    expect(timestampFromLocalInputs('2026-02-30', '12:00')).toBeNull();
    expect(timestampFromLocalInputs('2026-07-25', '25:00')).toBeNull();
  });

  it('preserves seconds when date and minute stay unchanged', () => {
    const precise = new Date(2026, 6, 25, 15, 5, 47, 321).getTime();

    expect(timestampFromHistoryInputs(precise, '2026-07-25', '15:05')).toBe(
      precise,
    );
    expect(timestampFromHistoryInputs(precise, '2026-07-25', '15:06')).toBe(
      new Date(2026, 6, 25, 15, 6).getTime(),
    );
  });
});

it('creates an independent draft from an archived detail', () => {
  const detail = detailFixture();
  const draft = draftFromArchivedDetail(detail);
  draft.exercises[0]!.sets[0]!.weight = 80;

  expect(detail.exercises[0]!.sets[0]!.weight).toBe(100);
  expect(draft).toMatchObject({
    workoutId: 'workout-1',
    name: 'Poussée',
    notes: 'Séance lourde',
    startedAt: timestamp,
    durationSeconds: 3_600,
  });
  expect(draft.exercises[0]).toMatchObject({
    id: 'row-1',
    draftId: 'row-1',
    exerciseId: 'exercise-1',
    exerciseName: 'Développé couché',
    measurementType: 'weight_reps',
    notes: 'Banc 2',
  });
  expect(draft.exercises[0]!.sets[0]).toMatchObject({
    id: 'set-1',
    draftId: 'set-1',
    setType: 'normal',
    side: 'both',
    weight: 80,
  });
});

it('creates new exercise and set drafts with temporary ids', () => {
  const exercise = detailFixture().exercises[0]!.exercise!;
  const exerciseDraft = newHistoryExerciseDraft(exercise);
  const setDraft = newHistorySetDraft();

  expect(exerciseDraft).toMatchObject({
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    measurementType: exercise.measurementType,
    supersetGroup: 0,
    restSeconds: 120,
    sets: [],
  });
  expect(exerciseDraft.id).toBeUndefined();
  expect(exerciseDraft.draftId).toEqual(expect.any(String));
  expect(setDraft).toMatchObject({
    setType: 'normal',
    side: 'both',
    draftId: expect.any(String),
  });
  expect(setDraft.id).toBeUndefined();
});

it('keeps a typed RPE in the 6–10 domain by half points', () => {
  expect(normalizeHistoryRpe(undefined)).toBeUndefined();
  expect(normalizeHistoryRpe(5)).toBe(6);
  expect(normalizeHistoryRpe(8.7)).toBe(8.5);
  expect(normalizeHistoryRpe(10.5)).toBe(10);
});

it('strips interface-only fields before persistence', () => {
  const archived = archivedDraftFromHistory(
    draftFromArchivedDetail(detailFixture()),
  );

  expect(archived.exercises[0]).not.toHaveProperty('draftId');
  expect(archived.exercises[0]).not.toHaveProperty('exerciseName');
  expect(archived.exercises[0]).not.toHaveProperty('measurementType');
  expect(archived.exercises[0]!.sets[0]).not.toHaveProperty('draftId');
  expect(archived.exercises[0]).toMatchObject({
    id: 'row-1',
    exerciseId: 'exercise-1',
    sets: [
      {
        id: 'set-1',
        setType: 'normal',
        side: 'both',
        weight: 100,
        reps: 5,
        rpe: 8.5,
      },
    ],
  });
});

it('normalizes supersets after removing an exercise', () => {
  const template = draftFromArchivedDetail(detailFixture()).exercises[0]!;
  const exercises = [
    { ...template, draftId: 'a', supersetGroup: 1 },
    { ...template, draftId: 'b', supersetGroup: 1 },
    { ...template, draftId: 'c', supersetGroup: 2 },
    { ...template, draftId: 'd', supersetGroup: 2 },
  ];

  expect(
    removeHistoryExerciseDraft(exercises, 'b').map(
      ({ draftId, supersetGroup }) => ({ draftId, supersetGroup }),
    ),
  ).toEqual([
    { draftId: 'a', supersetGroup: 0 },
    { draftId: 'c', supersetGroup: 1 },
    { draftId: 'd', supersetGroup: 1 },
  ]);
});
