import { describe, expect, it } from 'vitest';

import { isoDayOfWeek, programPosition, shiftLocalDate } from './calendar';

describe('program calendar', () => {
  it('positions dates before, during, and after a program', () => {
    const monday = new Date(2026, 7, 10).getTime();

    expect(programPosition(monday, 4, new Date(2026, 7, 9).getTime())).toEqual({
      phase: 'before',
    });
    expect(programPosition(monday, 4, new Date(2026, 7, 24).getTime())).toMatchObject({
      phase: 'active',
      weekIndex: 2,
    });
    expect(programPosition(monday, 4, new Date(2026, 8, 7).getTime())).toEqual({
      phase: 'after',
    });
  });

  it('shifts a local date across a daylight-saving transition', () => {
    expect(new Date(shiftLocalDate(new Date(2026, 2, 23).getTime(), 7)).getDate()).toBe(30);
  });

  it('returns ISO weekday numbering', () => {
    const monday = new Date(2026, 7, 10).getTime();

    expect(isoDayOfWeek(monday)).toBe(1);
  });
});
