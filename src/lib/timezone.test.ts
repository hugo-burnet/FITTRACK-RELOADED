import { describe, expect, it } from 'vitest';
import { isoWithOffset, localDateKey, localOffsetMinutes, shiftToOffset } from './timezone';

describe('localOffsetMinutes', () => {
  it('reports the minutes to add to UTC, the opposite sign of getTimezoneOffset', () => {
    const at = Date.UTC(2026, 6, 28, 12, 0, 0);
    expect(localOffsetMinutes(at)).toBe(-new Date(at).getTimezoneOffset());
  });

  it('reads the offset of the given instant, not of today', () => {
    // Two instants six months apart. In any zone observing daylight saving they
    // differ; in a zone that does not, they match. Both are correct — what must
    // never happen is the summer instant reporting the winter offset because
    // the clock said so at call time.
    const january = Date.UTC(2026, 0, 15, 12, 0, 0);
    const july = Date.UTC(2026, 6, 15, 12, 0, 0);

    expect(localOffsetMinutes(january)).toBe(-new Date(january).getTimezoneOffset());
    expect(localOffsetMinutes(july)).toBe(-new Date(july).getTimezoneOffset());
  });

  it('returns whole minutes', () => {
    expect(Number.isInteger(localOffsetMinutes(Date.now()))).toBe(true);
  });
});

// 27 July 2026, 16:20 UTC — 18:20 in Paris that day.
const summerEvening = Date.UTC(2026, 6, 27, 16, 20, 0);

describe('shiftToOffset', () => {
  it('moves the instant so UTC formatting reads as the local clock', () => {
    const shifted = shiftToOffset(summerEvening, 120);
    expect(new Date(shifted).getUTCHours()).toBe(18);
    expect(new Date(shifted).getUTCMinutes()).toBe(20);
  });

  it('leaves an instant alone at offset zero', () => {
    expect(shiftToOffset(summerEvening, 0)).toBe(summerEvening);
  });

  it('moves backwards west of UTC', () => {
    const shifted = shiftToOffset(summerEvening, -300);
    expect(new Date(shifted).getUTCHours()).toBe(11);
  });
});

describe('localDateKey', () => {
  it('writes the civil day of the session, in its own offset', () => {
    expect(localDateKey(summerEvening, 120)).toBe('2026-07-27');
  });

  it('does not move the civil day when the reader is elsewhere', () => {
    // A session logged at 23:30 in Paris. Read from Paris or from New York, it
    // happened on the 27th — that is the whole reason the offset is stored.
    const lateEvening = Date.UTC(2026, 6, 27, 21, 30, 0);
    expect(localDateKey(lateEvening, 120)).toBe('2026-07-27');
    // The same instant read with the reader's offset instead would say the 27th
    // in UTC too, so the discriminating case is the one that crosses midnight.
    expect(localDateKey(lateEvening, -300)).toBe('2026-07-27');
    expect(localDateKey(lateEvening, 0)).toBe('2026-07-27');
  });

  it('crosses midnight with the offset, not with UTC', () => {
    // 23:10 UTC on the 27th is already 01:10 on the 28th in Paris.
    const beforeMidnightUtc = Date.UTC(2026, 6, 27, 23, 10, 0);
    expect(localDateKey(beforeMidnightUtc, 120)).toBe('2026-07-28');
    expect(localDateKey(beforeMidnightUtc, 0)).toBe('2026-07-27');
    expect(localDateKey(beforeMidnightUtc, -300)).toBe('2026-07-27');
  });

  it('pads month and day', () => {
    expect(localDateKey(Date.UTC(2026, 0, 3, 12, 0, 0), 0)).toBe('2026-01-03');
  });
});

describe('isoWithOffset', () => {
  it('writes the local clock followed by its own offset', () => {
    expect(isoWithOffset(summerEvening, 120)).toBe('2026-07-27T18:20:00+02:00');
  });

  it('writes Z at offset zero rather than +00:00', () => {
    expect(isoWithOffset(summerEvening, 0)).toBe('2026-07-27T16:20:00Z');
  });

  it('writes a negative offset west of UTC', () => {
    expect(isoWithOffset(summerEvening, -300)).toBe('2026-07-27T11:20:00-05:00');
  });

  it('writes a non-whole-hour offset', () => {
    // India is +05:30, and an offset formatter that only divides by 60 loses it.
    expect(isoWithOffset(summerEvening, 330)).toBe('2026-07-27T21:50:00+05:30');
  });
});
