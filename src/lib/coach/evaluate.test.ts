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

  it('plateau strips escalation: a flat satisfied range loses increase_reps', () => {
    const satisfiedSession = (workoutId: string, day: number): CoachExerciseLine =>
      line({
        exerciseId: 'bench',
        workoutId,
        workoutStartedAt: t0 + day * 86_400_000,
        sets: [0, 1, 2].map((order) =>
          set({
            order,
            reps: 10,
            weight: 100,
            performedAt: t0 + day * 86_400_000 + order * 120_000,
          }),
        ),
      });

    const latest = satisfiedSession('w3', 14);
    const history = [satisfiedSession('w2', 7), satisfiedSession('w1', 0)];
    const ev = evaluatePerformance(latest, history);

    expect(ev.signals.some((s) => s.code === 'plateau')).toBe(true);
    expect(ev.signals.some((s) => s.code === 'range_satisfied')).toBe(true);
    expect(ev.allowedActions).toEqual(['maintain']);
  });

  it('consolider n’est pas stagner : trois plafonds à la même charge autorisent la hausse', () => {
    // Ce test affirmait l'inverse — plafond + plateau → maintien. C'était le
    // défaut : une séance plafonnée ne peut pas faire monter le 1RM estimé, donc
    // trois séances bien faites passaient pour un plateau, et le plateau
    // interdisait la hausse qu'elles préparaient.
    const ceilingSession = (workoutId: string, day: number): CoachExerciseLine =>
      line({
        exerciseId: 'bench',
        workoutId,
        workoutStartedAt: t0 + day * 86_400_000,
        sets: [0, 1, 2].map((order) =>
          set({
            order,
            reps: 12,
            weight: 100,
            performedAt: t0 + day * 86_400_000 + order * 120_000,
          }),
        ),
      });

    const latest = ceilingSession('w3', 14);
    const history = [ceilingSession('w2', 7), ceilingSession('w1', 0)];
    const ev = evaluatePerformance(latest, history);

    expect(ev.signals.map((s) => s.code)).toEqual(['range_ceiling_reached']);
    expect(ev.allowedActions).toContain('increase_load');
    expect(ev.allowedActions).toContain('add_set');
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

  it('ne propose jamais plus d’un incrément depuis un demi-pas machine', () => {
    // Oiseau à la machine, 12,5 kg × 15 sur 12–15, pas machine par défaut 5 kg.
    // Le coach proposait 20 kg trois séances de suite.
    const signals = evaluateCoach([
      line({
        exerciseId: 'reverse-fly',
        workoutId: 'w1',
        equipment: 'machine',
        sets: [
          set({ order: 0, reps: 15, weight: 12.5, targetReps: 12, targetRepsMax: 15 }),
          set({ order: 1, reps: 15, weight: 12.5, targetReps: 12, targetRepsMax: 15 }),
        ],
      }),
    ]);
    expect(signals[0]).toMatchObject({ code: 'range_ceiling_reached', nextLoadKg: 15 });
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

  // Séance réelle du 23/08/2026 : élévations latérales 5 kg × 15, 5 kg × 11
  // (échec), puis dégressive 3,5 kg × 15. Le coach annonçait « 3,5 → 0 kg » —
  // la charge de la dégressive prise pour la charge de travail, puis un pas de
  // 2,5 kg retombant sur zéro. Deux défauts, un seul écran.
  const lateralRaise = (
    workoutId: string,
    startedAt: number,
    secondSetType: 'failure' | 'normal' = 'failure',
  ) =>
    line({
      exerciseId: 'lateral-raise',
      workoutId,
      workoutStartedAt: startedAt,
      equipment: 'cable',
      sets: [
        set({
          order: 0,
          reps: 15,
          weight: 5,
          targetReps: 12,
          targetRepsMax: 15,
          performedAt: startedAt,
        }),
        set({
          order: 1,
          reps: 11,
          weight: 5,
          setType: secondSetType,
          targetReps: 12,
          targetRepsMax: 15,
          performedAt: startedAt + 120_000,
        }),
        set({
          order: 2,
          reps: 15,
          weight: 3.5,
          setType: 'dropset',
          targetReps: 12,
          targetRepsMax: 15,
          performedAt: startedAt + 240_000,
        }),
      ],
    });

  it('lit la séance réelle sur sa charge du haut, sans juger la série à l’échec', () => {
    // Coach v2, R2 : le 5 × 11 est la série poussée à l'échec, il ne juge plus le
    // bas de fourchette. Ce test attendait « 5 → 2,5 kg » sur sa foi — le −50 %
    // que l'utilisateur avait écarté. Reste le sujet d'origine : la charge de
    // référence est celle du haut (5 kg), jamais celle de la dégressive.
    const signals = evaluateCoach([
      lateralRaise('w1', t0),
      lateralRaise('w2', t0 + 3 * 86_400_000),
    ]);
    // Et le plafond non plus : le 5 × 15 l'atteint, la série à l'échec à 11 non.
    expect(signals.map((signal) => signal.code)).toEqual(['range_satisfied']);
  });

  it('backs off from the top load, not from the drop set that ended the session', () => {
    const signals = evaluateCoach([
      lateralRaise('w1', t0, 'normal'),
      lateralRaise('w2', t0 + 3 * 86_400_000, 'normal'),
    ]);

    expect(signals).toEqual([
      expect.objectContaining({
        code: 'range_missed',
        exerciseId: 'lateral-raise',
        nextLoadKg: 2.5,
      }),
    ]);
    expect(signals[0]!.evidence).toEqual(
      expect.arrayContaining([
        { label: 'current_load_kg', value: 5 },
        { label: 'next_load_kg', value: 2.5 },
      ]),
    );
  });

  it('states the miss without a figure when one increment down lands at zero', () => {
    const tooLightToBackOff = (workoutId: string, startedAt: number) =>
      line({
        exerciseId: 'lateral-raise',
        workoutId,
        workoutStartedAt: startedAt,
        equipment: 'cable',
        sets: [
          set({
            order: 0,
            reps: 9,
            weight: 3.5,
            targetReps: 12,
            targetRepsMax: 15,
            performedAt: startedAt,
          }),
        ],
      });

    const signals = evaluateCoach([
      tooLightToBackOff('w1', t0),
      tooLightToBackOff('w2', t0 + 3 * 86_400_000),
    ]);

    const missed = signals.find((signal) => signal.code === 'range_missed');
    expect(missed).toBeDefined();
    expect(missed!.nextLoadKg).toBeUndefined();
    expect(missed!.evidence.map((item) => item.label)).not.toContain('next_load_kg');
    expect(missed!.evidence).toEqual(
      expect.arrayContaining([{ label: 'current_load_kg', value: 3.5 }]),
    );
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

// Le signal s'appelle `range_ceiling_reached` depuis le Lot 17 ; `range_completed`
// n'est plus qu'un alias de lecture pour les lignes de journal déjà écrites. Ce
// test vient d'une branche antérieure au renommage : c'est le nom qui a bougé,
// pas le comportement — les deux séries prescrites sont jugées, le drop set non.
describe('range_ceiling_reached — drop sets', () => {
  it('judges the range on the prescribed sets, not on a trailing drop set', () => {
    const signals = evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        sets: [
          set({ order: 0, reps: 12, weight: 100 }),
          set({ order: 1, reps: 12, weight: 100 }),
          set({ order: 2, reps: 8, weight: 70, setType: 'dropset' }),
        ],
      }),
    ]);
    expect(signals).toEqual([
      expect.objectContaining({ code: 'range_ceiling_reached', nextLoadKg: 102.5 }),
    ]);
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

  it('ignores a deliberate drop set — fewer reps at a lighter load is the point', () => {
    const signals = evaluateCoach([
      line({
        exerciseId: 'curl',
        workoutId: 'w1',
        sets: [
          set({ order: 0, reps: 10, weight: 40, targetRepsMax: 12 }),
          set({ order: 1, reps: 10, weight: 40, targetRepsMax: 12 }),
          set({ order: 2, reps: 6, weight: 25, setType: 'dropset', targetRepsMax: 12 }),
        ],
      }),
    ]);
    expect(signals.filter((s) => s.code === 'intra_session_drop')).toEqual([]);
  });

  it('ignores a back-off set typed normal but loaded lighter', () => {
    const signals = evaluateCoach([
      line({
        exerciseId: 'squat',
        workoutId: 'w1',
        sets: [
          set({ order: 0, reps: 5, weight: 120, targetRepsMax: 12 }),
          set({ order: 1, reps: 3, weight: 90, targetRepsMax: 12 }),
        ],
      }),
    ]);
    expect(signals.filter((s) => s.code === 'intra_session_drop')).toEqual([]);
  });

  it('ignores a pyramid — the bar went up, the reps followed it down', () => {
    // Terrain : 100 × 10 puis 110 × 6. La charge a monté de dix kilos, et le
    // coach répondait « Baisse de reps observée : 10 puis 6 ». Une progression
    // annoncée comme une régression.
    const signals = evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        sets: [
          set({ order: 0, reps: 10, weight: 100, targetReps: 6, targetRepsMax: 12 }),
          set({ order: 1, reps: 6, weight: 110, targetReps: 6, targetRepsMax: 12 }),
        ],
      }),
    ]);
    expect(signals.filter((s) => s.code === 'intra_session_drop')).toEqual([]);
  });

  it('compare une série à la première du même palier, pas à celle d’avant', () => {
    const signals = evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        sets: [
          set({ order: 0, reps: 10, weight: 100, targetReps: 5, targetRepsMax: 12 }),
          set({ order: 1, reps: 8, weight: 110, targetReps: 5, targetRepsMax: 12 }),
          set({ order: 2, reps: 3, weight: 110, targetReps: 5, targetRepsMax: 12 }),
        ],
      }),
    ]);
    const drop = signals.find((s) => s.code === 'intra_session_drop');
    expect(drop?.evidence).toEqual(
      expect.arrayContaining([
        { label: 'first_reps', value: 8 },
        { label: 'low_reps', value: 3 },
        { label: 'drop_reps', value: 5 },
      ]),
    );
  });

  it('still reports a collapse at the same load', () => {
    const signals = evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        sets: [
          set({ order: 0, reps: 10, weight: 100, targetRepsMax: 12 }),
          set({ order: 1, reps: 6, weight: 100, targetRepsMax: 12 }),
        ],
      }),
    ]);
    expect(signals.some((s) => s.code === 'intra_session_drop')).toBe(true);
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

  describe('séances plafonnées', () => {
    const rowing = (
      workoutId: string,
      day: number,
      reps: number[],
      range: { targetReps?: number; targetRepsMax?: number } = { targetReps: 10, targetRepsMax: 12 },
    ): CoachExerciseLine =>
      line({
        exerciseId: 'row',
        workoutId,
        workoutStartedAt: t0 + day * 86_400_000,
        equipment: 'machine',
        sets: reps.map((value, order) =>
          set({ order, reps: value, weight: 70, performedAt: t0 + day * 86_400_000 + order * 120_000, ...range }),
        ),
      });

    it('ne lit pas une consolidation comme un plateau, même suivie d’une séance sans cible', () => {
      // Rowing buste appuyé, historique réel : 70 kg tenu, RPE en baisse. La
      // dernière séance vient d'une routine sans cible — le coach y affichait
      // « Plateau » sur la foi des deux plafonds d'avant.
      const signals = evaluateCoach([
        rowing('w4', 21, [12, 12, 12], { targetReps: undefined, targetRepsMax: undefined }),
        rowing('w3', 14, [12, 12, 12]),
        rowing('w2', 7, [12, 12, 12]),
        rowing('w1', 0, [12, 11, 11]),
      ]);
      expect(signals.filter((s) => s.code === 'plateau')).toEqual([]);
    });

    it('ne masque pas un plafond tout juste atteint par les séances plates d’avant', () => {
      const signals = evaluateCoach([
        rowing('w4', 21, [12, 12, 12]),
        rowing('w3', 14, [10, 10, 10]),
        rowing('w2', 7, [10, 10, 10]),
        rowing('w1', 0, [10, 10, 10]),
      ]);
      expect(signals).toEqual([
        expect.objectContaining({ code: 'range_ceiling_reached', nextLoadKg: 75 }),
      ]);
    });

    it('garde le plateau quand la fourchette n’est jamais atteinte', () => {
      const signals = evaluateCoach([
        rowing('w3', 14, [10, 10, 10]),
        rowing('w2', 7, [10, 10, 10]),
        rowing('w1', 0, [10, 10, 10]),
      ]);
      expect(signals.map((s) => s.code)).toEqual(['range_satisfied']);
      expect(collectCoachSignals([
        rowing('w3', 14, [10, 10, 10]),
        rowing('w2', 7, [10, 10, 10]),
        rowing('w1', 0, [10, 10, 10]),
      ]).some((s) => s.code === 'plateau')).toBe(true);
    });
  });

  it('ne parle pas de plateau quand la barre s’est alourdie', () => {
    // 100 × 10 → 105 × 8 → 110 × 6 : le 1RM estimé recule d’un kilo (133,3 →
    // 133 → 132) alors que dix kilos sont montés sur la barre. Le modèle dit
    // « rien ne bouge », le fait dit le contraire — et c'est le fait qui compte.
    const signals = evaluateCoach([
      session('w3', 14, 110, 6),
      session('w2', 7, 105, 8),
      session('w1', 0, 100, 10),
    ]);
    expect(signals.filter((s) => s.code === 'plateau')).toEqual([]);
  });

  it('ne parle pas de plateau sur un record de répétitions au-delà de 12', () => {
    // Oiseau à la machine, historique réel : 12,5 × 12, 12,5 × 12, puis 12,5 × 13
    // et 12,5 × 11. Le 1RM estimé ignore la série à 13 et ne juge que celle à 11.
    const twoSets = (workoutId: string, day: number, reps: [number, number]) =>
      line({
        exerciseId: 'reverse-fly',
        workoutId,
        workoutStartedAt: t0 + day * 86_400_000,
        equipment: 'machine',
        sets: reps.map((value, order) =>
          set({ order, reps: value, weight: 12.5, targetReps: undefined, targetRepsMax: undefined }),
        ),
      });
    const signals = evaluateCoach([
      twoSets('w3', 14, [13, 11]),
      twoSets('w2', 7, [12, 12]),
      twoSets('w1', 0, [12, 12]),
    ]);
    expect(signals.filter((s) => s.code === 'plateau')).toEqual([]);
  });

  it('garde le plateau quand la charge, elle non plus, ne bouge pas', () => {
    const signals = evaluateCoach([
      session('w3', 14, 100, 5),
      session('w2', 7, 100, 6),
      session('w1', 0, 100, 6),
    ]);
    expect(signals.some((s) => s.code === 'plateau')).toBe(true);
  });

  /**
   * On an assisted machine the figure goes *down* as you get stronger, and the
   * estimated 1RM of an assistance load is not a strength. Without a bodyweight
   * to subtract there is nothing honest to compare, so the rule says nothing.
   */
  it('stays silent on assisted machines, where progress lowers the number', () => {
    const assisted = [30, 25, 20].map((assistKg, index) =>
      line({
        exerciseId: 'pullup',
        workoutId: `w${index}`,
        workoutStartedAt: t0 + index * 86_400_000,
        measurementType: 'assisted_weight_reps',
        equipment: 'machine',
        sets: [
          set({ order: 0, reps: 8, weight: assistKg, targetRepsMax: undefined }),
          set({ order: 1, reps: 8, weight: assistKg, targetRepsMax: undefined }),
        ],
      }),
    );
    expect(evaluateCoach(assisted).filter((s) => s.code === 'plateau')).toEqual([]);
  });

  it('stays silent on assisted machines even when the assistance is flat', () => {
    const stuck = [20, 20, 20].map((assistKg, index) =>
      line({
        exerciseId: 'pullup',
        workoutId: `w${index}`,
        workoutStartedAt: t0 + index * 86_400_000,
        measurementType: 'assisted_weight_reps',
        equipment: 'machine',
        sets: [set({ order: 0, reps: 8, weight: assistKg, targetRepsMax: undefined })],
      }),
    );
    expect(evaluateCoach(stuck).filter((s) => s.code === 'plateau')).toEqual([]);
  });
});

describe('séries à l’échec (R2)', () => {
  const failing = (
    workoutId: string,
    dayIndex: number,
    sets: { reps: number; failure?: boolean; weight?: number }[],
    range: { targetReps?: number; targetRepsMax?: number } = { targetReps: 12, targetRepsMax: 15 },
  ): CoachExerciseLine =>
    line({
      exerciseId: 'fly',
      workoutId,
      workoutStartedAt: t0 + dayIndex * 86_400_000,
      equipment: 'cable',
      sets: sets.map((value, order) =>
        set({
          order,
          reps: value.reps,
          weight: value.weight ?? 10,
          setType: value.failure ? 'failure' : 'normal',
          performedAt: t0 + dayIndex * 86_400_000 + order * 120_000,
          ...range,
        }),
      ),
    });

  it('ne lit pas une série poussée à l’échec comme une baisse de reps', () => {
    // Pec fly, historique réel : 10 × 12 @8,5 puis F 10 × 8 @9,5 — « Baisse de
    // reps observée » trois séances de suite, sur une série faite pour ça.
    const ev = evaluatePerformance(
      failing('w1', 0, [{ reps: 12 }, { reps: 8, failure: true }], { targetReps: 12, targetRepsMax: 15 }),
    );
    expect(ev.signals.map((s) => s.code)).not.toContain('intra_session_drop');
  });

  it('ne compte pas la série à l’échec dans le bas de fourchette manqué', () => {
    // Élévations latérales : 5 × 12 · F 5 × 10 deux fois sur 12–15 → le coach
    // proposait 5 → 2,5 kg (−50 %) sur la foi de la seule série à l'échec.
    const history = [failing('w1', 0, [{ reps: 12, weight: 5 }, { reps: 10, weight: 5, failure: true }])];
    const ev = evaluatePerformance(
      failing('w2', 7, [{ reps: 12, weight: 5 }, { reps: 10, weight: 5, failure: true }]),
      history,
    );
    expect(ev.signals.map((s) => s.code)).not.toContain('range_missed');
    expect(ev.signals.map((s) => s.code)).toContain('range_satisfied');
  });

  it('se tait sur la fourchette quand toutes les séries sont à l’échec', () => {
    const ev = evaluatePerformance(
      failing('w1', 0, [{ reps: 15, failure: true }, { reps: 9, failure: true }]),
    );
    expect(ev.signals.map((s) => s.code)).toEqual([]);
  });

  it('ne déclare pas de plafond quand la série à l’échec reste sous le haut', () => {
    // Pec fly, 2026-09-01 : 5 × 15 puis F 5 × 14 sur 12–15. Le premier rejeu de
    // R2 y lisait un plafond ; l'utilisateur : « je plafonne pas sur le pec fly ».
    const ev = evaluatePerformance(failing('w1', 0, [{ reps: 15 }, { reps: 14, failure: true }]));
    expect(ev.signals.map((s) => s.code)).toEqual(['range_satisfied']);
    expect(ev.allowedActions).not.toContain('increase_load');
  });

  it('signale la marge d’une série à l’échec au-delà du plafond, sans changer la partition', () => {
    // Décision Q5 : une information, pas un plafond de plus.
    const ev = evaluatePerformance(
      failing('w1', 0, [{ reps: 15 }, { reps: 15 }, { reps: 18, failure: true }]),
    );
    const ceiling = ev.signals.find((s) => s.code === 'range_ceiling_reached');
    expect(ceiling?.evidence).toContainEqual({ label: 'failure_reps_over_ceiling', value: 3 });

    const satisfied = evaluatePerformance(
      failing('w1', 0, [{ reps: 13 }, { reps: 13 }, { reps: 16, failure: true }]),
    );
    expect(satisfied.signals.map((s) => s.code)).toEqual(['range_satisfied']);
    expect(satisfied.signals[0]!.evidence).toContainEqual({
      label: 'failure_reps_over_ceiling',
      value: 1,
    });
  });

  it('laisse le plateau lire les séries à l’échec, les mieux mesurées', () => {
    const flat = (workoutId: string, dayIndex: number) =>
      failing(workoutId, dayIndex, [{ reps: 10 }, { reps: 11, failure: true }], {
        targetReps: undefined,
        targetRepsMax: undefined,
      });
    const signals = evaluateCoach([flat('w3', 14), flat('w2', 7), flat('w1', 0)]);
    expect(signals.map((s) => s.code)).toEqual(['plateau']);
    expect(signals[0]!.evidence).toContainEqual({ label: 'best_1rm_kg', value: 13.7 });
  });
});

describe('pas de charge déduit de l’historique (R3.1)', () => {
  const machine = (
    workoutId: string,
    dayIndex: number,
    weight: number,
    reps: number,
    extra: Partial<CoachExerciseLine> = {},
  ): CoachExerciseLine =>
    line({
      exerciseId: 'leg-curl',
      workoutId,
      workoutStartedAt: t0 + dayIndex * 86_400_000,
      equipment: 'machine',
      sets: [0, 1].map((order) =>
        set({
          order,
          reps,
          weight,
          targetReps: 10,
          targetRepsMax: 12,
          performedAt: t0 + dayIndex * 86_400_000 + order * 120_000,
        }),
      ),
      ...extra,
    });

  it('monte du pas que la salle permet, et le dit', () => {
    const ev = evaluatePerformance(machine('w3', 14, 15, 12), [
      machine('w2', 7, 12.5, 11),
      machine('w1', 0, 10, 12),
    ]);
    const ceiling = ev.signals.find((s) => s.code === 'range_ceiling_reached');
    expect(ceiling?.nextLoadKg).toBe(17.5);
    expect(ceiling?.evidence).toContainEqual({ label: 'inferred_increment_kg', value: 2.5 });
  });

  it('laisse le réglage de l’exercice primer sur le pas déduit', () => {
    const ev = evaluatePerformance(machine('w3', 14, 15, 12, { loadIncrementKg: 5 }), [
      machine('w2', 7, 12.5, 11, { loadIncrementKg: 5 }),
      machine('w1', 0, 10, 12, { loadIncrementKg: 5 }),
    ]);
    const ceiling = ev.signals.find((s) => s.code === 'range_ceiling_reached');
    expect(ceiling?.nextLoadKg).toBe(20);
    expect(ceiling?.evidence.map((e) => e.label)).not.toContain('inferred_increment_kg');
  });

  it('garde la table quand l’historique ne montre pas de pas plus fin', () => {
    const ev = evaluatePerformance(machine('w2', 7, 50, 12), [machine('w1', 0, 45, 12)]);
    const ceiling = ev.signals.find((s) => s.code === 'range_ceiling_reached');
    expect(ceiling?.nextLoadKg).toBe(55);
    expect(ceiling?.evidence.map((e) => e.label)).not.toContain('inferred_increment_kg');
  });

  it('allège du même pas déduit après deux manques', () => {
    const ev = evaluatePerformance(machine('w4', 21, 15, 8), [
      machine('w3', 14, 15, 8),
      machine('w2', 7, 12.5, 12),
      machine('w1', 0, 10, 12),
    ]);
    const missed = ev.signals.find((s) => s.code === 'range_missed');
    expect(missed?.nextLoadKg).toBe(12.5);
    expect(missed?.evidence).toContainEqual({ label: 'inferred_increment_kg', value: 2.5 });
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

  it('prefers plateau over a loadless ceiling so the constat is not erased', () => {
    const picked = pickSignals([
      {
        code: 'range_ceiling_reached',
        exerciseId: 'bench',
        evidence: [{ label: 'working_sets', value: 3 }],
        severity: 40,
      },
      {
        code: 'plateau',
        exerciseId: 'bench',
        evidence: [{ label: 'sessions', value: 3 }],
        severity: 30,
      },
    ]);
    expect(picked).toHaveLength(1);
    expect(picked[0]!.code).toBe('plateau');
  });

  it('keeps a ceiling that still carries a next load over plateau', () => {
    const picked = pickSignals([
      {
        code: 'range_ceiling_reached',
        exerciseId: 'bench',
        nextLoadKg: 102.5,
        evidence: [],
        severity: 40,
      },
      {
        code: 'plateau',
        exerciseId: 'bench',
        evidence: [],
        severity: 30,
      },
    ]);
    expect(picked[0]!.code).toBe('range_ceiling_reached');
  });

  it('prefers plateau over a deferred hold so Progression does not hide it', () => {
    const picked = pickSignals([
      {
        code: 'range_satisfied',
        exerciseId: 'bench',
        evidence: [{ label: 'progression_deferred', value: 1 }],
        severity: 35,
      },
      {
        code: 'plateau',
        exerciseId: 'bench',
        evidence: [{ label: 'sessions', value: 3 }],
        severity: 30,
      },
    ]);
    expect(picked[0]!.code).toBe('plateau');
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
