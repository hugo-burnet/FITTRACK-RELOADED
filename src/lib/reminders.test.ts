import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REMINDER_SCHEDULE,
  minutesFromClockValue,
  minutesOfDay,
  nextReminderOccurrences,
  normalizeReminderSchedule,
  REMINDER_WEEK_ORDER,
  reminderClockValue,
  type ReminderSchedule,
} from './reminders';

/** A local instant, written the way a phone owner reads a clock. */
function at(year: number, month: number, day: number, hours: number, minutes = 0): number {
  return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
}

function weekday(timestamp: number): number {
  return new Date(timestamp).getDay();
}

const MONDAY = at(2026, 8, 24, 0);
const WEDNESDAY = at(2026, 8, 26, 0);

describe('normalizeReminderSchedule', () => {
  it('falls back to the default for anything that is not a schedule', () => {
    for (const value of [undefined, null, 42, 'lundi', [], { days: 3 }]) {
      expect(normalizeReminderSchedule(value)).toEqual(DEFAULT_REMINDER_SCHEDULE);
    }
  });

  it('sorts and deduplicates the days, and drops the ones outside the week', () => {
    expect(normalizeReminderSchedule({ days: [5, 1, 1, 7, -2, 3.5], minutes: 480 })).toEqual({
      days: [1, 5],
      minutes: 480,
    });
  });

  it('keeps an empty week: unchecking every day is an answer, not a corruption', () => {
    expect(normalizeReminderSchedule({ days: [], minutes: 480 })).toEqual({
      days: [],
      minutes: 480,
    });
  });

  it('refuses a time outside the day and takes the default hour instead', () => {
    for (const minutes of [-1, 1440, 12.5, Number.NaN, '18:00']) {
      expect(normalizeReminderSchedule({ days: [2], minutes })).toEqual({
        days: [2],
        minutes: DEFAULT_REMINDER_SCHEDULE.minutes,
      });
    }
  });
});

describe('minutesOfDay', () => {
  it('reads a clock into minutes since local midnight', () => {
    expect(minutesOfDay(18, 30)).toBe(1110);
    expect(minutesOfDay(0, 0)).toBe(0);
  });
});

describe('the clock field', () => {
  it('writes an hour the field can display', () => {
    expect(reminderClockValue(minutesOfDay(18, 0))).toBe('18:00');
    expect(reminderClockValue(minutesOfDay(7, 5))).toBe('07:05');
    expect(reminderClockValue(0)).toBe('00:00');
  });

  it('reads back what it wrote', () => {
    for (const minutes of [0, 435, 1110, 1439]) {
      expect(minutesFromClockValue(reminderClockValue(minutes))).toBe(minutes);
    }
  });

  it('leaves the saved hour alone on a field being typed into', () => {
    for (const value of ['', '1', '18:', '25:00', '18:75', 'midi']) {
      expect(minutesFromClockValue(value)).toBeUndefined();
    }
  });
});

describe('REMINDER_WEEK_ORDER', () => {
  it('reads Monday first and Sunday last, and holds the whole week', () => {
    expect(REMINDER_WEEK_ORDER).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(new Set(REMINDER_WEEK_ORDER).size).toBe(7);
  });
});

describe('nextReminderOccurrences', () => {
  const mondayEvening: ReminderSchedule = {
    days: [weekday(MONDAY)],
    minutes: minutesOfDay(18, 30),
  };

  it('gives nothing when no day is checked', () => {
    expect(nextReminderOccurrences({ days: [], minutes: 600 }, MONDAY, 4)).toEqual([]);
  });

  it('keeps today when its hour has not passed yet', () => {
    expect(nextReminderOccurrences(mondayEvening, at(2026, 8, 24, 9), 1)).toEqual([
      at(2026, 8, 24, 18, 30),
    ]);
  });

  it('skips today once its hour has passed', () => {
    expect(nextReminderOccurrences(mondayEvening, at(2026, 8, 24, 20), 1)).toEqual([
      at(2026, 8, 31, 18, 30),
    ]);
  });

  it('treats the exact minute as already rung: a reminder never fires twice', () => {
    expect(nextReminderOccurrences(mondayEvening, at(2026, 8, 24, 18, 30), 1)).toEqual([
      at(2026, 8, 31, 18, 30),
    ]);
  });

  it('walks several weeks in order, without a repeated instant', () => {
    const schedule: ReminderSchedule = {
      days: [weekday(MONDAY), weekday(WEDNESDAY)],
      minutes: minutesOfDay(7, 0),
    };
    const occurrences = nextReminderOccurrences(schedule, at(2026, 8, 24, 9), 4);

    expect(occurrences).toEqual([
      at(2026, 8, 26, 7),
      at(2026, 8, 31, 7),
      at(2026, 9, 2, 7),
      at(2026, 9, 7, 7),
    ]);
    expect(new Set(occurrences).size).toBe(occurrences.length);
  });

  it('never returns more than asked, nor anything before now', () => {
    const occurrences = nextReminderOccurrences(DEFAULT_REMINDER_SCHEDULE, MONDAY, 6);
    expect(occurrences).toHaveLength(6);
    expect(occurrences.every((occurrence) => occurrence > MONDAY)).toBe(true);
    expect([...occurrences].sort((left, right) => left - right)).toEqual(occurrences);
  });

  it('lands on the wall clock across a daylight-saving change, not 168 hours later', () => {
    // Le dernier dimanche d'octobre : la semaine qui l'enjambe dure 169 heures
    // dans la moitié nord du monde. L'heure affichée, elle, ne bouge pas.
    const schedule: ReminderSchedule = {
      days: [weekday(at(2026, 10, 22, 0))],
      minutes: minutesOfDay(19, 0),
    };
    const [first, second] = nextReminderOccurrences(schedule, at(2026, 10, 22, 20), 2);

    expect(new Date(first ?? 0).getHours()).toBe(19);
    expect(new Date(second ?? 0).getHours()).toBe(19);
  });
});
