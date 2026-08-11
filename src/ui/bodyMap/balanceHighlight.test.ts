import { describe, expect, it } from 'vitest';
import { WORKED_FLOOR, balanceHighlight } from './balanceHighlight';

describe('balanceHighlight', () => {
  it('gives the busiest muscle full intensity', () => {
    const lit = balanceHighlight([
      { muscle: 'quads', value: 20 },
      { muscle: 'chest', value: 10 },
    ]);
    expect(lit.quads).toBe(1);
    expect(lit.chest).toBeCloseTo(WORKED_FLOOR + (1 - WORKED_FLOOR) * 0.5);
  });

  // A single heavy leg day would otherwise round the bench press to nothing, and
  // the body would claim a muscle was never trained when it was.
  it('keeps a barely-trained muscle visibly worked', () => {
    const lit = balanceHighlight([
      { muscle: 'quads', value: 60 },
      { muscle: 'biceps', value: 1 },
    ]);
    expect(lit.biceps).toBeGreaterThanOrEqual(WORKED_FLOOR);
  });

  // The zeros are the whole point of the drawing: an untrained muscle is dark,
  // and the eye finds it without reading sixteen rows.
  it('leaves an untrained muscle out entirely', () => {
    const lit = balanceHighlight([
      { muscle: 'chest', value: 8 },
      { muscle: 'calves', value: 0 },
    ]);
    expect(lit.calves).toBeUndefined();
  });

  it('ignores the groups that have no region, and the unresolved ones', () => {
    const lit = balanceHighlight([
      { muscle: 'chest', value: 4 },
      { muscle: 'cardio', value: 40 },
      { muscle: undefined, value: 12 },
    ]);
    // Cardio's forty sets must not become the yardstick the chest is measured
    // against: it is not on the body at all.
    expect(lit).toEqual({ chest: 1 });
  });

  it('lights nothing when nothing was trained', () => {
    expect(balanceHighlight([])).toEqual({});
    expect(balanceHighlight([{ muscle: 'chest', value: 0 }])).toEqual({});
  });
});
