import { describe, expect, it } from 'vitest';
import { estimateOneRepMax, type OneRepMaxFormula } from '@/lib/oneRepMax';
import {
  benchmarkLine,
  floorLoad,
  loadForReps,
  referenceReps,
  type BenchmarkLineInput,
} from './benchmark';

const FORMULAS: OneRepMaxFormula[] = ['epley', 'brzycki', 'lombardi'];

describe('loadForReps', () => {
  it('is the exact inverse of estimateOneRepMax, for every formula and every rep count', () => {
    for (const formula of FORMULAS) {
      for (let reps = 1; reps <= 12; reps += 1) {
        const estimate = estimateOneRepMax(100, reps, formula);
        expect(estimate).toBeDefined();
        expect(loadForReps(estimate!, reps, formula)).toBeCloseTo(100, 8);
      }
    }
  });

  it('gives a known value: a 120 kg max carried for 10 reps by Epley is 90 kg', () => {
    expect(loadForReps(120, 10, 'epley')).toBeCloseTo(90, 8);
  });

  it('is the max itself for a single', () => {
    expect(loadForReps(137.5, 1, 'brzycki')).toBe(137.5);
  });

  it('refuses what the formulas do not cover', () => {
    expect(loadForReps(100, 0, 'epley')).toBeUndefined();
    expect(loadForReps(100, 13, 'epley')).toBeUndefined();
    expect(loadForReps(100, 2.5, 'epley')).toBeUndefined();
    expect(loadForReps(0, 5, 'epley')).toBeUndefined();
    expect(loadForReps(-10, 5, 'epley')).toBeUndefined();
    expect(loadForReps(Number.NaN, 5, 'epley')).toBeUndefined();
  });
});

describe('referenceReps', () => {
  it('keeps two reps in reserve above the bottom of the range', () => {
    expect(referenceReps(8)).toBe(10);
    expect(referenceReps(5)).toBe(7);
  });

  it('never leaves the domain of the formulas', () => {
    expect(referenceReps(11)).toBe(12);
    expect(referenceReps(12)).toBe(12);
    expect(referenceReps(20)).toBe(12);
  });

  it('falls back on 8 when the routine prescribes nothing usable', () => {
    expect(referenceReps(undefined)).toBe(10);
    expect(referenceReps(0)).toBe(10);
    expect(referenceReps(-3)).toBe(10);
    expect(referenceReps(6.5)).toBe(10);
  });
});

describe('floorLoad', () => {
  const grid = { kg: 2.5, onGrid: true };

  it('rounds down onto the equipment grid, never up', () => {
    expect(floorLoad(78.7, 80, grid)).toBe(77.5);
    expect(floorLoad(79.99, 80, grid)).toBe(77.5);
    expect(floorLoad(77.5, 80, grid)).toBe(77.5);
  });

  it('does not lose a grid load to float noise', () => {
    expect(floorLoad(77.49999999999, 80, grid)).toBe(77.5);
  });

  it('counts a step the user typed from the load that was tried, not from zero', () => {
    const typed = { kg: 1.125, onGrid: false };
    // 80 − 2 × 1,125 : an 77,625 on a multiple-of-1,125 grid would not exist on that stack.
    expect(floorLoad(77.9, 80, typed)).toBe(77.75);
    expect(floorLoad(81, 80, typed)).toBe(80);
  });

  it('never goes below zero', () => {
    expect(floorLoad(1, 80, grid)).toBe(0);
  });
});

const workingRoutine = (weights: (number | undefined)[], lo = 8, hi = 12) => ({
  routineExerciseId: 'row-1',
  sets: weights.map((targetWeight, index) => ({
    id: `s${index}`,
    setType: 'normal' as const,
    targetReps: lo,
    targetRepsMax: hi,
    targetWeight,
  })),
});

const bench = (overrides: Partial<BenchmarkLineInput> = {}): BenchmarkLineInput => ({
  exerciseId: 'bench',
  exerciseName: 'Développé couché',
  measurementType: 'weight_reps',
  equipment: 'barbell',
  formula: 'epley',
  sets: [{ weight: 80, reps: 9 }],
  routine: workingRoutine([70, 70, 70]),
  ...overrides,
});

describe('benchmarkLine — weight and reps', () => {
  it('turns a max into a working load that keeps two reps in reserve at the bottom of the range', () => {
    const line = benchmarkLine(bench());

    expect(line.verdict).toBe('calibrated');
    expect(line.tested).toEqual({ weight: 80, reps: 9 });
    // 80 × (1 + 9/30) = 104 ; 104 / (1 + 10/30) = 78 → 77,5 on a 2,5 grid.
    expect(line.oneRepMax).toBeCloseTo(104, 8);
    expect(line.referenceReps).toBe(10);
    expect(line.suggestedKg).toBe(77.5);
    expect(line.currentKg).toBe(70);
    expect(line.proposal).toEqual({
      routineExerciseId: 'row-1',
      targetSetIds: ['s0', 's1', 's2'],
      proposedWeight: 77.5,
      deltaKg: 7.5,
    });
  });

  it('leaves the warm-up sets of the routine alone', () => {
    const line = benchmarkLine(
      bench({
        routine: {
          routineExerciseId: 'row-1',
          sets: [
            { id: 'w', setType: 'warmup', targetReps: 10, targetWeight: 40 },
            { id: 'a', setType: 'normal', targetReps: 8, targetRepsMax: 12, targetWeight: 70 },
            { id: 'b', setType: 'failure', targetReps: 8, targetRepsMax: 12, targetWeight: 70 },
          ],
        },
      }),
    );

    expect(line.proposal?.targetSetIds).toEqual(['a', 'b']);
  });

  it('sizes the load on the bottom of the first working set of the routine', () => {
    const line = benchmarkLine(bench({ routine: workingRoutine([70], 5, 5) }));

    // 7 reps in reserve-adjusted terms: 104 / (1 + 7/30) = 84,3 → 82,5.
    expect(line.referenceReps).toBe(7);
    expect(line.suggestedKg).toBe(82.5);
  });

  it('shifts a pyramid as a whole instead of flattening it', () => {
    const line = benchmarkLine(bench({ routine: workingRoutine([60, 70, 80]) }));

    // The set the benchmark stood in for is the first one: 60 → 77,5.
    expect(line.proposal?.deltaKg).toBe(17.5);
    expect(line.proposal?.targetSetIds).toEqual(['s0', 's1', 's2']);
    expect(line.currentKg).toBe(80);
  });

  it('proposes a lower load when the routine was too heavy', () => {
    const line = benchmarkLine(bench({ routine: workingRoutine([90]) }));

    expect(line.proposal?.deltaKg).toBe(-12.5);
    expect(line.proposal?.proposedWeight).toBe(77.5);
  });

  it('writes nothing when the routine already carries the calibrated load', () => {
    const line = benchmarkLine(bench({ routine: workingRoutine([77.5, 77.5]) }));

    expect(line.verdict).toBe('calibrated');
    expect(line.suggestedKg).toBe(77.5);
    expect(line.proposal).toBeUndefined();
    expect(line.aligned).toBe(true);
  });

  it('writes the figure itself when the routine carried no load at all', () => {
    const line = benchmarkLine(bench({ routine: workingRoutine([undefined, undefined]) }));

    expect(line.currentKg).toBeUndefined();
    expect(line.proposal).toEqual({
      routineExerciseId: 'row-1',
      targetSetIds: ['s0', 's1'],
      proposedWeight: 77.5,
    });
  });

  it('still gives the load when the exercise is no longer in the routine, but proposes no write', () => {
    const line = benchmarkLine(bench({ routine: undefined }));

    expect(line.suggestedKg).toBe(77.5);
    expect(line.proposal).toBeUndefined();
    expect(line.aligned).toBeUndefined();
  });

  it('keeps the set that carries the highest estimated max when several were done', () => {
    const line = benchmarkLine(
      bench({
        sets: [
          { weight: 80, reps: 9 },
          { weight: 80, reps: 12 },
          { weight: 60, reps: 8 },
        ],
      }),
    );

    expect(line.tested).toEqual({ weight: 80, reps: 12 });
    expect(line.oneRepMax).toBeCloseTo(112, 8);
  });

  it('honours the formula of the settings', () => {
    const epley = benchmarkLine(bench());
    const brzycki = benchmarkLine(bench({ formula: 'brzycki' }));

    expect(brzycki.oneRepMax).toBeCloseTo((80 * 36) / (37 - 9), 8);
    expect(brzycki.oneRepMax).not.toBeCloseTo(epley.oneRepMax!, 1);
  });

  it('counts a step typed on the exercise from the load that was tried', () => {
    const line = benchmarkLine(bench({ loadIncrementKg: 1.125 }));

    // ideal 78 ; 80 − 1 × 1,125 = 78,875 is above it, 80 − 2 × 1,125 = 77,75 is below.
    expect(line.suggestedKg).toBe(77.75);
  });

  it('says so when the set went past what the formulas can read', () => {
    const line = benchmarkLine(bench({ sets: [{ weight: 40, reps: 15 }] }));

    expect(line.verdict).toBe('too_light');
    expect(line.tested).toEqual({ weight: 40, reps: 15 });
    expect(line.oneRepMax).toBeUndefined();
    expect(line.suggestedKg).toBeUndefined();
    expect(line.proposal).toBeUndefined();
  });

  it('prefers a readable set over a too-light one', () => {
    const line = benchmarkLine(
      bench({
        sets: [
          { weight: 40, reps: 15 },
          { weight: 80, reps: 9 },
        ],
      }),
    );

    expect(line.verdict).toBe('calibrated');
    expect(line.tested).toEqual({ weight: 80, reps: 9 });
  });

  it('cannot read a max without a load', () => {
    expect(benchmarkLine(bench({ sets: [{ reps: 10 }] })).verdict).toBe('no_load');
    expect(benchmarkLine(bench({ sets: [{ weight: 0, reps: 10 }] })).verdict).toBe('no_load');
  });

  it('reports a load too small for the equipment step as unreadable rather than as zero', () => {
    const line = benchmarkLine(bench({ sets: [{ weight: 1, reps: 10 }], equipment: 'barbell' }));

    expect(line.verdict).toBe('no_load');
    expect(line.proposal).toBeUndefined();
  });

  it('reads a single as the max itself', () => {
    const line = benchmarkLine(bench({ sets: [{ weight: 130, reps: 1 }] }));

    expect(line.oneRepMax).toBe(130);
    // 130 / (1 + 10/30) = 97,5
    expect(line.suggestedKg).toBe(97.5);
  });
});

describe('benchmarkLine — what has no load to propose', () => {
  it('records reps for a bodyweight exercise, without a proposal', () => {
    const line = benchmarkLine({
      exerciseId: 'pullup',
      exerciseName: 'Tractions',
      measurementType: 'reps_only',
      equipment: 'bodyweight',
      formula: 'epley',
      sets: [{ reps: 11 }],
      routine: workingRoutine([undefined]),
    });

    expect(line.verdict).toBe('recorded');
    expect(line.tested).toEqual({ reps: 11 });
    expect(line.suggestedKg).toBeUndefined();
    expect(line.proposal).toBeUndefined();
  });

  it('keeps the most repetitions among bodyweight sets', () => {
    const line = benchmarkLine({
      exerciseId: 'pullup',
      exerciseName: 'Tractions',
      measurementType: 'reps_only',
      equipment: 'bodyweight',
      formula: 'epley',
      sets: [{ reps: 8 }, { reps: 11 }, { reps: 9 }],
    });

    expect(line.tested).toEqual({ reps: 11 });
  });

  it('records the hold of a timed exercise', () => {
    const line = benchmarkLine({
      exerciseId: 'plank',
      exerciseName: 'Gainage',
      measurementType: 'time_only',
      equipment: 'bodyweight',
      formula: 'epley',
      sets: [{ durationSeconds: 75 }, { durationSeconds: 90 }],
    });

    expect(line.verdict).toBe('recorded');
    expect(line.tested).toEqual({ durationSeconds: 90 });
  });

  it('gives an assisted exercise its reps and no load', () => {
    const line = benchmarkLine({
      exerciseId: 'assisted',
      exerciseName: 'Tractions assistées',
      measurementType: 'assisted_weight_reps',
      equipment: 'machine',
      formula: 'epley',
      sets: [{ weight: 30, reps: 8 }],
      routine: workingRoutine([30]),
    });

    expect(line.verdict).toBe('recorded');
    expect(line.tested).toEqual({ weight: 30, reps: 8 });
    expect(line.proposal).toBeUndefined();
  });

  it('marks an exercise nobody did', () => {
    expect(benchmarkLine(bench({ sets: [] })).verdict).toBe('skipped');
  });
});
