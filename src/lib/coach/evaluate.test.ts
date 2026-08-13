import { describe, expect, it } from 'vitest';
import {
  collectCoachSignals,
  evaluateCoach,
  evaluatePerformance,
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

/** 3×8–12 helper for the exclusive range partition contracts (spec §10). */
function line3x8to12(reps: number[]): CoachExerciseLine {
  return line({
    exerciseId: 'bench',
    workoutId: 'w1',
    sets: reps.map((value, order) =>
      set({ order, reps: value, weight: 100, targetReps: 8, targetRepsMax: 12 }),
    ),
  });
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

describe('evaluatePerformance — exclusive range partition + allowedActions', () => {
  it('12/12/10 is satisfied only', () => {
    const ev = evaluatePerformance(line3x8to12([12, 12, 10]));
    expect(ev.signals.map((s) => s.code)).toEqual(['range_satisfied']);
    expect(ev.allowedActions.sort()).toEqual(['increase_reps', 'maintain'].sort());
  });

  it('12/12/12 is ceiling only', () => {
    const ev = evaluatePerformance(line3x8to12([12, 12, 12]));
    expect(ev.signals.map((s) => s.code)).toContain('range_ceiling_reached');
    expect(ev.signals.map((s) => s.code)).not.toContain('range_satisfied');
    expect(ev.allowedActions).toContain('increase_load');
    expect(ev.allowedActions).not.toContain('increase_reps');
  });

  it('10/10/9 is satisfied only (mid-range, exclusive)', () => {
    const ev = evaluatePerformance(line3x8to12([10, 10, 9]));
    expect(ev.signals.map((s) => s.code)).toEqual(['range_satisfied']);
    expect(ev.allowedActions).not.toContain('increase_load');
  });

  it('12/12/7 emits neither range signal', () => {
    const ev = evaluatePerformance(line3x8to12([12, 12, 7]));
    expect(ev.signals.map((s) => s.code)).not.toContain('range_satisfied');
    expect(ev.signals.map((s) => s.code)).not.toContain('range_ceiling_reached');
  });

  it('plateau strips add_set as well as increase_*', () => {
    const ceilingSession = (workoutId: string, day: number): CoachExerciseLine =>
      line({
        exerciseId: 'bench',
        workoutId,
        workoutStartedAt: t0 + day * 86_400_000,
        sets: [
          set({ order: 0, reps: 12, weight: 100, performedAt: t0 + day * 86_400_000 }),
          set({
            order: 1,
            reps: 12,
            weight: 100,
            performedAt: t0 + day * 86_400_000 + 120_000,
          }),
          set({
            order: 2,
            reps: 12,
            weight: 100,
            performedAt: t0 + day * 86_400_000 + 240_000,
          }),
        ],
      });

    const latest = ceilingSession('w3', 14);
    const history = [ceilingSession('w2', 7), ceilingSession('w1', 0)];
    const ev = evaluatePerformance(latest, history);

    expect(ev.signals.some((s) => s.code === 'plateau')).toBe(true);
    expect(ev.signals.some((s) => s.code === 'range_ceiling_reached')).toBe(true);
    expect(ev.allowedActions).toEqual(['maintain']);
  });
});

describe('range_ceiling_reached (was range_completed)', () => {
  it('proposes nextLoad when every working set hits the ceiling', () => {
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
        code: 'range_ceiling_reached',
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

  it('emits range_satisfied (not ceiling) when one set is under the top', () => {
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
    expect(signals.filter((s) => s.code === 'range_ceiling_reached')).toEqual([]);
    expect(signals.filter((s) => s.code === 'range_completed')).toEqual([]);
    expect(signals.map((s) => s.code)).toEqual(['range_satisfied']);
  });

  it('treats a single-target hit as ceiling (no open range)', () => {
    const signals = evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        sets: [
          set({ order: 0, reps: 8, targetReps: 8, targetRepsMax: undefined }),
          set({ order: 1, reps: 8, targetReps: 8, targetRepsMax: undefined }),
        ],
      }),
    ]);
    expect(signals[0]).toMatchObject({ code: 'range_ceiling_reached' });
    expect(signals.map((s) => s.code)).not.toContain('range_satisfied');
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
    expect(signals.filter((s) => s.code === 'range_ceiling_reached')).toEqual([]);
    expect(signals.filter((s) => s.code === 'range_satisfied')).toEqual([]);
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
    expect(signals[0]).toMatchObject({ code: 'range_ceiling_reached', nextLoadKg: 102.5 });
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
      code: 'range_ceiling_reached',
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
    expect(signals.filter((s) => s.code === 'range_ceiling_reached')).toEqual([]);
    expect(signals.filter((s) => s.code === 'range_satisfied')).toEqual([]);
  });

  it('treats a programmed deload as authoritative without a manual percentage', () => {
    const signals = evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        programIsDeload: 1,
        sets: [
          set({ order: 0, reps: 12, weight: 80 }),
          set({ order: 1, reps: 12, weight: 80 }),
        ],
      }),
    ]);
    expect(signals.filter((s) => s.code === 'range_ceiling_reached')).toEqual([]);
  });
});

describe('range_missed', () => {
  const missedSession = (workoutId: string, startedAt: number, weight: number) =>
    line({
      exerciseId: 'bench',
      workoutId,
      workoutStartedAt: startedAt,
      sets: [
        set({ order: 0, reps: 7, weight, performedAt: startedAt }),
        set({ order: 1, reps: 6, weight, performedAt: startedAt + 120_000 }),
      ],
    });

  it('backs off one increment after two sessions under the floor at the same load', () => {
    const signals = evaluateCoach([
      missedSession('w1', t0, 80),
      missedSession('w2', t0 + 3 * 86_400_000, 80),
    ]);

    expect(signals).toEqual([
      expect.objectContaining({ code: 'range_missed', exerciseId: 'bench', nextLoadKg: 77.5 }),
    ]);
    expect(signals[0]!.evidence).toEqual(
      expect.arrayContaining([
        { label: 'sessions', value: 2 },
        { label: 'target_reps', value: 8 },
        { label: 'current_load_kg', value: 80 },
        { label: 'next_load_kg', value: 77.5 },
      ]),
    );
  });

  it('stays silent after a single bad day', () => {
    const signals = evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        workoutStartedAt: t0,
        sets: [set({ order: 0, reps: 10, weight: 80, performedAt: t0 })],
      }),
      missedSession('w2', t0 + 3 * 86_400_000, 80),
    ]);
    expect(signals.filter((s) => s.code === 'range_missed')).toEqual([]);
  });

  it('stays silent when the two misses are not at the same load', () => {
    const signals = evaluateCoach([
      missedSession('w1', t0, 85),
      missedSession('w2', t0 + 3 * 86_400_000, 80),
    ]);
    expect(signals.filter((s) => s.code === 'range_missed')).toEqual([]);
  });

  it('does not read a deload session as a failure', () => {
    const signals = evaluateCoach([
      missedSession('w1', t0, 80),
      { ...missedSession('w2', t0 + 3 * 86_400_000, 64), deloadPercent: 80 },
    ]);
    expect(signals.filter((s) => s.code === 'range_missed')).toEqual([]);
  });

  it('adds assistance instead of removing it on an assisted machine', () => {
    const assisted = (workoutId: string, startedAt: number) => ({
      ...missedSession(workoutId, startedAt, 40),
      measurementType: 'assisted_weight_reps' as const,
      equipment: 'machine' as const,
    });

    const signals = evaluateCoach([
      assisted('w1', t0),
      assisted('w2', t0 + 3 * 86_400_000),
    ]);
    expect(signals[0]).toMatchObject({ code: 'range_missed', nextLoadKg: 45 });
  });

  it('outranks the rep drop it necessarily comes with', () => {
    const signals = evaluateCoach([
      missedSession('w1', t0, 80),
      line({
        exerciseId: 'bench',
        workoutId: 'w2',
        workoutStartedAt: t0 + 3 * 86_400_000,
        sets: [
          set({ order: 0, reps: 12, weight: 80, performedAt: t0 + 3 * 86_400_000 }),
          set({ order: 1, reps: 5, weight: 80, performedAt: t0 + 3 * 86_400_000 + 120_000 }),
        ],
      }),
    ]);
    // One signal per exercise, and it is the actionable one.
    expect(signals.map((s) => s.code)).toEqual(['range_missed']);
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

  it('stays silent on drop when the fading set is still inside the range', () => {
    // Terrain, 2026-08-12 : 80×12, 12, 12, 10 sur une fourchette 8–12. Rien
    // n'est tombé sous la prescription — pas de chute, mais range_satisfied oui.
    const signals = evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        sets: [
          set({ order: 0, reps: 12, weight: 80 }),
          set({ order: 1, reps: 12, weight: 80 }),
          set({ order: 2, reps: 12, weight: 80 }),
          set({ order: 3, reps: 10, weight: 80 }),
        ],
      }),
    ]);
    expect(signals.filter((s) => s.code === 'intra_session_drop')).toEqual([]);
    expect(signals.map((s) => s.code)).toEqual(['range_satisfied']);
  });

  it('still reports a set that falls through the floor of the range', () => {
    const signals = evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        sets: [
          set({ order: 0, reps: 12, weight: 80 }),
          set({ order: 1, reps: 12, weight: 80 }),
          set({ order: 2, reps: 7, weight: 80 }),
        ],
      }),
    ]);
    expect(signals.map((s) => s.code)).toEqual(['intra_session_drop']);
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
        // No prescribed range: plateau is a 1RM reading. An open 8–12 contract
        // at 5+ reps would now emit `range_satisfied` (severity 35) and hide
        // plateau (30) under pickSignals — which is correct ranking, but not
        // what this block is testing.
        set({
          order: 0,
          reps,
          weight,
          targetReps: undefined,
          targetRepsMax: undefined,
        }),
        set({
          order: 1,
          reps,
          weight,
          targetReps: undefined,
          targetRepsMax: undefined,
        }),
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
        code: 'range_ceiling_reached',
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
    expect(picked.find((s) => s.exerciseId === 'bench')!.code).toBe('range_ceiling_reached');
  });
});

describe('mute cases', () => {
  it('stays fully silent when the floor is missed once and nothing else fires', () => {
    // One set under the floor: not satisfied, not ceiling, single miss ≠ range_missed.
    const signals = evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        sets: [set({ order: 0, reps: 6, targetReps: 8, targetRepsMax: 12 })],
      }),
    ]);
    expect(signals).toEqual([]);
  });
});
