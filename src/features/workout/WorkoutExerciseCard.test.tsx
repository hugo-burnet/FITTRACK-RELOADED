import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

const announce = vi.hoisted(() => vi.fn<(cue: string, when?: number) => boolean>(() => true));

vi.mock('@/audio/announce', () => ({ announce }));
vi.mock('@/platform/nativeNotifications', () => ({
  nativeNotifications: { standDownRest: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('./restAlert', () => ({ signalRestFinishedOnCurrentPlatform: vi.fn() }));

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
  rest: React.ComponentProps<typeof WorkoutExerciseCard>['rest'] = null,
  hold: React.ComponentProps<typeof WorkoutExerciseCard>['hold'] = null,
) {
  render(
    <WorkoutExerciseCard
      line={currentLine}
      rest={rest}
      pace={null}
      hold={hold}
      sideStageOf={() => null}
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
  afterEach(() => {
    vi.useRealTimers();
  });

  it('décale l’en-tête quand l’ordre est verrouillé', () => {
    renderCard(false);

    expect(screen.queryByRole('button', { name: `Déplacer ${NAME}` })).toBeNull();
    expect(headerContent()).toHaveClass('pl-4');
  });

  it('laisse la poignée porter le décalage quand l’ordre est déverrouillé', () => {
    renderCard(true);

    expect(headerContent()).not.toHaveClass('pl-4');
  });

  it('porte le relevé du maintien et garde la coche active', () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const timedSet: WorkoutSet = {
      ...stamps,
      id: 'set-hold',
      workoutExerciseId: row.id,
      exerciseId: exercise.id,
      workoutId: row.workoutId,
      order: 0,
      setType: 'normal',
      side: 'both',
      isCompleted: 0,
      performedAt: 0,
    };
    const timedLine: WorkoutExerciseDetail = {
      row,
      exercise: { ...exercise, measurementType: 'time_only' },
      sets: [timedSet],
      previous: [],
    };

    renderCard(false, timedLine, new Map(), null, {
      setId: timedSet.id,
      rowId: row.id,
      startedAt: 100_000 - 3_000,
    });

    expect(screen.getByText('Maintien · 0:03')).toBeInTheDocument();
    // Aucune durée saisie, et pourtant la coche est active : c'est elle qui
    // arrête le chrono, donc l'exiger remplie l'enfermerait sans sortie.
    expect(screen.getByRole('button', { name: 'Valider la série 1' })).toBeEnabled();
  });

  // Le chrono fournit la durée et rien d'autre : lever la garde pour toute la
  // ligne laisserait valider un rameur sans sa distance.
  it('garde la coche fermée sur les colonnes que le chrono n’écrit pas', () => {
    vi.useFakeTimers();
    vi.setSystemTime(100_000);
    const rowerSet: WorkoutSet = {
      ...stamps,
      id: 'set-row',
      workoutExerciseId: row.id,
      exerciseId: exercise.id,
      workoutId: row.workoutId,
      order: 0,
      setType: 'normal',
      side: 'both',
      isCompleted: 0,
      performedAt: 0,
    };
    const rowerLine: WorkoutExerciseDetail = {
      row,
      exercise: { ...exercise, measurementType: 'distance_time' },
      sets: [rowerSet],
      previous: [],
    };

    renderCard(false, rowerLine, new Map(), null, {
      setId: rowerSet.id,
      rowId: row.id,
      startedAt: 100_000 - 3_000,
    });

    expect(screen.getByRole('button', { name: 'Valider la série 1' })).toBeDisabled();
  });

  it('nomme le chronomètre du bandeau selon ce qu’il ouvre', () => {
    renderCard(false);
    expect(screen.getByRole('button', { name: `Cadence de ${NAME}` })).toBeInTheDocument();

    render(<span />);
    const timedLine: WorkoutExerciseDetail = {
      row,
      exercise: { ...exercise, measurementType: 'time_only' },
      sets: [],
      previous: [],
    };
    renderCard(false, timedLine);
    expect(screen.getByRole('button', { name: `Chrono de ${NAME}` })).toBeInTheDocument();
  });

  it('transmet la suspension audio du repos au rail', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    announce.mockClear();
    const rest = {
      setId: 'set-resting',
      startedAt: 0,
      endsAt: 15_000,
      audioSuppressed: true,
      onDone: vi.fn(() => false),
    };

    renderCard(false, line, new Map(), rest);
    act(() => vi.advanceTimersByTime(15_000));

    expect(announce).not.toHaveBeenCalled();
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
      new Map([[completedSet.id, { types: ['max_weight'], entries: [maxWeight] }]]),
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

    expect(screen.getByText('3 records · Charge max, 1RM estimé et Tonnage séance')).toBeVisible();
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
    expect(notices.get(completedSet.id)?.types).toEqual(['max_weight', 'max_volume_session']);
    expect(notices.get(completedSet.id)?.entries).toEqual([setRecord, sessionRecord]);
  });
});
