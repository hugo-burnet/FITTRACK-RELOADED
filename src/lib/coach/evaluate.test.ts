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

  describe('deux blocs du même exercice', () => {
    // Chaque bloc repart de `order: 0` ; recollés tels quels ils s'entrelaçaient
    // (A0, B0, A1, B1, A2) et toute règle qui lit la suite des séries lisait une
    // séance qui n'a pas eu lieu.
    const minute = 60_000;
    const block = (
      reps: number[],
      startMinute: number,
      extra: Partial<CoachExerciseLine> = {},
    ): CoachExerciseLine =>
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        sets: reps.map((value, order) =>
          set({
            order,
            reps: value,
            weight: 100,
            targetReps: 8,
            targetRepsMax: 12,
            performedAt: t0 + (startMinute + order * 2) * minute,
          }),
        ),
        ...extra,
      });

    const sequence = (merged: CoachExerciseLine) =>
      [...merged.sets].sort((a, b) => a.order - b.order).map((s) => s.performedAt);

    it('met les séries dans l’ordre où elles ont été faites', () => {
      const [merged] = mergeLinesForWorkout([block([10, 10, 10], 0), block([7, 7], 6)]);
      const times = sequence(merged!);
      expect(times).toEqual([...times].sort((a, b) => a - b));
      expect(merged!.sets.map((s) => s.order)).toEqual([0, 1, 2, 3, 4]);
    });

    it('range les blocs dans l’ordre où ils ont été faits, pas dans celui où ils arrivent', () => {
      // Le bloc fait en second est lu en premier (l'ordre des lignes est celui de la
      // carte dans la séance, que l'on réarrange) : c'est l'heure qui décide.
      const [merged] = mergeLinesForWorkout([block([7, 7], 6), block([10, 10, 10], 0)]);
      expect(sequence(merged!)).toEqual([0, 2, 4, 6, 8].map((m) => t0 + m * minute));
    });

    it('laisse intacte une ligne seule', () => {
      const alone = block([10, 9, 8], 0);
      const [merged] = mergeLinesForWorkout([alone]);
      expect(merged!.sets).toEqual(alone.sets);
      expect(merged!.sets).not.toBe(alone.sets);
    });

    it('ne prête pas au repos le temps qui sépare deux blocs enchaînés', () => {
      // Deux minutes de repos partout, le second bloc enchaîné sur le premier.
      // Entrelacées, les séries donnaient des écarts de six minutes (A0 → B0,
      // A1 → B1) : « Repos long » sur une séance dont aucun repos ne l'était.
      const signals = collectCoachSignals([block([10, 10, 10], 0), block([6, 6], 6)]);
      expect(signals.map((s) => s.code)).toContain('intra_session_drop');
      expect(signals.map((s) => s.code)).not.toContain('long_rest');
    });

    it('propose d’alléger depuis la charge du haut, celle de la dernière série faite', () => {
      // Deux séances de deux blocs : 100 kg puis 105 kg, le bas de fourchette (8)
      // manqué les deux fois. Entrelacée, la dernière série lue était celle du
      // premier bloc : le coach proposait 97,5 kg depuis une séance finie à 105.
      const day = 86_400_000;
      const session = (workoutId: string, dayIndex: number): CoachExerciseLine[] => {
        const at = (m: number) => t0 + dayIndex * day + m * minute;
        const make = (reps: number[], startMinute: number, weight: number) =>
          line({
            exerciseId: 'bench',
            workoutId,
            workoutStartedAt: t0 + dayIndex * day,
            sets: reps.map((value, order) =>
              set({ order, reps: value, weight, performedAt: at(startMinute + order * 2) }),
            ),
          });
        return [make([7, 7, 7], 0, 100), make([7, 7], 6, 105)];
      };
      const picked = evaluateCoach([...session('w2', 7), ...session('w1', 0)]);
      expect(picked).toHaveLength(1);
      expect(picked[0]).toMatchObject({ code: 'range_missed', nextLoadKg: 102.5 });
    });
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

describe('range_ceiling_reached — remise dans la fourchette', () => {
  // Valeurs de référence calculées à part (script Python hors du dépôt). Barre, grille de 2,5 kg ; trois séries
  // d'un 15 – 20 à 40 kg ; la même formule que le benchmark (spec benchmark §3).
  const light = (reps: number[], extra: Partial<CoachSetInput> = {}, range: [number, number] = [15, 20]) =>
    evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        sets: reps.map((value, order) =>
          set({ order, reps: value, weight: 40, targetReps: range[0], targetRepsMax: range[1], ...extra }),
        ),
      }),
    ]);

  it('propose d’un coup la charge qui remet dans la fourchette quand on est très au-dessus du plafond', () => {
    // 30 répétitions à 40 kg : un max d'au moins 80 kg ; trois séries d'un 15 – 20 en demandent 21 à la première,
    // soit 80 / (1 + 21/30) = 47,1 → 47,5 kg (le pas de 2,5 le plus proche), et non un cran de plus (42,5).
    const [signal] = light([30, 28, 26]);

    expect(signal).toMatchObject({ code: 'range_ceiling_reached', nextLoadKg: 47.5 });
    expect(signal!.evidence).toEqual(
      expect.arrayContaining([
        { label: 'ceiling_rebalanced', value: 1 },
        { label: 'top_reps', value: 30 },
        { label: 'target_reps', value: 15 },
        { label: 'next_load_kg', value: 47.5 },
      ]),
    );
  });

  it('garde un cran de plus quand un cran suffit : 22, 21, 20 répétitions', () => {
    const [signal] = light([22, 21, 20]);

    expect(signal).toMatchObject({ code: 'range_ceiling_reached', nextLoadKg: 42.5 });
    expect(signal!.evidence.map((item) => item.label)).not.toContain('ceiling_rebalanced');
  });

  it('ne descend jamais sous le cran de plus : la charge qui remet dans la fourchette peut être celle-là', () => {
    // 25, 24, 22 répétitions : 73,3 / (1 + 21/30) = 43,1 → 42,5, c'est le cran de plus.
    const [signal] = light([25, 24, 22]);

    expect(signal).toMatchObject({ nextLoadKg: 42.5 });
    expect(signal!.evidence.map((item) => item.label)).not.toContain('ceiling_rebalanced');
  });

  it('compte la réserve que dit le RPE : 25 répétitions à RPE 7 sont une capacité de 28', () => {
    // 40 × (1 + 28/30) = 77,3 ; 77,3 / (1 + 21/30) = 45,5 → 45 kg.
    const [signal] = light([25, 24, 22], { rpe: 7 });

    expect(signal).toMatchObject({ nextLoadKg: 45 });
    expect(signal!.evidence).toEqual(expect.arrayContaining([{ label: 'ceiling_rebalanced', value: 1 }]));
  });

  it('garde un cran sur une large fourchette : 12 répétitions sur un 5 – 12 ne demandent pas de viser le bas', () => {
    // 100 × 12 : un max de 140 kg. Un cran (102,5) laisse 11 répétitions à fond, sous le plafond : le benchmark, lui,
    // viserait 107,5 (le bas de la fourchette plus la réserve) — trois crans pour qui vient d'atteindre le haut.
    const signals = evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        sets: [12, 12, 12].map((value, order) =>
          set({ order, reps: value, weight: 100, targetReps: 5, targetRepsMax: 12 }),
        ),
      }),
    ]);

    expect(signals[0]).toMatchObject({ code: 'range_ceiling_reached', nextLoadKg: 102.5 });
    expect(signals[0]!.evidence.map((item) => item.label)).not.toContain('ceiling_rebalanced');
  });

  it('ne dépasse pas 30 % de plus que la charge d’aujourd’hui', () => {
    // 30 répétitions sur un 5 – 8 : la formule dirait 60 kg (+50 %) ; un seul essai n'en justifie pas autant.
    expect(light([30, 30, 30], {}, [5, 8])[0]).toMatchObject({ nextLoadKg: 50 });
  });

  it('ne change rien à une pyramide : un cran de plus depuis la dernière série', () => {
    const signals = evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        sets: [40, 42.5, 45].map((weight, order) =>
          set({ order, reps: 30, weight, targetReps: 15, targetRepsMax: 20 }),
        ),
      }),
    ]);

    expect(signals[0]).toMatchObject({ code: 'range_ceiling_reached', nextLoadKg: 47.5 });
    expect(signals[0]!.evidence.map((item) => item.label)).not.toContain('ceiling_rebalanced');
  });

  it('ne change rien à une cible unique : sans fourchette, il n’y a pas de fourchette où remettre', () => {
    const signals = evaluateCoach([
      line({
        exerciseId: 'bench',
        workoutId: 'w1',
        sets: [30, 30, 30].map((value, order) =>
          set({ order, reps: value, weight: 40, targetReps: 8, targetRepsMax: undefined }),
        ),
      }),
    ]);

    expect(signals[0]).toMatchObject({ code: 'range_ceiling_reached', nextLoadKg: 42.5 });
  });

  it('se tait sur la charge quand l’effort était maximal : le plafond arraché se consolide', () => {
    const [signal] = light([30, 28, 26], { rpe: 10 });

    expect(signal).toMatchObject({ code: 'range_ceiling_reached' });
    expect(signal!.nextLoadKg).toBeUndefined();
    expect(signal!.evidence.map((item) => item.label)).not.toContain('ceiling_rebalanced');
  });
});

describe('range_missed — remise dans la fourchette par en dessous', () => {
  // Valeurs de référence calculées à part (script Python hors du dépôt). Barre, grille de 2,5 kg ; trois séries d'un
  // 15 – 20 à 40 kg. On enlève des crans jusqu'à ce que la pire série, d'après les répétitions faites, retombe au bas de
  // la fourchette (à une demi-répétition près), et jamais plus de 30 % de moins que la charge du jour.
  const day = 86_400_000;
  const session = (
    workoutId: string,
    dayIndex: number,
    reps: number[],
    extra: Partial<CoachSetInput> = {},
    range: [number, number | undefined] = [15, 20],
    weight = 40,
    lineExtra: Partial<CoachExerciseLine> = {},
  ): CoachExerciseLine =>
    line({
      exerciseId: 'bench',
      workoutId,
      workoutStartedAt: t0 + dayIndex * day,
      sets: reps.map((value, order) =>
        set({
          order,
          reps: value,
          weight,
          targetReps: range[0],
          targetRepsMax: range[1],
          performedAt: t0 + dayIndex * day + order * 120_000,
          ...extra,
        }),
      ),
      ...lineExtra,
    });
  /** Deux séances de suite, mêmes répétitions, même charge : le bas de la fourchette manqué deux fois. */
  const missed = (
    reps: number[],
    extra: Partial<CoachSetInput> = {},
    range: [number, number | undefined] = [15, 20],
    weight = 40,
    lineExtra: Partial<CoachExerciseLine> = {},
  ): CoachSignal | undefined =>
    evaluatePerformance(session('w2', 7, reps, extra, range, weight, lineExtra), [
      session('w1', 0, reps, extra, range, weight, lineExtra),
    ]).signals.find((signal) => signal.code === 'range_missed');

  it('enlève d’un coup les crans qui remettent la pire série dans la fourchette : 8, 7, 6 sur un 15 – 20', () => {
    // Un cran (37,5) ferait 8,5 répétitions à la pire série, deux (35) 11,4, trois (32,5) 14,8 : le bas, à une
    // demi-répétition près. Un seul cran ne remettait pas dans la fourchette, il en fallait trois séances.
    const signal = missed([8, 7, 6]);

    expect(signal).toMatchObject({ code: 'range_missed', nextLoadKg: 32.5 });
    expect(signal!.evidence).toEqual(
      expect.arrayContaining([
        { label: 'floor_steps', value: 3 },
        { label: 'target_reps', value: 15 },
        { label: 'target_reps_max', value: 20 },
        { label: 'low_reps', value: 6 },
        { label: 'current_load_kg', value: 40 },
        { label: 'next_load_kg', value: 32.5 },
      ]),
    );
  });

  it('garde un cran quand un cran suffit : 14, 13, 13 retombent à 15,9 avec un cran de moins', () => {
    const signal = missed([14, 13, 13]);

    expect(signal).toMatchObject({ nextLoadKg: 37.5 });
    expect(signal!.evidence.map((item) => item.label)).not.toContain('floor_steps');
  });

  it('compte la réserve que dit le RPE : 6, 6, 6 à RPE 7 sont une capacité de 9, donc un cran de moins en moins', () => {
    // Sans RPE : 4 crans (30). À RPE 7, chaque cran rend plus de répétitions : 3 crans (32,5) suffisent.
    expect(missed([6, 6, 6])).toMatchObject({ nextLoadKg: 30 });
    expect(missed([6, 6, 6], { rpe: 7 })).toMatchObject({ nextLoadKg: 32.5 });
  });

  it('va aussi loin que le dit la pire série sur un 5 – 8 : 3, 3, 2 à 100 kg demandent trois crans', () => {
    const signal = missed([3, 3, 2], {}, [5, 8], 100);

    expect(signal).toMatchObject({ nextLoadKg: 92.5 });
    expect(signal!.evidence).toEqual(expect.arrayContaining([{ label: 'floor_steps', value: 3 }]));
  });

  it('n’enlève pas plus d’un cran pour une répétition de moins : 8, 8, 7 sur un 8 – 12', () => {
    // La pire série passerait de 7 à 7,97 avec un cran : à une demi-répétition près, c'est le bas.
    const signal = missed([8, 8, 7], {}, [8, 12], 100);

    expect(signal).toMatchObject({ nextLoadKg: 97.5 });
    expect(signal!.evidence.map((item) => item.label)).not.toContain('floor_steps');
  });

  it('enlève deux crans pour 7 puis 6 à 80 kg sur un 8 – 12, là où un seul laissait la pire série à 7,2', () => {
    const signal = missed([7, 6], {}, [8, 12], 80);

    expect(signal).toMatchObject({ nextLoadKg: 75 });
    expect(signal!.evidence).toEqual(expect.arrayContaining([{ label: 'floor_steps', value: 2 }]));
  });

  it('ne dépasse pas 30 % de moins que la charge d’aujourd’hui', () => {
    // 2, 2, 1 à 40 kg : le calcul irait plus bas que 30 kg (27,5 serait un cran de trop).
    const signal = missed([2, 2, 1]);

    expect(signal).toMatchObject({ nextLoadKg: 30 });
    expect(signal!.evidence).toEqual(expect.arrayContaining([{ label: 'floor_steps', value: 4 }]));
  });

  it('compte les crans de la fiche : un pas de 1,125 en demande plus, pour la même charge à peu près', () => {
    const signal = missed([8, 7, 6], {}, [15, 20], 40, { loadIncrementKg: 1.125 });

    expect(signal).toMatchObject({ nextLoadKg: 32.125 });
    expect(signal!.evidence).toEqual(expect.arrayContaining([{ label: 'floor_steps', value: 7 }]));
  });

  it('ne lit que la dernière séance pour savoir jusqu’où : la précédente a seulement manqué, à la même charge', () => {
    const signal = evaluatePerformance(session('w2', 7, [8, 7, 6]), [
      session('w1', 0, [13, 12, 12]),
    ]).signals.find((candidate) => candidate.code === 'range_missed');

    expect(signal).toMatchObject({ nextLoadKg: 32.5 });
  });

  it('ne change rien à une pyramide : un cran de moins depuis la dernière série', () => {
    const pyramid = (workoutId: string, dayIndex: number) =>
      line({
        exerciseId: 'bench',
        workoutId,
        workoutStartedAt: t0 + dayIndex * day,
        sets: [37.5, 40, 42.5].map((weight, order) =>
          set({
            order,
            reps: 8,
            weight,
            targetReps: 15,
            targetRepsMax: 20,
            performedAt: t0 + dayIndex * day + order * 120_000,
          }),
        ),
      });
    const signal = evaluatePerformance(pyramid('w2', 7), [pyramid('w1', 0)]).signals.find(
      (candidate) => candidate.code === 'range_missed',
    );

    expect(signal).toMatchObject({ nextLoadKg: 40 });
    expect(signal!.evidence.map((item) => item.label)).not.toContain('floor_steps');
  });

  it('ne change rien à une cible unique : sans fourchette, il n’y a pas de fourchette où remettre', () => {
    const signal = missed([3, 3, 3], {}, [8, undefined]);

    expect(signal).toMatchObject({ nextLoadKg: 37.5 });
    expect(signal!.evidence.map((item) => item.label)).not.toContain('floor_steps');
  });

  it('ne change rien quand le cran de moins tombe déjà sous le plancher de 30 % : l’ancienne règle', () => {
    // 5 kg, un cran de 2,5 : -50 %. Rien de plus léger n'est permis, la règle d'avant garde la main.
    const signal = missed([3, 3, 3], {}, [15, 20], 5);

    expect(signal).toMatchObject({ nextLoadKg: 2.5 });
    expect(signal!.evidence.map((item) => item.label)).not.toContain('floor_steps');
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
    // Le coach proposait 20 kg trois séances de suite. Depuis R3.2, +2,5 kg sur
    // 12,5 ne se prend qu'à 21 répétitions (retomber à 12 après le cran) : le
    // test leur donne ce compte, son sujet reste l'arrondi.
    const signals = evaluateCoach([
      line({
        exerciseId: 'reverse-fly',
        workoutId: 'w1',
        equipment: 'machine',
        sets: [
          set({ order: 0, reps: 21, weight: 12.5, targetReps: 12, targetRepsMax: 15 }),
          set({ order: 1, reps: 21, weight: 12.5, targetReps: 12, targetRepsMax: 15 }),
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
        // Une répétition sous le bas de 8 : un cran de moins suffit à la remettre dedans. 7 puis 6 en demandait deux
        // (cf. « remise dans la fourchette par en dessous »).
        set({ order: 1, reps: 7, weight, performedAt: startedAt + 120_000 }),
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
      // 13 et non 12 : +5 kg sur 70 demande 13 répétitions pour retomber à 10 (R3.2).
      const signals = evaluateCoach([
        rowing('w4', 21, [13, 13, 13]),
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

describe('cran de la fiche de l’exercice (R3.1 révisée)', () => {
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

  it('ajoute le micro-chargement renseigné, sans le ramener sur une grille', () => {
    // Élévations à la poulie : 5 kg, plaque de 1,125 kg renseignée sur la fiche.
    // 21 répétitions absorbent le cran en 12–15 (R3.2).
    const lateral = (reps: number) =>
      line({
        exerciseId: 'lateral',
        workoutId: 'w1',
        equipment: 'cable',
        loadIncrementKg: 1.125,
        sets: [0, 1].map((order) =>
          set({ order, reps, weight: 5, targetReps: 12, targetRepsMax: 15 }),
        ),
      });
    expect(
      evaluatePerformance(lateral(21)).signals.find((s) => s.code === 'range_ceiling_reached')
        ?.nextLoadKg,
    ).toBe(6.125);
    expect(
      evaluatePerformance(lateral(15)).signals.find((s) => s.code === 'range_ceiling_reached')
        ?.evidence,
    ).toEqual(
      expect.arrayContaining([
        { label: 'step_needs_reps', value: 21 },
        { label: 'next_step_kg', value: 6.125 },
      ]),
    );
  });

  it('prend la table du matériel quand la fiche est vide, sans deviner dans l’historique', () => {
    // Des charges de 10, 12,5 et 15 kg montrent des demi-pas ; le coach ne les
    // déduit plus — « Vide = défaut selon le matériel », dit la fiche. 24
    // répétitions absorbent +5 kg sur 15 (R3.2).
    const ev = evaluatePerformance(machine('w3', 14, 15, 24), [
      machine('w2', 7, 12.5, 11),
      machine('w1', 0, 10, 12),
    ]);
    expect(ev.signals.find((s) => s.code === 'range_ceiling_reached')?.nextLoadKg).toBe(20);
  });

  it('suit le cran renseigné quel que soit le matériel', () => {
    const ev = evaluatePerformance(machine('w2', 7, 50, 15, { loadIncrementKg: 2.5 }), [
      machine('w1', 0, 45, 12, { loadIncrementKg: 2.5 }),
    ]);
    expect(ev.signals.find((s) => s.code === 'range_ceiling_reached')?.nextLoadKg).toBe(52.5);
  });

  it('allège du cran renseigné après deux manques', () => {
    const ev = evaluatePerformance(machine('w2', 7, 15, 8, { loadIncrementKg: 2.5 }), [
      machine('w1', 0, 15, 8, { loadIncrementKg: 2.5 }),
    ]);
    expect(ev.signals.find((s) => s.code === 'range_missed')?.nextLoadKg).toBe(12.5);
  });

  describe('le pas de toute l’appli (Réglages)', () => {
    it('monte du pas des Réglages quand la fiche est vide, au lieu de la table du matériel', () => {
      // Sans rien : la table dirait +5 kg sur une machine (55). Les Réglages disent 1,125, ajouté tel quel.
      const options = { defaultLoadStepKg: 1.125 };
      const ev = evaluatePerformance(machine('w2', 7, 50, 12), [machine('w1', 0, 45, 12)], options);

      expect(ev.signals.find((s) => s.code === 'range_ceiling_reached')?.nextLoadKg).toBe(51.125);
    });

    it('allège du pas des Réglages après deux manques', () => {
      const options = { defaultLoadStepKg: 1.125 };
      const ev = evaluatePerformance(
        machine('w2', 7, 15, 8),
        [machine('w1', 0, 15, 8)],
        options,
      );

      expect(ev.signals.find((s) => s.code === 'range_missed')?.nextLoadKg).toBe(13.875);
    });

    it('laisse la fiche passer avant les Réglages', () => {
      const ev = evaluatePerformance(
        machine('w2', 7, 50, 15, { loadIncrementKg: 2.5 }),
        [machine('w1', 0, 45, 12, { loadIncrementKg: 2.5 })],
        { defaultLoadStepKg: 1.125 },
      );

      expect(ev.signals.find((s) => s.code === 'range_ceiling_reached')?.nextLoadKg).toBe(52.5);
    });

    it('ne change rien tant que les Réglages ne disent rien : la table du matériel', () => {
      const ev = evaluatePerformance(machine('w2', 7, 15, 24), [machine('w1', 0, 15, 12)], {});

      expect(ev.signals.find((s) => s.code === 'range_ceiling_reached')?.nextLoadKg).toBe(20);
    });
  });
});

describe('effort de séance (R1)', () => {
  const day = 86_400_000;
  /** Une séance de 3 séries, RPE par série (`undefined` = non noté). */
  const effortSession = (
    workoutId: string,
    dayIndex: number,
    reps: number[],
    rpe: (number | undefined)[],
    weight = 100,
    range: { targetReps?: number; targetRepsMax?: number } = { targetReps: 8, targetRepsMax: 12 },
    setTypes: ('normal' | 'failure')[] = [],
  ): CoachExerciseLine =>
    line({
      exerciseId: 'bench',
      workoutId,
      workoutStartedAt: t0 + dayIndex * day,
      sets: reps.map((value, order) =>
        set({
          order,
          reps: value,
          weight,
          rpe: rpe[order],
          setType: setTypes[order] ?? 'normal',
          performedAt: t0 + dayIndex * day + order * 120_000,
          ...range,
        }),
      ),
    });

  it('monte quand le plafond est atteint avec de la marge', () => {
    const ev = evaluatePerformance(effortSession('w1', 0, [12, 12, 12], [8, 8.5, 9]));
    const ceiling = ev.signals.find((s) => s.code === 'range_ceiling_reached');
    expect(ceiling?.nextLoadKg).toBe(102.5);
    expect(ev.allowedActions).toContain('increase_load');
  });

  it('consolide un plafond arraché à l’échec (décision Q1)', () => {
    const ev = evaluatePerformance(effortSession('w1', 0, [12, 12, 12], [9.5, 10, 10]));
    const ceiling = ev.signals.find((s) => s.code === 'range_ceiling_reached');
    expect(ceiling).toBeDefined();
    expect(ceiling!.nextLoadKg).toBeUndefined();
    expect(ceiling!.evidence).toContainEqual({ label: 'ceiling_grinding', value: 1 });
    expect(ceiling!.evidence).toContainEqual({ label: 'session_rpe', value: 9.8 });
    expect(ev.allowedActions).not.toContain('increase_load');
    expect(ev.allowedActions).not.toContain('add_set');
  });

  it('se tait sur l’effort quand moins de la moitié des séries porte un RPE', () => {
    const ev = evaluatePerformance(effortSession('w1', 0, [12, 12, 12], [10, undefined, undefined]));
    const ceiling = ev.signals.find((s) => s.code === 'range_ceiling_reached');
    expect(ceiling?.nextLoadKg).toBe(102.5);
    expect(ceiling?.evidence.map((e) => e.label)).not.toContain('ceiling_grinding');
  });

  it('ne compte pas la série à l’échec dans l’effort', () => {
    const ev = evaluatePerformance(
      effortSession('w1', 0, [12, 12, 12], [8, 8, 10], 100, undefined, ['normal', 'normal', 'failure']),
    );
    expect(ev.signals.find((s) => s.code === 'range_ceiling_reached')?.nextLoadKg).toBe(102.5);
  });

  it('lit une consolidation : même travail, moins d’effort', () => {
    // Rowing, historique réel, sous le plafond : 70 × 11 × 3 @9 puis @8,5.
    const ev = evaluatePerformance(
      effortSession('w2', 7, [11, 11, 11], [8.5, 8.5, 8.5], 70, { targetReps: 10, targetRepsMax: 12 }),
      [effortSession('w1', 0, [11, 11, 11], [9, 9, 9], 70, { targetReps: 10, targetRepsMax: 12 })],
    );
    const consolidating = ev.signals.find((s) => s.code === 'consolidating');
    expect(consolidating?.evidence).toEqual(
      expect.arrayContaining([
        { label: 'current_load_kg', value: 70 },
        { label: 'rpe_before', value: 9 },
        { label: 'rpe_after', value: 8.5 },
      ]),
    );
    expect(pickSignals(ev.signals)[0]!.code).toBe('consolidating');
  });

  it('ne parle pas de consolidation pour une baisse d’effort sous 0,5', () => {
    const ev = evaluatePerformance(effortSession('w2', 7, [11, 11, 11], [9, 9, 8.5]), [
      effortSession('w1', 0, [11, 11, 11], [9, 9, 9]),
    ]);
    expect(ev.signals.map((s) => s.code)).not.toContain('consolidating');
  });

  it('ne parle pas de consolidation quand la charge a changé', () => {
    const ev = evaluatePerformance(effortSession('w2', 7, [11, 11, 11], [8, 8, 8], 102.5), [
      effortSession('w1', 0, [11, 11, 11], [9, 9, 9], 100),
    ]);
    expect(ev.signals.map((s) => s.code)).not.toContain('consolidating');
  });

  it('garde le plafond devant la consolidation', () => {
    const ev = evaluatePerformance(effortSession('w2', 7, [12, 12, 12], [8, 8, 8]), [
      effortSession('w1', 0, [12, 12, 12], [9, 9, 9]),
    ]);
    expect(ev.signals.map((s) => s.code)).toContain('consolidating');
    expect(pickSignals(ev.signals)[0]!.code).toBe('range_ceiling_reached');
  });

  it('lève le plateau quand l’effort baisse sur la fenêtre', () => {
    const signals = collectCoachSignals([
      effortSession('w3', 14, [10, 10, 10], [8.5, 8.5, 8.5]),
      effortSession('w2', 7, [10, 10, 10], [9, 9, 9]),
      effortSession('w1', 0, [10, 10, 10], [9.5, 9.5, 9.5]),
    ]);
    expect(signals.map((s) => s.code)).not.toContain('plateau');
  });

  it('garde le plateau quand l’effort ne baisse pas, et dit s’il est à l’échec', () => {
    const flat = collectCoachSignals([
      effortSession('w3', 14, [10, 10, 10], [9, 9, 9]),
      effortSession('w2', 7, [10, 10, 10], [9, 9, 9]),
      effortSession('w1', 0, [10, 10, 10], [9, 9, 9]),
    ]);
    const plateau = flat.find((s) => s.code === 'plateau');
    expect(plateau).toBeDefined();
    expect(plateau!.evidence.map((e) => e.label)).not.toContain('at_failure');

    const atFailure = collectCoachSignals([
      effortSession('w3', 14, [10, 10, 10], [10, 10, 9.5]),
      effortSession('w2', 7, [10, 10, 10], [9.5, 10, 10]),
      effortSession('w1', 0, [10, 10, 10], [10, 10, 10]),
    ]).find((s) => s.code === 'plateau');
    expect(atFailure?.evidence).toContainEqual({ label: 'at_failure', value: 1 });
  });

  it('se comporte comme avant sans aucun RPE', () => {
    const signals = collectCoachSignals([
      effortSession('w3', 14, [10, 10, 10], [undefined, undefined, undefined]),
      effortSession('w2', 7, [10, 10, 10], [undefined, undefined, undefined]),
      effortSession('w1', 0, [10, 10, 10], [undefined, undefined, undefined]),
    ]);
    expect(signals.map((s) => s.code).sort()).toEqual(['plateau', 'range_satisfied']);
  });
});

describe('même contrat de répétitions (R4)', () => {
  const day = 86_400_000;
  const contractSession = (
    workoutId: string,
    dayIndex: number,
    reps: number[],
    weight: number,
    range: { targetReps?: number; targetRepsMax?: number },
    rpe: (number | undefined)[] = [],
  ): CoachExerciseLine =>
    line({
      exerciseId: 'fly',
      workoutId,
      workoutStartedAt: t0 + dayIndex * day,
      equipment: 'machine',
      sets: reps.map((value, order) =>
        set({
          order,
          reps: value,
          weight,
          rpe: rpe[order],
          performedAt: t0 + dayIndex * day + order * 120_000,
          ...range,
        }),
      ),
    });
  const usual = { targetReps: 12, targetRepsMax: 15 };
  const lighter = { targetReps: 10, targetRepsMax: 12 };
  const none = { targetReps: undefined, targetRepsMax: undefined };

  it('ne compare pas une séance de reprise plus légère aux séances habituelles', () => {
    // Pec fly, historique réel : une routine « reprise » en 10–12 à 7,5 kg après des
    // séances en 12–15 à 10 kg. Le coach y lisait un plateau.
    const signals = collectCoachSignals([
      contractSession('w3', 14, [10, 9], 7.5, lighter),
      contractSession('w2', 7, [12, 12], 10, usual),
      contractSession('w1', 0, [12, 12], 10, usual),
    ]);
    expect(signals.map((s) => s.code)).not.toContain('plateau');
  });

  it('ne cumule pas deux manques pris sous des fourchettes différentes', () => {
    const ev = evaluatePerformance(contractSession('w2', 7, [11, 11], 10, usual), [
      contractSession('w1', 0, [9, 9], 10, lighter),
    ]);
    expect(ev.signals.map((s) => s.code)).not.toContain('range_missed');
  });

  it('enjambe une séance d’une autre fourchette pour retrouver la précédente comparable', () => {
    const ev = evaluatePerformance(contractSession('w3', 14, [11, 11], 10, usual), [
      contractSession('w2', 7, [12, 12], 10, lighter),
      contractSession('w1', 0, [11, 11], 10, usual),
    ]);
    expect(ev.signals.map((s) => s.code)).toContain('range_missed');
  });

  it('fait des séances sans cible un flux à part, que le plateau lit', () => {
    const signals = collectCoachSignals([
      contractSession('w4', 21, [12, 12], 10, none),
      contractSession('w3', 14, [15, 15], 10, usual),
      contractSession('w2', 7, [12, 12], 10, none),
      contractSession('w1', 0, [12, 12], 10, none),
    ]);
    expect(signals.map((s) => s.code)).toContain('plateau');
  });

  it('ne lit une consolidation qu’entre deux séances du même contrat', () => {
    const ev = evaluatePerformance(
      contractSession('w2', 7, [12, 12], 10, lighter, [8, 8]),
      [contractSession('w1', 0, [12, 12], 10, usual, [9, 9])],
    );
    expect(ev.signals.map((s) => s.code)).not.toContain('consolidating');
  });
});

describe('retour de pause (R5)', () => {
  const day = 86_400_000;
  const pauseSession = (
    workoutId: string,
    dayIndex: number,
    reps: number[],
    range: { targetReps?: number; targetRepsMax?: number } = { targetReps: 8, targetRepsMax: 12 },
    weight = 115,
  ): CoachExerciseLine =>
    line({
      exerciseId: 'leg-press',
      workoutId,
      workoutStartedAt: t0 + dayIndex * day,
      equipment: 'machine',
      sets: reps.map((value, order) =>
        set({
          order,
          reps: value,
          weight,
          performedAt: t0 + dayIndex * day + order * 120_000,
          ...range,
        }),
      ),
    });

  it('consolide au retour après 14 jours, sans proposer de monter', () => {
    // Presse à cuisses, historique réel : 21 jours sans, puis 115 × 12 × 3 sur
    // 8–12 — le coach proposait 120 kg comme si les séances s'enchaînaient.
    const ev = evaluatePerformance(pauseSession('w2', 21, [12, 12, 12]), [
      pauseSession('w1', 0, [10, 10, 10]),
    ]);
    const returning = ev.signals.find((s) => s.code === 'returning');
    expect(returning?.evidence).toContainEqual({ label: 'gap_days', value: 21 });
    expect(ev.signals.find((s) => s.code === 'range_ceiling_reached')?.nextLoadKg).toBeUndefined();
    expect(ev.allowedActions).not.toContain('increase_load');
    expect(ev.allowedActions).not.toContain('add_set');
    expect(pickSignals(ev.signals)[0]!.code).toBe('returning');
  });

  it('ne parle pas de reprise sous 14 jours', () => {
    const ev = evaluatePerformance(pauseSession('w2', 13, [12, 12, 12]), [
      pauseSession('w1', 0, [10, 10, 10]),
    ]);
    expect(ev.signals.map((s) => s.code)).not.toContain('returning');
    expect(ev.allowedActions).toContain('increase_load');
  });

  it('mesure la pause depuis la dernière séance de l’exercice, quelle qu’en soit la fourchette', () => {
    const ev = evaluatePerformance(pauseSession('w3', 20, [12, 12, 12]), [
      pauseSession('w2', 10, [15, 15, 15], { targetReps: 12, targetRepsMax: 15 }),
      pauseSession('w1', 0, [10, 10, 10]),
    ]);
    expect(ev.signals.map((s) => s.code)).not.toContain('returning');
  });

  it('ne parle pas de reprise à la toute première séance', () => {
    const ev = evaluatePerformance(pauseSession('w1', 0, [12, 12, 12]));
    expect(ev.signals.map((s) => s.code)).not.toContain('returning');
  });

  it('fait repartir de zéro la fenêtre du bas manqué', () => {
    const ev = evaluatePerformance(pauseSession('w2', 20, [7, 7, 7]), [
      pauseSession('w1', 0, [7, 7, 7]),
    ]);
    expect(ev.signals.map((s) => s.code)).not.toContain('range_missed');
  });

  it('fait repartir de zéro la fenêtre du plateau', () => {
    const flat = (workoutId: string, dayIndex: number) => pauseSession(workoutId, dayIndex, [10, 10, 10]);
    const history = [flat('w4', 35), flat('w3', 14), flat('w2', 7), flat('w1', 0)];
    const afterReturn = evaluatePerformance(flat('w5', 42), history);
    expect(afterReturn.signals.map((s) => s.code)).not.toContain('plateau');

    const later = evaluatePerformance(flat('w6', 49), [flat('w5', 42), ...history]);
    expect(later.signals.map((s) => s.code)).toContain('plateau');
  });
});

describe('répétitions pour absorber le cran (R3.2)', () => {
  const curl = (reps: number[], extra: Partial<CoachExerciseLine> = {}, weight = 10) =>
    line({
      exerciseId: 'curl',
      workoutId: 'w1',
      equipment: 'dumbbell',
      sets: reps.map((value, order) =>
        set({ order, reps: value, weight, targetReps: 10, targetRepsMax: 12 }),
      ),
      ...extra,
    });

  it('attend assez de répétitions quand le cran pèse lourd sur la charge', () => {
    // Haltères : +2 kg, pas le choix. À 10 kg, 12 répétitions retomberaient à 8
    // après le cran ; il en faut 18 pour retomber à 10.
    const ev = evaluatePerformance(curl([12, 12, 12]));
    const ceiling = ev.signals.find((s) => s.code === 'range_ceiling_reached');
    expect(ceiling?.nextLoadKg).toBeUndefined();
    expect(ceiling?.evidence).toEqual(
      expect.arrayContaining([
        { label: 'step_needs_reps', value: 18 },
        { label: 'next_step_kg', value: 12 },
        { label: 'target_reps', value: 10 },
        { label: 'current_load_kg', value: 10 },
      ]),
    );
    expect(ev.allowedActions).toContain('increase_reps');
    expect(ev.allowedActions).not.toContain('increase_load');
    expect(ev.allowedActions).not.toContain('add_set');
  });

  it('monte quand toutes les séries y sont', () => {
    const ready = evaluatePerformance(curl([18, 18, 18]));
    expect(ready.signals.find((s) => s.code === 'range_ceiling_reached')?.nextLoadKg).toBe(12);
    expect(ready.allowedActions).toContain('increase_load');

    const almost = evaluatePerformance(curl([18, 18, 17]));
    expect(almost.signals.find((s) => s.code === 'range_ceiling_reached')?.nextLoadKg).toBeUndefined();
  });

  it('ne change rien sur une charge lourde, où le plafond suffit', () => {
    const ev = evaluatePerformance(curl([12, 12, 12], { equipment: 'barbell' }, 100));
    const ceiling = ev.signals.find((s) => s.code === 'range_ceiling_reached');
    expect(ceiling?.nextLoadKg).toBe(102.5);
    expect(ceiling?.evidence.map((e) => e.label)).not.toContain('step_needs_reps');
  });

  it('demande encore des répétitions tant qu’il en faut 30 au plus', () => {
    // 4 → 6 kg sur un 10 – 12 : pile 30 répétitions, la règle tient encore.
    const ev = evaluatePerformance(curl([12, 12, 12], {}, 4));
    const ceiling = ev.signals.find((s) => s.code === 'range_ceiling_reached');
    expect(ceiling?.nextLoadKg).toBeUndefined();
    expect(ceiling?.evidence).toEqual(
      expect.arrayContaining([{ label: 'step_needs_reps', value: 30 }]),
    );
  });

  it('propose le cran quand il faudrait plus de 30 répétitions pour l’absorber', () => {
    // 2 → 4 kg sur un 10 – 12 en demanderait 50 ; 2,5 → 5 kg sur un 15 – 20 en
    // demandait 60. Au-delà de 30, Epley ne mesure plus rien et personne ne les
    // fera : la règle bloquait la charge pour toujours. On monte, et la carte dit
    // que la marche est haute.
    const ev = evaluatePerformance(curl([12, 12, 12], {}, 2));
    const ceiling = ev.signals.find((s) => s.code === 'range_ceiling_reached');
    expect(ceiling?.nextLoadKg).toBe(4);
    const labels = ceiling?.evidence.map((e) => e.label);
    expect(labels).not.toContain('step_needs_reps');
    expect(ceiling?.evidence).toEqual(
      expect.arrayContaining([
        { label: 'step_oversized', value: 1 },
        { label: 'next_load_kg', value: 4 },
        { label: 'current_load_kg', value: 2 },
        { label: 'target_reps', value: 10 },
      ]),
    );
    expect(ev.allowedActions).toContain('increase_load');

    const raise = evaluatePerformance(
      line({
        exerciseId: 'raise',
        workoutId: 'w1',
        equipment: 'dumbbell',
        loadIncrementKg: 2.5,
        sets: [0, 1, 2].map((order) =>
          set({ order, reps: 20, weight: 2.5, targetReps: 15, targetRepsMax: 20 }),
        ),
      }),
    );
    expect(raise.signals.find((s) => s.code === 'range_ceiling_reached')?.nextLoadKg).toBe(5);
  });

  it('ne propose toujours rien sur une reprise, même quand le cran est trop gros', () => {
    const history = [curl([12, 12, 12], { workoutId: 'w0', workoutStartedAt: 0 }, 2)];
    const ev = evaluatePerformance(
      curl([12, 12, 12], { workoutStartedAt: 30 * 86_400_000 }, 2),
      history,
    );
    expect(ev.signals.find((s) => s.code === 'range_ceiling_reached')?.nextLoadKg).toBeUndefined();
    expect(ev.allowedActions).not.toContain('increase_load');
  });

  it('laisse le lest et l’assistance tels quels', () => {
    // Dips lestés de 4 kg : +2 kg, c'est +50 % du lest mais une broutille devant
    // le poids du corps — le rapport entre deux crans n'y dit rien.
    const weighted = evaluatePerformance(curl([12, 12, 12], { measurementType: 'reps_only' }, 4));
    expect(weighted.signals.find((s) => s.code === 'range_ceiling_reached')?.nextLoadKg).toBe(6);
    const assisted = evaluatePerformance(
      curl([12, 12, 12], { measurementType: 'assisted_weight_reps', equipment: 'machine' }, 20),
    );
    expect(assisted.signals.find((s) => s.code === 'range_ceiling_reached')?.nextLoadKg).toBe(15);
  });
});

describe('cible unique, sans fourchette (R3.2)', () => {
  // Un 5×5 ou un 3×10 n'a pas de « bas de fourchette » où retomber : le bas et le
  // haut sont la même cible. R3.2 y exigeait toujours une répétition de plus que
  // la cible (6 pour un 5×5 de 40 à 160 kg), que le programme ne prescrit pas — le
  // coach réclamait l'impossible et ne proposait jamais la hausse. La progression
  // d'un programme à cible unique, c'est la charge.
  const single = (
    reps: number[],
    weight: number,
    target: number,
    extra: Partial<CoachExerciseLine> = {},
    range: { targetReps: number; targetRepsMax: number | undefined } = {
      targetReps: target,
      targetRepsMax: undefined,
    },
  ) =>
    line({
      exerciseId: 'squat',
      workoutId: 'w1',
      sets: reps.map((value, order) => set({ order, reps: value, weight, ...range })),
      ...extra,
    });

  it.each([40, 60, 100, 140, 160, 180])(
    'propose le cran d’un 5×5 réussi à %s kg à la barre',
    (weight) => {
      const ev = evaluatePerformance(single([5, 5, 5, 5, 5], weight, 5));
      const ceiling = ev.signals.find((s) => s.code === 'range_ceiling_reached');
      expect(ceiling?.nextLoadKg).toBe(weight + 2.5);
      expect(ceiling?.evidence.map((e) => e.label)).not.toContain('step_needs_reps');
      expect(ev.allowedActions).toContain('increase_load');
    },
  );

  it('propose le cran d’un 3×10 aux haltères, où il pèse pourtant +10 %', () => {
    // Le cran est celui du matériel (« les haltères c'est +2 kg, t'as pas le
    // choix ») ; sans fourchette il n'y a pas de répétitions à viser en plus.
    const ev = evaluatePerformance(
      single([10, 10, 10], 20, 10, { equipment: 'dumbbell', exerciseId: 'curl' }),
    );
    expect(ev.signals.find((s) => s.code === 'range_ceiling_reached')?.nextLoadKg).toBe(22);
  });

  it('lit une paire 5–5 comme une cible unique', () => {
    const ev = evaluatePerformance(single([5, 5, 5], 100, 5, {}, { targetReps: 5, targetRepsMax: 5 }));
    expect(ev.signals.find((s) => s.code === 'range_ceiling_reached')?.nextLoadKg).toBe(102.5);
  });

  it('propose encore le cran après trois séances réussies à la même charge', () => {
    const session = (workoutId: string, dayIndex: number) =>
      single([5, 5, 5, 5, 5], 100, 5, {
        workoutId,
        workoutStartedAt: t0 + dayIndex * 86_400_000,
      });
    const picked = evaluateCoach([session('w3', 4), session('w2', 2), session('w1', 0)]);
    expect(picked).toHaveLength(1);
    expect(picked[0]).toMatchObject({ code: 'range_ceiling_reached', nextLoadKg: 102.5 });
  });

  it('ne manque pas la cible : une série à 4 sur un 5×5 ne propose rien', () => {
    const ev = evaluatePerformance(single([5, 5, 5, 4, 4], 100, 5));
    expect(ev.signals.map((s) => s.code)).not.toContain('range_ceiling_reached');
  });

  it('retient toujours la charge quand la cible est arrachée (RPE 9,5 ou plus)', () => {
    const grinding = single([5, 5, 5], 100, 5).sets.map((s) => ({ ...s, rpe: 10 }));
    const ev = evaluatePerformance(single([5, 5, 5], 100, 5, { sets: grinding }));
    const ceiling = ev.signals.find((s) => s.code === 'range_ceiling_reached');
    expect(ceiling?.nextLoadKg).toBeUndefined();
    expect(ev.allowedActions).not.toContain('increase_load');
  });

  it('garde l’exigence de répétitions d’une vraie fourchette', () => {
    // Même charge, même cran : avec une fourchette 5–8, R3.2 s'applique comme avant
    // (ici le plafond de 8 suffit, la charge est proposée) ; avec 10–12 sur un
    // haltère léger, il réclame toujours 18 répétitions.
    const ranged = evaluatePerformance(
      single([8, 8, 8], 100, 5, {}, { targetReps: 5, targetRepsMax: 8 }),
    );
    expect(ranged.signals.find((s) => s.code === 'range_ceiling_reached')?.nextLoadKg).toBe(102.5);
    const light = evaluatePerformance(
      single([12, 12, 12], 10, 10, { equipment: 'dumbbell' }, { targetReps: 10, targetRepsMax: 12 }),
    );
    expect(light.signals.find((s) => s.code === 'range_ceiling_reached')?.evidence).toEqual(
      expect.arrayContaining([{ label: 'step_needs_reps', value: 18 }]),
    );
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

describe('R6 — le plafond de volume du muscle', () => {
  /** Trois séries au plafond, 100 kg à la barre : `increase_load` et `add_set` sont permis. */
  const atCeiling = () => line3x8to12([12, 12, 12]);

  it('retire add_set quand la semaine du muscle est au plus haut de ce qui a été tenu, et garde la charge', () => {
    const ev = evaluatePerformance(atCeiling(), [], {
      muscleVolume: { rollingSets: 10, ceiling: 10 },
    });

    expect(ev.signals.map((s) => s.code)).toEqual(['range_ceiling_reached']);
    expect(ev.allowedActions).not.toContain('add_set');
    expect(ev.allowedActions).toContain('increase_load');
    expect(ev.volumeWithheld).toBe(true);
  });

  it('le retire aussi au-delà du plafond', () => {
    const ev = evaluatePerformance(atCeiling(), [], {
      muscleVolume: { rollingSets: 14, ceiling: 10 },
    });

    expect(ev.allowedActions).not.toContain('add_set');
    expect(ev.volumeWithheld).toBe(true);
  });

  it('laisse add_set sous le plafond : le coach peut proposer d’aller jusqu’à ce qui a déjà été tenu', () => {
    const ev = evaluatePerformance(atCeiling(), [], {
      muscleVolume: { rollingSets: 9, ceiling: 10 },
    });

    expect(ev.allowedActions).toContain('add_set');
    expect(ev.volumeWithheld).toBeUndefined();
  });

  it('ne change rien sans contexte de volume — moins de trois semaines d’historique, aucun effet', () => {
    const without = evaluatePerformance(atCeiling(), []);
    const silent = evaluatePerformance(atCeiling(), [], {});

    expect(silent).toEqual(without);
    expect(without.allowedActions).toContain('add_set');
    expect(without.volumeWithheld).toBeUndefined();
  });

  it('ne touche pas aux signaux : le constat est le même avec ou sans plafond', () => {
    const open = evaluatePerformance(atCeiling(), []);
    const capped = evaluatePerformance(atCeiling(), [], {
      muscleVolume: { rollingSets: 10, ceiling: 10 },
    });

    expect(capped.signals).toEqual(open.signals);
  });

  it('ne dit rien quand add_set n’était pas permis de toute façon : une reprise', () => {
    const day = 86_400_000;
    const previous = line({
      exerciseId: 'bench',
      workoutId: 'w0',
      workoutStartedAt: t0,
      sets: [set({ order: 0, reps: 12 }), set({ order: 1, reps: 12 }), set({ order: 2, reps: 12 })],
    });
    const returning = line({
      exerciseId: 'bench',
      workoutId: 'w1',
      workoutStartedAt: t0 + 21 * day,
      sets: [0, 1, 2].map((order) =>
        set({ order, reps: 12, performedAt: t0 + 21 * day + order * 120_000 }),
      ),
    });

    const ev = evaluatePerformance(returning, [previous], {
      muscleVolume: { rollingSets: 10, ceiling: 10 },
    });

    expect(ev.signals.map((s) => s.code)).toContain('returning');
    expect(ev.allowedActions).not.toContain('add_set');
    expect(ev.volumeWithheld).toBeUndefined();
  });

  it('ne dit rien quand add_set n’était pas permis de toute façon : un plafond arraché', () => {
    const grinding = line({
      exerciseId: 'bench',
      workoutId: 'w1',
      sets: [0, 1, 2].map((order) => set({ order, reps: 12, rpe: 9.5 })),
    });

    const ev = evaluatePerformance(grinding, [], {
      muscleVolume: { rollingSets: 10, ceiling: 10 },
    });

    expect(ev.allowedActions).not.toContain('add_set');
    expect(ev.volumeWithheld).toBeUndefined();
  });

  it('ne dit rien quand il n’y avait aucun plafond de fourchette à franchir', () => {
    const ev = evaluatePerformance(line3x8to12([9, 9, 9]), [], {
      muscleVolume: { rollingSets: 10, ceiling: 10 },
    });

    expect(ev.volumeWithheld).toBeUndefined();
  });
});
