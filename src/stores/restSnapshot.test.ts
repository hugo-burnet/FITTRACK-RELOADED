import { describe, expect, it } from 'vitest';
import { readRestSnapshot } from './restSnapshot';

describe('readRestSnapshot', () => {
  const timer = { setId: 'set-1', startedAt: 1000, endsAt: 61000, seconds: 60 };
  it('restores the original deadline without giving extra rest', () => {
    expect(readRestSnapshot(JSON.stringify(timer), 21000)).toEqual(timer);
  });
  it('rejects expired or invalid snapshots', () => {
    for (const raw of [
      '{',
      '{}',
      JSON.stringify(timer),
      JSON.stringify({ ...timer, seconds: -1 }),
    ]) {
      expect(readRestSnapshot(raw, 61000)).toBeNull();
    }
  });
});
