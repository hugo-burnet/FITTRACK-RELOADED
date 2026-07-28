import { describe, expect, it } from 'vitest';
import { localOffsetMinutes } from './timezone';

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
