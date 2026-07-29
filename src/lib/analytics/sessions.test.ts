import { describe, expect, it } from 'vitest';
import {
  historicalExercise,
  historicalSet,
  historicalWorkout,
} from '@/test/historicalWorkout';
import { toAnalyticsSessions } from './sessions';

describe('toAnalyticsSessions', () => {
  it('dates a session by its start, not its first set', () => {
    const sources = [
      historicalWorkout({
        startedAt: 5_000,
        exercises: [
          historicalExercise({
            measurementType: 'time_only',
            sets: [historicalSet({ durationSeconds: 45 })],
          }),
        ],
      }),
    ];

    const [session] = toAnalyticsSessions(sources);

    expect(session!.startedAt).toBe(5_000);
    expect(session!.measurementType).toBe('time_only');
  });

  it('groups an exercise performed twice into one session', () => {
    const sources = [
      historicalWorkout({
        exercises: [
          historicalExercise({
            sets: [historicalSet({ weight: 80 })],
          }),
          historicalExercise({
            sets: [historicalSet({ weight: 100 })],
          }),
        ],
      }),
    ];

    const sessions = toAnalyticsSessions(sources);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.sets).toHaveLength(2);
  });

  it('keeps chronological order and a session without sets', () => {
    const sources = [
      historicalWorkout({
        workoutId: 'a',
        startedAt: 1,
        exercises: [],
      }),
      historicalWorkout({
        workoutId: 'b',
        startedAt: 2,
        exercises: [
          historicalExercise({
            sets: [historicalSet({ weight: 60 })],
          }),
        ],
      }),
    ];

    expect(
      toAnalyticsSessions(sources).map(
        (session) => session.workoutId,
      ),
    ).toEqual(['a', 'b']);
  });
});
