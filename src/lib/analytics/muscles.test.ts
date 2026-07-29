import { describe, expect, it } from 'vitest';
import {
  MUSCLE_GROUPS,
  type MuscleGroup,
} from '@/data/types';
import {
  historicalExercise,
  historicalSet,
  historicalWorkout,
} from '@/test/historicalWorkout';
import {
  MUSCLE_SCOPE,
  muscleBalance,
  toMuscleRows,
  type MuscleRow,
} from './muscles';

/** N working sets for one muscle in one session row. */
const rows = (
  muscle: MuscleGroup | undefined,
  count: number,
): MuscleRow => ({
  ...(muscle === undefined ? {} : { primaryMuscle: muscle }),
  sets: Array.from({ length: count }, () => historicalSet()),
});

const countOf = (
  list: readonly {
    muscle: MuscleGroup | undefined;
    sets: number;
  }[],
  muscle: MuscleGroup,
) => list.find((entry) => entry.muscle === muscle)?.sets;

describe('MUSCLE_SCOPE', () => {
  it('classifies every muscle group', () => {
    for (const muscle of MUSCLE_GROUPS) {
      expect(MUSCLE_SCOPE[muscle]).toMatch(
        /^(region|unscoped)$/,
      );
    }
  });

  it('excludes only cardio, full_body, and other from regions', () => {
    const unscoped = MUSCLE_GROUPS.filter(
      (muscle) => MUSCLE_SCOPE[muscle] === 'unscoped',
    );
    expect(unscoped).toEqual(['full_body', 'cardio', 'other']);
  });
});

describe('muscleBalance', () => {
  it('lists all sixteen regions without sessions', () => {
    const { ranked, unscoped, total } = muscleBalance([]);
    expect(ranked).toHaveLength(16);
    expect(
      ranked.every((entry) => entry.sets === 0),
    ).toBe(true);
    expect(unscoped).toEqual([]);
    expect(total).toBe(0);
  });

  it('keeps an untrained region at zero', () => {
    const { ranked } = muscleBalance([rows('chest', 4)]);
    expect(countOf(ranked, 'calves')).toBe(0);
    expect(countOf(ranked, 'chest')).toBe(4);
  });

  it('ranks from most to least served', () => {
    const { ranked } = muscleBalance([
      rows('calves', 2),
      rows('chest', 9),
      rows('quads', 5),
    ]);
    expect(
      ranked.slice(0, 3).map((entry) => entry.muscle),
    ).toEqual(['chest', 'quads', 'calves']);
  });

  it('breaks ties by canonical order', () => {
    const { ranked } = muscleBalance([
      rows('triceps', 3),
      rows('lats', 3),
    ]);
    const order = ranked.map((entry) => entry.muscle);
    expect(order.indexOf('lats')).toBeLessThan(
      order.indexOf('triceps'),
    );
  });

  it('shows an unscoped group only when it carries sets', () => {
    const { ranked, unscoped } = muscleBalance([
      rows('chest', 3),
      rows('cardio', 6),
    ]);
    expect(
      ranked.map((entry) => entry.muscle),
    ).not.toContain('cardio');
    expect(unscoped).toEqual([
      { muscle: 'cardio', sets: 6 },
    ]);
  });

  it('keeps an unresolved muscle separate from other', () => {
    const { unscoped } = muscleBalance([
      rows(undefined, 2),
      rows('other', 1),
    ]);
    expect(unscoped).toEqual([
      { muscle: undefined, sets: 2 },
      { muscle: 'other', sets: 1 },
    ]);
  });

  it('excludes warm-ups and counts dropsets and failures', () => {
    const balance = muscleBalance([
      {
        primaryMuscle: 'chest',
        sets: [
          historicalSet({ setType: 'warmup' }),
          historicalSet({ setType: 'normal' }),
          historicalSet({ setType: 'dropset' }),
          historicalSet({ setType: 'failure' }),
        ],
      },
    ]);

    expect(countOf(balance.ranked, 'chest')).toBe(3);
    expect(balance.total).toBe(3);
  });

  it('adds an exercise repeated in the same session', () => {
    const { ranked } = muscleBalance([
      rows('lats', 3),
      rows('lats', 2),
    ]);
    expect(countOf(ranked, 'lats')).toBe(5);
  });

  it('totals both lists', () => {
    const { total } = muscleBalance([
      rows('chest', 4),
      rows('cardio', 6),
      rows(undefined, 1),
    ]);
    expect(total).toBe(11);
  });
});

describe('toMuscleRows', () => {
  it('keeps an absent primary muscle absent', () => {
    const sources = [
      historicalWorkout({
        exercises: [
          historicalExercise({
            primaryMuscle: undefined,
            sets: [historicalSet()],
          }),
        ],
      }),
    ];

    expect(toMuscleRows(sources)[0]).not.toHaveProperty(
      'primaryMuscle',
    );
  });

  it('returns one row per session exercise', () => {
    const sources = [
      historicalWorkout({
        exercises: [
          historicalExercise({
            primaryMuscle: 'chest',
            sets: [historicalSet()],
          }),
          historicalExercise({
            primaryMuscle: 'triceps',
            sets: [historicalSet()],
          }),
        ],
      }),
    ];

    expect(
      toMuscleRows(sources).map(
        (entry) => entry.primaryMuscle,
      ),
    ).toEqual(['chest', 'triceps']);
  });
});
