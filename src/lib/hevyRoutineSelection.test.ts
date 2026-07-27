import { describe, expect, it } from 'vitest';
import type { HevyParsedWorkout } from './hevyCsv';
import { selectHevyRoutineSources } from './hevyRoutineSelection';

function workout(
  title: string,
  startedAt: number,
  exerciseTitles: readonly string[],
): HevyParsedWorkout {
  return {
    title,
    startedAt,
    endedAt: startedAt + 60_000,
    durationSeconds: 60,
    importKey: `hevy:${startedAt}`,
    exercises: exerciseTitles.map((sourceTitle, order) => ({
      sourceTitle,
      order,
      supersetGroup: 0,
      sets: [
        {
          sourceLine: order + 2,
          order: 0,
          setType: 'normal',
          reps: 8,
        },
      ],
    })),
  };
}

describe('selectHevyRoutineSources', () => {
  it('groups titles without regard to case or repeated spaces', () => {
    const result = selectHevyRoutineSources([
      workout('UPPER A', 100, ['bench']),
      workout(' upper   a ', 200, ['bench', 'row']),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.workout.startedAt).toBe(200);
  });

  it('chooses the most complete of the five latest workouts', () => {
    const result = selectHevyRoutineSources([
      workout('Upper A', 100, ['old', 'exercise', 'list', 'ignored']),
      workout('Upper A', 200, ['bench', 'row']),
      workout('Upper A', 300, ['bench', 'row', 'curl']),
      workout('Upper A', 400, ['bench']),
      workout('Upper A', 500, ['bench', 'row']),
      workout('Upper A', 600, ['bench', 'row']),
    ]);

    expect(result[0]?.workout.startedAt).toBe(300);
  });

  it('breaks equal exercise counts with the newest workout', () => {
    const result = selectHevyRoutineSources([
      workout('Upper B', 100, ['incline', 'row']),
      workout('Upper B', 200, ['incline', 'pulldown']),
    ]);

    expect(result[0]?.workout.startedAt).toBe(200);
    expect(result[0]?.name).toBe('Upper B');
  });

  it('counts distinct exercise sources instead of repeated rows', () => {
    const duplicated = workout('Lower A', 100, ['press', 'press']);
    const varied = workout('Lower A', 200, ['press', 'curl']);

    expect(
      selectHevyRoutineSources([duplicated, varied])[0]?.workout
        .startedAt,
    ).toBe(200);
  });

  it('orders selected routines chronologically', () => {
    const result = selectHevyRoutineSources([
      workout('Upper A', 300, ['bench']),
      workout('Lower A', 100, ['squat']),
    ]);

    expect(result.map((source) => source.name)).toEqual([
      'Lower A',
      'Upper A',
    ]);
  });
});
