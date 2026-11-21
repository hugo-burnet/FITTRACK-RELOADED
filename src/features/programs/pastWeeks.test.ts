import { describe, expect, it } from 'vitest';
import type { ProgramWorkoutReading } from '@/data/repositories/programHistory';
import type { ProgramWeek } from '@/data/types';
import { buildPastWeeks } from './pastWeeks';

const MONDAY = new Date(2026, 10, 2, 0, 0).getTime();
const DAY = 86_400_000;

const week = (weekIndex: number): ProgramWeek =>
  ({ weekIndex, loadIndex: 100, phase: 'construction' }) as ProgramWeek;

const revisions = [{ id: 'r0', effectiveFromWeekIndex: 0, createdAt: 1 }];
const entries = [
  { id: 'mon', revisionId: 'r0', routineId: 'push', dayOfWeek: 1, order: 0 },
  { id: 'wed', revisionId: 'r0', routineId: 'pull', dayOfWeek: 3, order: 1 },
  { id: 'fri', revisionId: 'r0', routineId: 'legs', dayOfWeek: 5, order: 2 },
];
const routineNames = new Map<string, string | null>([
  ['push', 'Poussée'],
  ['pull', 'Tirage'],
  ['legs', null],
]);

const workout = (
  id: string,
  weekIndex: number,
  entryId: string | undefined,
  dayOffset: number,
  tonnage = 1000,
): ProgramWorkoutReading => ({
  workoutId: id,
  name: `Séance ${id}`,
  startedAt: MONDAY + (weekIndex * 7 + dayOffset) * DAY + 18 * 3_600_000,
  weekIndex,
  entryId,
  tonnage,
});

const build = (beforeWeekIndex: number, workouts: ProgramWorkoutReading[]) =>
  buildPastWeeks({
    startsAt: MONDAY,
    weeks: [week(0), week(1), week(2), week(3)],
    revisions,
    entries,
    workouts,
    routineNames,
    beforeWeekIndex,
  });

describe('buildPastWeeks', () => {
  it('lists the weeks before the displayed one, newest first', () => {
    expect(build(3, []).map(({ week: past }) => past.weekIndex)).toEqual([2, 1, 0]);
    expect(build(0, [])).toEqual([]);
  });

  it('turns a done slot into a row that leads to its session, with its own name and date', () => {
    const [first] = build(1, [workout('a', 0, 'mon', 1, 6860)]);
    expect(first?.rows[0]).toMatchObject({
      key: 'a',
      dayOfWeek: 2,
      name: 'Séance a',
      state: 'completed',
      workoutId: 'a',
      tonnage: 6860,
      date: MONDAY + DAY + 18 * 3_600_000,
    });
  });

  it('marks an unplayed slot as missed, on its planned date, with the routine name', () => {
    const [first] = build(1, []);
    expect(first?.rows.map(({ name, state, dayOfWeek }) => [name, state, dayOfWeek])).toEqual([
      ['Poussée', 'missed', 1],
      ['Tirage', 'missed', 3],
      [null, 'missed', 5],
    ]);
    expect(first?.rows[2]?.date).toBe(new Date(2026, 10, 6, 0, 0).getTime());
  });

  it('counts the played slots out of the planned ones', () => {
    const [first] = build(1, [workout('a', 0, 'mon', 0), workout('b', 0, 'wed', 2)]);
    expect(first).toMatchObject({ done: 2, planned: 3 });
  });

  it('keeps a session that matches no slot reachable, without counting it', () => {
    const [first] = build(1, [
      workout('a', 0, 'mon', 0),
      workout('b', 0, 'mon', 1),
      workout('c', 0, 'gone', 3),
    ]);
    expect(first?.done).toBe(1);
    expect(first?.rows.filter(({ state }) => state === 'completed').map(({ key }) => key)).toEqual([
      'a',
      'b',
      'c',
    ]);
  });
});
