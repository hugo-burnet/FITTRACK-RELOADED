import { describe, expect, it } from 'vitest';
import { matchPreviousSets } from './previousSets';

describe('matchPreviousSets', () => {
  it('never proposes a warm-up for a working set in the next session', () => {
    const history = [
      { setType: 'warmup' as const, weight: 20 },
      { setType: 'normal' as const, weight: 60 },
      { setType: 'normal' as const, weight: 65 },
    ];
    expect(matchPreviousSets([{ setType: 'normal' }, { setType: 'normal' }], history)).toEqual([
      history[1],
      history[2],
    ]);
  });

  it('keeps working ranks stable when today has a different warm-up count', () => {
    const history = [
      { setType: 'warmup' as const, weight: 20 },
      { setType: 'normal' as const, weight: 60 },
    ];
    expect(
      matchPreviousSets(
        [
          { setType: 'warmup' },
          { setType: 'warmup' },
          { setType: 'normal' },
          { setType: 'normal' },
        ],
        history,
      ),
    ).toEqual([history[0], undefined, history[1], undefined]);
  });
});
