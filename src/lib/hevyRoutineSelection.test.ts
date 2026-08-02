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

/** La même séance, mais issue d'une routine — comme l'écrit l'export FitTrack. */
function fromRoutine(
  routineName: string,
  title: string,
  startedAt: number,
  exerciseTitles: readonly string[],
): HevyParsedWorkout {
  return { ...workout(title, startedAt, exerciseTitles), routineName };
}

describe('selectHevyRoutineSources', () => {
  it('groupe par routine déclarée plutôt que par titre de séance', () => {
    const result = selectHevyRoutineSources([
      fromRoutine('LOWER A', 'LOWER A', 100, ['squat']),
      // Séance renommée à la volée : elle appartient toujours à sa routine.
      fromRoutine('LOWER A', 'LOWER A (dos en vrac)', 200, ['squat', 'presse']),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('LOWER A');
    expect(result[0]?.lastPerformedAt).toBe(200);
  });

  it('laisse les séances libres en dehors des routines reconstruites', () => {
    const result = selectHevyRoutineSources([
      fromRoutine('LOWER A', 'LOWER A', 100, ['squat']),
      // Pas de routine derrière : elle ne doit pas en devenir une.
      workout('Séance libre du dimanche', 200, ['vélo']),
    ]);

    expect(result.map((source) => source.name)).toEqual(['LOWER A']);
  });

  it('retombe sur le titre quand le fichier ne déclare aucune routine', () => {
    const result = selectHevyRoutineSources([
      workout('UPPER A', 100, ['bench']),
      workout('UPPER A', 300, ['bench', 'row']),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('UPPER A');
    expect(result[0]?.lastPerformedAt).toBe(300);
  });

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
