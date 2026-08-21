import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { WorkoutExerciseDetail } from '@/data/repositories/workouts';
import type { Exercise, PersonalRecord, WorkoutExercise, WorkoutSet } from '@/data/types';
import type { RecordTimelineEntry } from '@/data/repositories/personalRecords';
import type { ItemState } from '@/ui';
import {
  WorkoutExerciseCard,
  type WorkoutRecordNotice,
  workoutRecordNotices,
} from './WorkoutExerciseCard';
import { INITIAL_WORKOUT_FOLD_COMMAND } from './workoutFold';

const stamps = { createdAt: 1, updatedAt: 1, deletedAt: 0 };

const NAME = 'Développé couché';

const exercise: Exercise = {
  ...stamps,
  id: 'exercise-bench',
  name: NAME,
  primaryMuscle: 'chest',
  secondaryMuscles: [],
  equipment: 'barbell',
  measurementType: 'weight_reps',
  isCustom: 0,
  isUnilateral: 0,
};

const row: WorkoutExercise = {
  ...stamps,
  id: 'workout-exercise-1',
  workoutId: 'workout-1',
  exerciseId: exercise.id,
  order: 0,
  supersetGroup: 0,
  restSeconds: 90,
};

const line: WorkoutExerciseDetail = { row, exercise, sets: [], previous: [] };

const state: ItemState = {
  dragging: false,
  handleProps: {
    onPointerDown: vi.fn(),
    onPointerMove: vi.fn(),
    onPointerUp: vi.fn(),
    onPointerCancel: vi.fn(),
    onKeyDown: vi.fn(),
    style: {},
  },
};

function renderCard(
  reorderEnabled: boolean,
  currentLine = line,
  records: Map<string, WorkoutRecordNotice> = new Map(),
) {
  render(
    <WorkoutExerciseCard
      line={currentLine}
      rest={null}
      pace={null}
      effort={null}
      records={records}
      state={state}
      reorderEnabled={reorderEnabled}
      foldCommand={INITIAL_WORKOUT_FOLD_COMMAND}
      onPace={vi.fn()}
      onMenu={vi.fn()}
      onSetMenu={vi.fn()}
      onWrite={vi.fn()}
      onComplete={vi.fn()}
      onUncomplete={vi.fn()}
      onDeleteSet={vi.fn()}
      onRestoreSet={vi.fn()}
      onAddSet={vi.fn()}
    />,
  );
}

/** The fold button carrying the title and its subtitle — what the handle used to inset. */
const headerContent = (): HTMLElement => screen.getByRole('button', { expanded: true });

describe('WorkoutExerciseCard', () => {
  it('décale l’en-tête quand l’ordre est verrouillé', () => {
    renderCard(false);

    expect(screen.queryByRole('button', { name: `Déplacer ${NAME}` })).toBeNull();
    expect(headerContent()).toHaveClass('pl-4');
  });

  it('laisse la poignée porter le décalage quand l’ordre est déverrouillé', () => {
    renderCard(true);

    expect(headerContent()).not.toHaveClass('pl-4');
  });

  const completedSet: WorkoutSet = {
    ...stamps,
    id: 'set-record',
    workoutExerciseId: row.id,
    exerciseId: exercise.id,
    workoutId: row.workoutId,
    order: 0,
    setType: 'normal',
    side: 'both',
    weight: 105,
    reps: 5,
    isCompleted: 1,
    performedAt: 2,
  };

  const draftSet: WorkoutSet = {
    ...completedSet,
    id: 'set-draft',
    order: 1,
    weight: undefined,
    reps: undefined,
    isCompleted: 0,
    performedAt: 0,
  };

  function entry(
    type: PersonalRecord['type'],
    value: number,
    previousValue: number,
  ): RecordTimelineEntry {
    return {
      record: {
        ...stamps,
        id: `record-${type}`,
        exerciseId: exercise.id,
        type,
        value,
        achievedAt: 2,
        workoutId: row.workoutId,
        workoutSetId: completedSet.id,
        weight: completedSet.weight,
        reps: completedSet.reps,
      },
      exerciseName: NAME,
      workoutStatus: 'active',
      previousValue,
      triggerWorkoutSetId: completedSet.id,
    };
  }

  it('reads one persisted record with its value and gain under the source set', () => {
    const maxWeight = entry('max_weight', 105, 100);
    renderCard(
      false,
      { ...line, sets: [completedSet, draftSet] },
      new Map([
        [completedSet.id, { types: ['max_weight'], entries: [maxWeight] }],
      ]),
    );

    expect(screen.getByText('Record · Charge max · 105 kg · +5 kg')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Record · Charge max · 105 kg · +5 kg');
  });

  it('summarises every persisted category won by the same set', () => {
    const maxWeight = entry('max_weight', 105, 100);
    const oneRepMax = entry('best_1rm', 122.5, 116.7);
    const sessionTonnage = entry('max_volume_session', 1_025, 900);
    renderCard(
      false,
      { ...line, sets: [completedSet, draftSet] },
      new Map([
        [
          completedSet.id,
          {
            types: ['max_weight', 'best_1rm', 'max_volume_session'],
            entries: [maxWeight, oneRepMax, sessionTonnage],
          },
        ],
      ]),
    );

    expect(
      screen.getByText('3 records · Charge max, 1RM estimé et Tonnage séance'),
    ).toBeVisible();
  });

  it('groups every improvement by its trigger and excludes initial marks', () => {
    const initial = { ...entry('max_weight', 100, 0), previousValue: undefined };
    const setRecord = {
      ...entry('max_weight', 105, 100),
      triggerWorkoutSetId: undefined,
    };
    const sessionRecord = {
      ...entry('max_volume_session', 1_025, 900),
      record: {
        ...entry('max_volume_session', 1_025, 900).record,
        workoutSetId: undefined,
      },
    };

    const notices = workoutRecordNotices([initial, setRecord, sessionRecord]);

    expect([...notices.keys()]).toEqual([completedSet.id]);
    expect(notices.get(completedSet.id)?.types).toEqual([
      'max_weight',
      'max_volume_session',
    ]);
    expect(notices.get(completedSet.id)?.entries).toEqual([setRecord, sessionRecord]);
  });
});
