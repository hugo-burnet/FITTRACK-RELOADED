import { describe, expect, it } from 'vitest';
import {
  historicalExercise,
  historicalSet,
  historicalWorkout,
} from '@/test/historicalWorkout';
import { metricSeries } from './metrics';
import { toAnalyticsSessions } from './sessions';

describe('toAnalyticsSessions', () => {
  it('carries the body weight and historical load factor needed for tonnage', () => {
    const sessions = toAnalyticsSessions([
      historicalWorkout({
        bodyWeightKg: 80,
        exercises: [
          historicalExercise({
            measurementType: 'reps_only',
            bodyweightLoadFactor: 0.7,
            sets: [historicalSet({ weight: undefined, reps: 8 })],
          }),
        ],
      }),
    ]);

    expect(sessions[0]).toMatchObject({
      bodyWeightKg: 80,
      sets: [{ bodyweightLoadFactor: 0.7 }],
    });
    expect(metricSeries('sessionTonnage', sessions)[0]?.value).toBe(448);
  });

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

  it('keeps each occurrence load factor when an exercise appears twice', () => {
    const sessions = toAnalyticsSessions([
      historicalWorkout({
        bodyWeightKg: 80,
        exercises: [
          historicalExercise({
            measurementType: 'reps_only',
            bodyweightLoadFactor: 0.7,
            sets: [historicalSet({ weight: undefined, reps: 8 })],
          }),
          historicalExercise({
            measurementType: 'reps_only',
            bodyweightLoadFactor: 1,
            sets: [historicalSet({ weight: undefined, reps: 8 })],
          }),
        ],
      }),
    ]);

    expect(metricSeries('sessionTonnage', sessions)[0]?.value).toBe(1_088);
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
