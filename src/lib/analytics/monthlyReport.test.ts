import { describe, expect, it } from 'vitest';
import {
  historicalExercise,
  historicalSet,
  historicalWorkout,
} from '@/test/historicalWorkout';
import { monthlyDelta, monthlyReports } from './monthlyReport';
import { startOfLocalMonth } from './months';

/** Samedi 22 août 2026, 14:00 — le « maintenant » de tous les cas. */
const now = new Date(2026, 7, 22, 14, 0, 0).getTime();

const at = (month: number, day: number, hours = 10): number =>
  new Date(2026, month - 1, day, hours, 0, 0, 0).getTime();

const month = (index: number): number => startOfLocalMonth(at(index, 1));

describe('monthlyReports', () => {
  it('gives nothing at all without a single session', () => {
    expect(monthlyReports([], now)).toEqual([]);
  });

  it('counts one month of sessions, warm-ups excluded', () => {
    const [report] = monthlyReports(
      [
        historicalWorkout({
          workoutId: 'w1',
          startedAt: at(8, 3),
          durationSeconds: 3_600,
          exercises: [
            historicalExercise({
              sets: [
                historicalSet({ setType: 'warmup', weight: 40, reps: 10 }),
                historicalSet({ weight: 100, reps: 5 }),
                historicalSet({ weight: 100, reps: 5 }),
              ],
            }),
          ],
        }),
      ],
      now,
    );

    expect(report?.monthStart).toBe(month(8));
    expect(report?.sessions).toBe(1);
    expect(report?.workingSets).toBe(2);
    expect(report?.totalReps).toBe(10);
    expect(report?.tonnage).toBe(1_000);
    expect(report?.durationSeconds).toBe(3_600);
    expect(report?.exerciseCount).toBe(1);
  });

  it('counts the days trained, not the sessions', () => {
    const twice = [
      historicalWorkout({ workoutId: 'w1', startedAt: at(8, 3, 8) }),
      historicalWorkout({ workoutId: 'w2', startedAt: at(8, 3, 19) }),
      historicalWorkout({ workoutId: 'w3', startedAt: at(8, 5) }),
    ];
    const [report] = monthlyReports(twice, now);

    expect(report?.sessions).toBe(3);
    expect(report?.activeDays).toBe(2);
  });

  it('runs from the current month back to the oldest, blank months included', () => {
    const reports = monthlyReports(
      [
        historicalWorkout({ workoutId: 'w1', startedAt: at(6, 4) }),
        historicalWorkout({ workoutId: 'w2', startedAt: at(8, 4) }),
      ],
      now,
    );

    expect(reports.map((report) => report.monthStart)).toEqual([month(8), month(7), month(6)]);
    expect(reports[1]?.sessions).toBe(0);
    expect(reports[1]?.tonnage).toBe(0);
  });

  it('ranks the month’s exercises by tonnage, heaviest first', () => {
    const [report] = monthlyReports(
      [
        historicalWorkout({
          workoutId: 'w1',
          startedAt: at(8, 3),
          exercises: [
            historicalExercise({
              exerciseId: 'squat',
              name: 'Squat',
              sets: [historicalSet({ weight: 120, reps: 5 })],
            }),
            historicalExercise({
              exerciseId: 'bench',
              name: 'Développé couché',
              sets: [historicalSet({ weight: 80, reps: 5 })],
            }),
          ],
        }),
        historicalWorkout({
          workoutId: 'w2',
          startedAt: at(8, 6),
          exercises: [
            historicalExercise({
              exerciseId: 'bench',
              name: 'Développé couché',
              sets: [historicalSet({ weight: 80, reps: 5 })],
            }),
          ],
        }),
      ],
      now,
    );

    // 2 × 80 × 5 = 800 kg pour le développé, 120 × 5 = 600 pour le squat : le
    // classement suit le tonnage du mois, pas la charge d'une série.
    expect(report?.exerciseCount).toBe(2);
    expect(report?.exercises.map((exercise) => exercise.exerciseId)).toEqual(['bench', 'squat']);
    expect(report?.exercises[0]).toMatchObject({
      name: 'Développé couché',
      tonnage: 800,
      workingSets: 2,
      sessions: 2,
    });
    expect(report?.exercises[1]).toMatchObject({ tonnage: 600, sessions: 1 });
  });

  it('files a session by its own offset, not the reader’s', () => {
    // 31 juillet 23:30 à Paris (UTC+2) : juillet, où que la lecture ait lieu.
    const reports = monthlyReports(
      [
        historicalWorkout({
          workoutId: 'w1',
          startedAt: Date.UTC(2026, 6, 31, 21, 30),
          timezoneOffsetMinutes: 120,
        }),
      ],
      now,
    );

    expect(reports.find((report) => report.sessions > 0)?.monthStart).toBe(month(7));
  });
});

describe('monthlyDelta', () => {
  const reports = () =>
    monthlyReports(
      [
        historicalWorkout({
          workoutId: 'w1',
          startedAt: at(7, 3),
          durationSeconds: 3_000,
          exercises: [historicalExercise({ sets: [historicalSet({ weight: 100, reps: 5 })] })],
        }),
        historicalWorkout({
          workoutId: 'w2',
          startedAt: at(8, 3),
          durationSeconds: 3_600,
          exercises: [
            historicalExercise({
              sets: [
                historicalSet({ weight: 100, reps: 5 }),
                historicalSet({ weight: 100, reps: 5 }),
              ],
            }),
          ],
        }),
      ],
      now,
    );

  it('has nothing to compare the oldest month against', () => {
    const list = reports();
    expect(monthlyDelta(list[list.length - 1]!, undefined)).toBeUndefined();
  });

  it('states the difference with the month before, in each unit', () => {
    const [august, july] = reports();

    expect(monthlyDelta(august!, july)).toEqual({
      sessions: 0,
      tonnage: 500,
      workingSets: 1,
      durationSeconds: 600,
    });
  });

  it('is negative when the month did less, and says so plainly', () => {
    const [august, july] = reports();

    expect(monthlyDelta(july!, august)).toEqual({
      sessions: 0,
      tonnage: -500,
      workingSets: -1,
      durationSeconds: -600,
    });
  });
});
