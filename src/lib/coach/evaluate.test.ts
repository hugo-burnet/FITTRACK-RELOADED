import { describe, expect, it } from 'vitest';
import {
  collectCoachSignals,
  evaluateCoach,
  mergeLinesForWorkout,
  pickSignals,
} from './evaluate';
import type { CoachExerciseLine, CoachSetInput, CoachSignal } from './types';

const t0 = Date.UTC(2026, 7, 1, 10);

function set(
  partial: Partial<CoachSetInput> & Pick<CoachSetInput, 'order' | 'reps'>,
): CoachSetInput {
  return {
    setType: 'normal',
    isCompleted: 1,
    weight: 100,
    targetReps: 8,
    targetRepsMax: 12,
    performedAt: t0 + partial.order * 120_000,
    ...partial,
  };
}

function line(
  partial: Partial<CoachExerciseLine> &
    Pick<CoachExerciseLine, 'exerciseId' | 'workoutId' | 'sets'>,
): CoachExerciseLine {
  return {
    workoutStartedAt: t0,
    measurementType: 'weight_reps',
    equipment: 'barbell',
    ...partial,
  };
}

describe('mergeLinesForWorkout', () => {
  it('glues two lines of the same exercise in one workout', () => {
    const a = line({
      exerciseId: 'bench',
      workoutId: 'w1',
      sets: [set({ order: 0, reps: 10 })],
    });
    const b = line({
      exerciseId: 'bench',
      workoutId: 'w1',
      sets: [set({ order: 0, reps: 8 })],
    });
    const merged = mergeLinesForWorkout([a, b]);
    expect(merged).toHaveLength(1);
    expect(merged[0]!.sets).toHaveLength(2);
  });
});

describe('range_completed', () => {
  it('proposes nextLoad when every working set hits targetRepsMax', () => {
    const signals = evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        sets: [
          set({ order: 0, reps: 12, weight: 100 }),
          set({ order: 1, reps: 12, weight: 100 }),
          set({ order: 2, reps: 12, weight: 100 }),
        ],
      }),
    ]);

    expect(signals).toEqual([
      expect.objectContaining({
        code: 'range_completed',
        exerciseId: 'bench',
        nextLoadKg: 102.5,
      }),
    ]);
    expect(signals[0]!.evidence).toEqual(
      expect.arrayContaining([
        { label: 'target_reps_max', value: 12 },
        { label: 'next_load_kg', value: 102.5 },
      ]),
    );
  });

  it('stays silent when one working set misses the top of the range', () => {
    const signals = evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        sets: [
          set({ order: 0, reps: 12 }),
          set({ order: 1, reps: 10 }),
          set({ order: 2, reps: 12 }),
        ],
      }),
    ]);
    expect(signals.filter((s) => s.code === 'range_completed')).toEqual([]);
  });

  it('stays silent without a prescribed range (Hevy imports)', () => {
    const signals = evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        importSource: 'hevy_csv',
        sets: [
          set({ order: 0, reps: 12, targetReps: undefined, targetRepsMax: undefined }),
          set({ order: 1, reps: 12, targetReps: undefined, targetRepsMax: undefined }),
        ],
      }),
    ]);
    expect(signals.filter((s) => s.code === 'range_completed')).toEqual([]);
  });

  it('ignores warm-ups when judging the range', () => {
    const signals = evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        sets: [
          set({ order: 0, reps: 8, weight: 60, setType: 'warmup', targetRepsMax: 12 }),
          set({ order: 1, reps: 12, weight: 100 }),
          set({ order: 2, reps: 12, weight: 100 }),
        ],
      }),
    ]);
    expect(signals[0]).toMatchObject({ code: 'range_completed', nextLoadKg: 102.5 });
  });

  it('lowers assistance on assisted machines', () => {
    const signals = evaluateCoach([
      line({
        exerciseId: 'assist-pull',
        workoutId: 'w1',
        measurementType: 'assisted_weight_reps',
        equipment: 'machine',
        sets: [
          set({ order: 0, reps: 12, weight: 40, targetRepsMax: 12 }),
          set({ order: 1, reps: 12, weight: 40, targetRepsMax: 12 }),
        ],
      }),
    ]);
    expect(signals[0]).toMatchObject({
      code: 'range_completed',
      nextLoadKg: 35,
    });
  });

  it('stays silent on a deload session even if the range is hit', () => {
    const signals = evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        deloadPercent: 80,
        sets: [
          set({ order: 0, reps: 12, weight: 80 }),
          set({ order: 1, reps: 12, weight: 80 }),
        ],
      }),
    ]);
    expect(signals.filter((s) => s.code === 'range_completed')).toEqual([]);
  });
});

describe('intra_session_drop', () => {
  it('reports a rep collapse from the first working set', () => {
    const signals = evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        sets: [
          set({ order: 0, reps: 10, targetRepsMax: 12 }),
          set({ order: 1, reps: 10, targetRepsMax: 12 }),
          set({ order: 2, reps: 6, targetRepsMax: 12 }),
        ],
      }),
    ]);
    expect(signals.some((s) => s.code === 'intra_session_drop')).toBe(true);
    const drop = signals.find((s) => s.code === 'intra_session_drop')!;
    expect(drop.evidence).toEqual(
      expect.arrayContaining([
        { label: 'first_reps', value: 10 },
        { label: 'low_reps', value: 6 },
        { label: 'drop_reps', value: 4 },
      ]),
    );
  });

  it('stays silent for a gentle one-rep fade', () => {
    const signals = evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        sets: [
          set({ order: 0, reps: 10, targetRepsMax: 12 }),
          set({ order: 1, reps: 9, targetRepsMax: 12 }),
        ],
      }),
    ]);
    expect(signals.filter((s) => s.code === 'intra_session_drop')).toEqual([]);
  });
});

describe('long_rest', () => {
  it('fires only when a drop is also present and a rest gap is long', () => {
    const base = t0;
    const withDropAndLongRest = [
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        sets: [
          set({ order: 0, reps: 10, performedAt: base, targetRepsMax: 12 }),
          set({ order: 1, reps: 10, performedAt: base + 90_000, targetRepsMax: 12 }),
          set({ order: 2, reps: 6, performedAt: base + 90_000 + 240_000, targetRepsMax: 12 }),
        ],
      }),
    ];

    const all = collectCoachSignals(withDropAndLongRest);
    expect(all.map((s) => s.code).sort()).toEqual(['intra_session_drop', 'long_rest']);

    // UI surface keeps one signal — the drop outranks the rest note.
    expect(evaluateCoach(withDropAndLongRest).map((s) => s.code)).toEqual([
      'intra_session_drop',
    ]);

    // A long rest alone is not a defect.
    const restOnly = collectCoachSignals([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        sets: [
          set({ order: 0, reps: 10, performedAt: base, targetRepsMax: 12 }),
          set({ order: 1, reps: 10, performedAt: base + 240_000, targetRepsMax: 12 }),
          set({ order: 2, reps: 10, performedAt: base + 480_000, targetRepsMax: 12 }),
        ],
      }),
    ]);
    expect(restOnly.filter((s) => s.code === 'long_rest')).toEqual([]);
  });
});

describe('plateau', () => {
  const session = (
    workoutId: string,
    day: number,
    weight: number,
    reps: number,
    extra: Partial<CoachExerciseLine> = {},
  ): CoachExerciseLine =>
    line({
      exerciseId: 'bench',
      workoutId,
      workoutStartedAt: t0 + day * 86_400_000,
      sets: [
        set({ order: 0, reps, weight, targetRepsMax: 12 }),
        set({ order: 1, reps, weight, targetRepsMax: 12 }),
      ],
      ...extra,
    });

  it('flags N sessions without 1RM progress', () => {
    const signals = evaluateCoach([
      session('w3', 14, 100, 5),
      session('w2', 7, 100, 5),
      session('w1', 0, 100, 5),
    ]);
    expect(signals.some((s) => s.code === 'plateau')).toBe(true);
  });

  it('stays silent with fewer than N sessions of history', () => {
    const signals = evaluateCoach([session('w2', 7, 100, 5), session('w1', 0, 100, 5)]);
    expect(signals.filter((s) => s.code === 'plateau')).toEqual([]);
  });

  it('stays silent when the newest session improves the estimated 1RM', () => {
    const signals = evaluateCoach([
      session('w3', 14, 105, 5),
      session('w2', 7, 100, 5),
      session('w1', 0, 100, 5),
    ]);
    expect(signals.filter((s) => s.code === 'plateau')).toEqual([]);
  });

  it('ignores deload sessions so a cut never looks like a plateau', () => {
    const signals = evaluateCoach([
      session('w4', 21, 80, 5, { deloadPercent: 80 }),
      session('w3', 14, 100, 5),
      session('w2', 7, 100, 5),
      session('w1', 0, 100, 5),
    ]);
    // Newest comparable is still flat at 100×5 across 3 — plateau should fire.
    expect(signals.some((s) => s.code === 'plateau')).toBe(true);

    // Newest deload alone must not invent a plateau from one hard session + deload noise.
    const onlyDeloadNewest = evaluateCoach([
      session('w3', 14, 80, 8, { deloadPercent: 80 }),
      session('w2', 7, 110, 5),
      session('w1', 0, 100, 5),
    ]);
    // Deload skipped → comparable are 110 and 100 (progress) — not enough for N=3.
    expect(onlyDeloadNewest.filter((s) => s.code === 'plateau')).toEqual([]);
  });
});

describe('pickSignals', () => {
  it('keeps one signal per exercise, highest severity first', () => {
    const signals: CoachSignal[] = [
      {
        code: 'long_rest',
        exerciseId: 'bench',
        evidence: [],
        severity: 10,
      },
      {
        code: 'range_completed',
        exerciseId: 'bench',
        nextLoadKg: 102.5,
        evidence: [],
        severity: 40,
      },
      {
        code: 'plateau',
        exerciseId: 'squat',
        evidence: [],
        severity: 30,
      },
    ];
    const picked = pickSignals(signals);
    expect(picked).toHaveLength(2);
    expect(picked.map((s) => s.exerciseId).sort()).toEqual(['bench', 'squat']);
    expect(picked.find((s) => s.exerciseId === 'bench')!.code).toBe('range_completed');
  });
});

describe('mute cases', () => {
  it('stays fully silent on a single incomplete history line with no range hit', () => {
    const signals = evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        sets: [set({ order: 0, reps: 8, targetRepsMax: 12 })],
      }),
    ]);
    expect(signals).toEqual([]);
  });
});
