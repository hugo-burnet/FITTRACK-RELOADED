import { describe, expect, it } from 'vitest';
import { evaluateSituation, situationOfCode, type CoachSituation } from './situation';
import type { CoachExerciseLine, CoachSignalCode } from './types';

const DAY = 86_400_000;
const t0 = Date.UTC(2026, 7, 1, 10);

interface SessionSpec {
  workoutId: string;
  /** Days since `t0`. */
  day: number;
  reps: number[];
  weight?: number;
  target?: [number, number?];
  rpe?: number[];
  /** Gap between two sets, in ms. */
  restMs?: number;
}

function session(spec: SessionSpec): CoachExerciseLine {
  const start = t0 + spec.day * DAY;
  return {
    exerciseId: 'bench',
    workoutId: spec.workoutId,
    workoutStartedAt: start,
    measurementType: 'weight_reps',
    equipment: 'barbell',
    sets: spec.reps.map((reps, order) => ({
      setType: 'normal',
      isCompleted: 1,
      reps,
      weight: spec.weight ?? 100,
      targetReps: spec.target?.[0],
      targetRepsMax: spec.target?.[1],
      rpe: spec.rpe?.[order],
      performedAt: start + (order + 1) * (spec.restMs ?? 120_000),
      order,
    })),
  };
}

/** Latest session first in the call, history oldest-last like the engine expects. */
function situationAfter(latest: CoachExerciseLine, ...history: CoachExerciseLine[]): CoachSituation {
  return evaluateSituation(latest, history);
}

/**
 * Typed as a `Record` on purpose: adding a signal code to `CoachSignalCode`
 * fails the typecheck here until someone decides which situation it belongs to.
 */
const SITUATION_OF_CODE: Record<CoachSignalCode, CoachSituation> = {
  returning: 'returning',
  range_missed: 'floor_missed',
  range_ceiling_reached: 'ceiling_reached',
  range_completed: 'ceiling_reached',
  consolidating: 'consolidating',
  range_satisfied: 'in_range',
  plateau: 'plateau',
  intra_session_drop: 'rep_drop',
  long_rest: 'rep_drop',
  benchmark_calibrated: 'calibrated',
};

describe('situationOfCode', () => {
  it.each(Object.entries(SITUATION_OF_CODE))('%s reads as %s', (code, situation) => {
    expect(situationOfCode(code as CoachSignalCode)).toBe(situation);
  });

  it('reads no code as « nothing to say »', () => {
    expect(situationOfCode(undefined)).toBe('no_signal');
  });

  it('keeps the old journal alias and the new code in the same situation', () => {
    expect(situationOfCode('range_completed')).toBe(situationOfCode('range_ceiling_reached'));
  });
});

describe('evaluateSituation — one case per situation', () => {
  it('ceiling_reached: every set at the top of the range', () => {
    expect(
      situationAfter(session({ workoutId: 'w1', day: 0, reps: [12, 12, 12], target: [8, 12] })),
    ).toBe('ceiling_reached');
  });

  it('in_range: the range held, the ceiling not reached', () => {
    expect(
      situationAfter(session({ workoutId: 'w1', day: 0, reps: [12, 12, 10], target: [8, 12] })),
    ).toBe('in_range');
  });

  it('floor_missed: the floor missed twice at the same load', () => {
    const before = session({ workoutId: 'w1', day: 0, reps: [12, 12, 11], weight: 70, target: [12, 15] });
    const latest = session({ workoutId: 'w2', day: 7, reps: [12, 12, 11], weight: 70, target: [12, 15] });
    expect(situationAfter(latest, before)).toBe('floor_missed');
  });

  it('returning: the first session after 14 days or more, even at the ceiling', () => {
    const before = session({ workoutId: 'w1', day: 0, reps: [12, 12, 12], weight: 70, target: [10, 12] });
    const latest = session({ workoutId: 'w2', day: 21, reps: [12, 12, 12], weight: 70, target: [10, 12] });
    expect(situationAfter(latest, before)).toBe('returning');
  });

  it('is not returning one day short of the threshold', () => {
    const before = session({ workoutId: 'w1', day: 0, reps: [12, 12, 12], weight: 70, target: [10, 12] });
    const latest = session({ workoutId: 'w2', day: 13, reps: [12, 12, 12], weight: 70, target: [10, 12] });
    expect(situationAfter(latest, before)).toBe('ceiling_reached');
  });

  it('plateau: three sessions with no progress on the estimated 1RM', () => {
    const a = session({ workoutId: 'w1', day: 0, reps: [8, 8, 8], weight: 100 });
    const b = session({ workoutId: 'w2', day: 7, reps: [8, 8, 8], weight: 100 });
    const c = session({ workoutId: 'w3', day: 14, reps: [8, 8, 8], weight: 100 });
    expect(situationAfter(c, b, a)).toBe('plateau');
  });

  it('plateau also covers a clear decline: the engine has no separate regression', () => {
    const a = session({ workoutId: 'w1', day: 0, reps: [8, 8, 8], weight: 105 });
    const b = session({ workoutId: 'w2', day: 7, reps: [8, 8, 8], weight: 100 });
    const c = session({ workoutId: 'w3', day: 14, reps: [8, 8, 8], weight: 95 });
    expect(situationAfter(c, b, a)).toBe('plateau');
  });

  it('rep_drop: reps fell by two or more inside the session', () => {
    expect(situationAfter(session({ workoutId: 'w1', day: 0, reps: [15, 13], weight: 30 }))).toBe(
      'rep_drop',
    );
  });

  it('rep_drop: a long rest never shows up as a situation of its own', () => {
    expect(
      situationAfter(
        session({ workoutId: 'w1', day: 0, reps: [15, 13], weight: 30, restMs: 200_000 }),
      ),
    ).toBe('rep_drop');
  });

  it('consolidating: same load, same reps, effort down by half a point', () => {
    const before = session({
      workoutId: 'w1',
      day: 0,
      reps: [11, 11, 11],
      target: [10, 12],
      rpe: [9, 9, 9],
    });
    const latest = session({
      workoutId: 'w2',
      day: 7,
      reps: [11, 11, 11],
      target: [10, 12],
      rpe: [8.5, 8.5, 8.5],
    });
    expect(situationAfter(latest, before)).toBe('consolidating');
  });

  it('no_signal: a free session without a prescribed range has nothing to compare', () => {
    expect(situationAfter(session({ workoutId: 'w1', day: 0, reps: [10, 10, 10] }))).toBe(
      'no_signal',
    );
  });
});
