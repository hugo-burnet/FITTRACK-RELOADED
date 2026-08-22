import { describe, expect, it } from 'vitest';
import { addLocalMonths, knownMonthStarts, monthStartOf, startOfLocalMonth } from './months';

function at(year: number, month: number, day: number, hours = 12): number {
  return new Date(year, month - 1, day, hours, 0, 0, 0).getTime();
}

describe('startOfLocalMonth', () => {
  it('lands on the first of the month at local midnight', () => {
    const start = new Date(startOfLocalMonth(at(2026, 8, 22, 23)));

    expect(start.getFullYear()).toBe(2026);
    expect(start.getMonth()).toBe(7);
    expect(start.getDate()).toBe(1);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
  });

  it('is idempotent', () => {
    const start = startOfLocalMonth(at(2026, 8, 22));
    expect(startOfLocalMonth(start)).toBe(start);
  });
});

describe('addLocalMonths', () => {
  it('walks forward and backward across a year boundary', () => {
    expect(addLocalMonths(startOfLocalMonth(at(2026, 12, 3)), 1)).toBe(
      startOfLocalMonth(at(2027, 1, 3)),
    );
    expect(addLocalMonths(startOfLocalMonth(at(2026, 1, 3)), -1)).toBe(
      startOfLocalMonth(at(2025, 12, 3)),
    );
  });

  it('keeps the wall clock across a daylight-saving change', () => {
    // Mars et octobre : les deux mois que 30 × 24 h rate d'une heure.
    for (const month of [3, 10]) {
      const next = new Date(addLocalMonths(startOfLocalMonth(at(2026, month, 5)), 1));
      expect(next.getDate()).toBe(1);
      expect(next.getHours()).toBe(0);
    }
  });
});

describe('monthStartOf', () => {
  it('judges a session in its own offset, not the reader’s', () => {
    // 23:30 le 31 juillet à Paris (UTC+2) : c'est juillet, même lu d'ailleurs.
    const startedAt = Date.UTC(2026, 6, 31, 21, 30);
    const july = monthStartOf(startedAt, 120);

    expect(new Date(july).getMonth()).toBe(6);
    expect(new Date(july).getDate()).toBe(1);
  });

  it('falls back on the reader’s calendar when the session has no offset', () => {
    expect(monthStartOf(at(2026, 8, 22))).toBe(startOfLocalMonth(at(2026, 8, 22)));
  });
});

describe('knownMonthStarts', () => {
  it('is empty without a single observed month', () => {
    expect(knownMonthStarts([], at(2026, 8, 22))).toEqual([]);
  });

  it('runs continuously from the oldest month to the current one, newest first', () => {
    const may = startOfLocalMonth(at(2026, 5, 4));
    const august = startOfLocalMonth(at(2026, 8, 1));

    expect(knownMonthStarts([august, may], at(2026, 8, 22))).toEqual([
      august,
      startOfLocalMonth(at(2026, 7, 1)),
      startOfLocalMonth(at(2026, 6, 1)),
      may,
    ]);
  });

  it('keeps a month with no session at all: a blank month is a reading too', () => {
    const june = startOfLocalMonth(at(2026, 6, 10));

    expect(knownMonthStarts([june], at(2026, 8, 22))).toHaveLength(3);
  });

  it('never stops before the current month, even with nothing logged since', () => {
    const january = startOfLocalMonth(at(2026, 1, 10));
    const months = knownMonthStarts([january], at(2026, 8, 22));

    expect(months[0]).toBe(startOfLocalMonth(at(2026, 8, 1)));
    expect(months.at(-1)).toBe(january);
  });
});
