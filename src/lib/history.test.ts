import { describe, expect, it } from 'vitest';
import {
  addLocalWeeks,
  calculateWeeklyRegularity,
  resolveWeeklyGoal,
  startOfLocalWeek,
  type WeeklyTrainingGoal,
} from './history';

const at = (year: number, month: number, day: number, hour = 12): number =>
  new Date(year, month, day, hour).getTime();

const workout = (weekStart: number, dayOffset: number, hour = 12): number => {
  const date = new Date(weekStart);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
};

describe('startOfLocalWeek', () => {
  it('ramène un dimanche au lundi local précédent à minuit', () => {
    const result = new Date(startOfLocalWeek(at(2026, 6, 26, 18)));

    expect([
      result.getFullYear(),
      result.getMonth(),
      result.getDate(),
      result.getHours(),
      result.getMinutes(),
    ]).toEqual([2026, 6, 20, 0, 0]);
  });

  it('garde le lundi local mais retire son heure', () => {
    expect(new Date(startOfLocalWeek(at(2026, 6, 20, 23)))).toEqual(
      new Date(2026, 6, 20),
    );
  });
});

describe('addLocalWeeks', () => {
  it('préserve le lundi à minuit en traversant les changements d’heure locaux', () => {
    const beforeSpringChange = new Date(2026, 2, 23).getTime();
    const afterTwoWeeks = new Date(addLocalWeeks(beforeSpringChange, 2));

    expect([
      afterTwoWeeks.getFullYear(),
      afterTwoWeeks.getMonth(),
      afterTwoWeeks.getDate(),
      afterTwoWeeks.getHours(),
    ]).toEqual([2026, 3, 6, 0]);
  });
});

describe('resolveWeeklyGoal', () => {
  const augustChange = new Date(2026, 7, 3).getTime();
  const history: WeeklyTrainingGoal[] = [
    { effectiveFromWeek: 0, sessions: 4 },
    { effectiveFromWeek: augustChange, sessions: 3 },
  ];

  it('rend null en absence d’objectif', () => {
    expect(resolveWeeklyGoal([], at(2026, 6, 20))).toBeNull();
  });

  it('applique le premier objectif à tout le passé', () => {
    expect(resolveWeeklyGoal(history, new Date(2025, 0, 6).getTime())).toBe(4);
  });

  it('conserve l’ancien objectif avant le changement', () => {
    expect(resolveWeeklyGoal(history, new Date(2026, 6, 27).getTime())).toBe(4);
  });

  it('applique le nouvel objectif à partir de son lundi', () => {
    expect(resolveWeeklyGoal(history, augustChange)).toBe(3);
  });

  it('résout correctement un historique reçu dans le désordre', () => {
    expect(resolveWeeklyGoal([...history].reverse(), augustChange)).toBe(3);
  });
});

describe('calculateWeeklyRegularity', () => {
  const currentWeek = new Date(2026, 6, 20).getTime();
  const previousWeek = addLocalWeeks(currentWeek, -1);
  const twoWeeksAgo = addLocalWeeks(currentWeek, -2);
  const threeWeeksAgo = addLocalWeeks(currentWeek, -3);
  const now = workout(currentWeek, 5, 18);
  const fourPerWeek: WeeklyTrainingGoal[] = [{ effectiveFromWeek: 0, sessions: 4 }];

  const sessions = (weekStart: number, count: number): number[] =>
    Array.from({ length: count }, (_, index) => workout(weekStart, index));

  it('compte la semaine courante même avant que l’objectif soit défini', () => {
    expect(calculateWeeklyRegularity(sessions(currentWeek, 3), [], now)).toEqual({
      currentCompleted: 3,
      currentGoal: null,
      streak: 0,
    });
  });

  it('ne laisse pas une semaine courante incomplète casser le streak clos', () => {
    const completed = [
      ...sessions(twoWeeksAgo, 4),
      ...sessions(previousWeek, 4),
      ...sessions(currentWeek, 3),
    ];

    expect(calculateWeeklyRegularity(completed, fourPerWeek, now)).toEqual({
      currentCompleted: 3,
      currentGoal: 4,
      streak: 2,
    });
  });

  it('étend le streak dès que la semaine courante atteint son objectif', () => {
    const completed = [
      ...sessions(twoWeeksAgo, 4),
      ...sessions(previousWeek, 4),
      ...sessions(currentWeek, 4),
    ];

    expect(calculateWeeklyRegularity(completed, fourPerWeek, now).streak).toBe(3);
  });

  it('arrête le streak au premier objectif manqué', () => {
    const completed = [
      ...sessions(threeWeeksAgo, 4),
      ...sessions(twoWeeksAgo, 3),
      ...sessions(previousWeek, 4),
      ...sessions(currentWeek, 2),
    ];

    expect(calculateWeeklyRegularity(completed, fourPerWeek, now).streak).toBe(1);
  });

  it('compte deux séances distinctes effectuées le même jour', () => {
    const sameDay = workout(currentWeek, 1);
    const completed = [sameDay, sameDay + 3_600_000];

    expect(
      calculateWeeklyRegularity(
        completed,
        [{ effectiveFromWeek: 0, sessions: 2 }],
        now,
      ),
    ).toMatchObject({ currentCompleted: 2, streak: 1 });
  });

  it('évalue chaque semaine avec l’objectif qui lui était applicable', () => {
    const changedGoal: WeeklyTrainingGoal[] = [
      { effectiveFromWeek: 0, sessions: 4 },
      { effectiveFromWeek: currentWeek, sessions: 3 },
    ];
    const completed = [
      ...sessions(twoWeeksAgo, 4),
      ...sessions(previousWeek, 4),
      ...sessions(currentWeek, 3),
    ];

    expect(calculateWeeklyRegularity(completed, changedGoal, now)).toEqual({
      currentCompleted: 3,
      currentGoal: 3,
      streak: 3,
    });
  });

  it('rend un streak nul quand aucune séance n’existe', () => {
    expect(calculateWeeklyRegularity([], fourPerWeek, now)).toEqual({
      currentCompleted: 0,
      currentGoal: 4,
      streak: 0,
    });
  });
});
