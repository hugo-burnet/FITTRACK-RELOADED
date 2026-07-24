import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BARBELL_KG,
  DEFAULT_PLATES_KG,
  computePlateLoad,
  type PlateInventory,
} from './plates';

/** The standard gym set, unlimited pairs — the case the calculator hits most. */
const unlimited: PlateInventory = DEFAULT_PLATES_KG.map((weight) => ({ weight }));

describe('computePlateLoad — the exact loads', () => {
  it('splits a round barbell load into the heaviest plates per side', () => {
    // 100 kg on a 20 kg bar → 40 kg a side. Fewest plates wins: 25 + 15.
    const load = computePlateLoad(100, { barWeight: 20, inventory: unlimited });
    expect(load.perSide).toEqual([
      { weight: 25, count: 1 },
      { weight: 15, count: 1 },
    ]);
    expect(load.remainderKg).toBe(0);
    expect(load.achievedKg).toBe(100);
  });

  it('reaches a half-plate target with the small plates', () => {
    // 102.5 kg, 20 kg bar → 41.25 a side → 25 + 15 + 1.25. This is the checkpoint.
    const load = computePlateLoad(102.5, { barWeight: 20, inventory: unlimited });
    expect(load.perSide).toEqual([
      { weight: 25, count: 1 },
      { weight: 15, count: 1 },
      { weight: 1.25, count: 1 },
    ]);
    expect(load.remainderKg).toBe(0);
  });

  it('stacks several of the same plate when the load needs it', () => {
    // 120 kg, 20 kg bar → 50 a side → 25 + 25.
    const load = computePlateLoad(120, { barWeight: 20, inventory: unlimited });
    expect(load.perSide).toEqual([{ weight: 25, count: 2 }]);
    expect(load.remainderKg).toBe(0);
  });

  it('is the bar alone when the target equals the bar', () => {
    const load = computePlateLoad(20, { barWeight: 20, inventory: unlimited });
    expect(load.perSide).toEqual([]);
    expect(load.achievedKg).toBe(20);
    expect(load.remainderKg).toBe(0);
    expect(load.belowBar).toBe(false);
  });
});

describe('computePlateLoad — when it cannot be exact', () => {
  it('reports the leftover the plates cannot reach', () => {
    // A coarse rack whose smallest plate is 1.25. 101 kg, 20 kg bar → 40.5 a
    // side; 25 + 15 = 40 a side, 0.5 short a side = 1 kg short total.
    const coarse: PlateInventory = [25, 20, 15, 10, 5, 2.5, 1.25].map((weight) => ({ weight }));
    const load = computePlateLoad(101, { barWeight: 20, inventory: coarse });
    expect(load.achievedKg).toBe(100);
    expect(load.remainderKg).toBeCloseTo(1, 5);
  });

  it('flags a target below the bar rather than inventing negative plates', () => {
    // You cannot load less than the empty bar.
    const load = computePlateLoad(15, { barWeight: 20, inventory: unlimited });
    expect(load.belowBar).toBe(true);
    expect(load.perSide).toEqual([]);
    expect(load.achievedKg).toBe(20);
  });
});

describe('computePlateLoad — a finite rack', () => {
  it('never uses more of a plate than the rack holds per side', () => {
    // Only one 25 a side. 120 kg wants two 25s a side; the second falls back.
    const inventory: PlateInventory = [
      { weight: 25, countPerSide: 1 },
      { weight: 20, countPerSide: 10 },
      { weight: 10, countPerSide: 10 },
      { weight: 5, countPerSide: 10 },
    ];
    // 50 a side: 25 (only one) + 20 + 5 = 50.
    const load = computePlateLoad(120, { barWeight: 20, inventory });
    expect(load.perSide).toEqual([
      { weight: 25, count: 1 },
      { weight: 20, count: 1 },
      { weight: 5, count: 1 },
    ]);
    expect(load.remainderKg).toBe(0);
  });
});

describe('computePlateLoad — machines and loadable dumbbells', () => {
  it('loads a single-sided stack when sides = 1', () => {
    // A plate-loaded machine with one peg: the whole load sits on one side.
    const load = computePlateLoad(50, { barWeight: 0, inventory: unlimited, sides: 1 });
    expect(load.perSide).toEqual([{ weight: 25, count: 2 }]);
    expect(load.achievedKg).toBe(50);
  });

  it('treats a loadable dumbbell handle like a two-sided bar', () => {
    // A 2 kg handle loaded to 20 kg → 9 kg an end. 5 + 2.5 + 1.25 + 0.25.
    const load = computePlateLoad(20, { barWeight: 2, inventory: unlimited });
    expect(load.achievedKg).toBe(20);
    expect(load.remainderKg).toBe(0);
    expect(load.perSide).toEqual([
      { weight: 5, count: 1 },
      { weight: 2.5, count: 1 },
      { weight: 1.25, count: 1 },
      { weight: 0.25, count: 1 },
    ]);
  });
});

describe('defaults', () => {
  it('offers an olympic bar and a descending plate set', () => {
    expect(DEFAULT_BARBELL_KG).toBe(20);
    // Sorted heaviest first so a caller can trust the order.
    expect(DEFAULT_PLATES_KG).toEqual([...DEFAULT_PLATES_KG].sort((a, b) => b - a));
    expect(DEFAULT_PLATES_KG).toContain(1.25);
  });
});
