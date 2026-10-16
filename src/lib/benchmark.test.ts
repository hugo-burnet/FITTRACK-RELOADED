import { describe, expect, it } from 'vitest';
import {
  benchmarkLine,
  benchmarkSignal,
  floorLoad,
  type BenchmarkLineInput,
} from './benchmark';
import {
  BENCHMARK_GOALS,
  BENCHMARK_GOAL_TEST_REPS,
  BENCHMARK_MAX_PLANNED_SETS,
  BENCHMARK_MAX_REPS,
  capacityForSets,
  goalZone,
  setFatigue,
} from './benchmarkModel';
import { BENCHMARK_ROUGH_GAP } from './benchmark';

describe('floorLoad', () => {
  const grid = { kg: 2.5, onGrid: true };

  it('arrondit vers le bas sur la grille du matériel, jamais vers le haut', () => {
    expect(floorLoad(78.7, 80, grid)).toBe(77.5);
    expect(floorLoad(79.99, 80, grid)).toBe(77.5);
    expect(floorLoad(77.5, 80, grid)).toBe(77.5);
  });

  it('ne perd pas une charge de la grille au bruit flottant', () => {
    expect(floorLoad(77.49999999999, 80, grid)).toBe(77.5);
  });

  it('compte un pas saisi sur l’exercice à partir de la charge essayée, pas de zéro', () => {
    const typed = { kg: 1.125, onGrid: false };
    // 80 − 2 × 1,125 : un 77,625 sur une grille de multiples de 1,125 n'existerait pas sur cette pile.
    expect(floorLoad(77.9, 80, typed)).toBe(77.75);
    expect(floorLoad(81, 80, typed)).toBe(80);
  });

  it('ne descend jamais sous zéro', () => {
    expect(floorLoad(1, 80, grid)).toBe(0);
  });
});

const workingRoutine = (weights: (number | undefined)[], lo = 8, hi: number | undefined = 12) => ({
  routineExerciseId: 'row-1',
  sets: weights.map((targetWeight, index) => ({
    id: `s${index}`,
    setType: 'normal' as const,
    targetReps: lo,
    ...(hi === undefined ? {} : { targetRepsMax: hi }),
    targetWeight,
  })),
});

const bench = (overrides: Partial<BenchmarkLineInput> = {}): BenchmarkLineInput => ({
  exerciseId: 'bench',
  exerciseName: 'Développé couché',
  measurementType: 'weight_reps',
  equipment: 'barbell',
  sets: [{ weight: 80, reps: 9 }],
  routine: workingRoutine([70, 70, 70]),
  ...overrides,
});

describe('benchmarkLine — une fourchette de 8 à 12', () => {
  it('transforme un max en charge de travail qui tient les séries de la routine, deux répétitions en réserve à la dernière', () => {
    const line = benchmarkLine(bench());

    expect(line.verdict).toBe('calibrated');
    expect(line.tested).toEqual({ weight: 80, reps: 9 });
    expect(line.zone).toEqual({ low: 8, high: 12 });
    // 80 × (1 + 9/30) = 104. Trois séries à 10 % de fatigue : la première doit pouvoir faire
    // 10 / 0,9² = 12,35 répétitions, soit 104 / (1 + 12,35/30) = 73,7 → 72,5 sur une grille de 2,5.
    expect(line.oneRepMax).toBeCloseTo(104, 8);
    expect(line.plannedSets).toBe(3);
    expect(line.referenceReps).toBeCloseTo(12.3457, 3);
    expect(line.suggestedKg).toBe(72.5);
    expect(line.currentKg).toBe(70);
    expect(line.rough).toBeUndefined();
    expect(line.proposal).toEqual({
      routineExerciseId: 'row-1',
      exerciseId: 'bench',
      targetSetIds: ['s0', 's1', 's2'],
      anchorSetId: 's0',
      fromWeight: 70,
      proposedWeight: 72.5,
      deltaKg: 2.5,
    });
  });

  it('ne monte jamais avec une série de plus : la même série, une, deux, trois, quatre séries au programme', () => {
    const suggestedFor = (count: number) =>
      benchmarkLine(bench({ routine: workingRoutine(Array.from({ length: count }, () => 70)) })).suggestedKg;

    // 104 / (1 + c / 30), c = 10, 11,11, 12,35, 13,72 : 78, 75,9, 73,7, 71,4 — au plus proche sur une grille de 2,5 :
    // 77,5, 75, 72,5, et 72,5 encore (71,4 est plus près de 72,5 que de 70).
    expect([1, 2, 3, 4].map(suggestedFor)).toEqual([77.5, 75, 72.5, 72.5]);
  });

  it('n’en compte pas plus de six', () => {
    const suggestedFor = (count: number) =>
      benchmarkLine(bench({ routine: workingRoutine(Array.from({ length: count }, () => 70)) }));

    expect(suggestedFor(10).plannedSets).toBe(BENCHMARK_MAX_PLANNED_SETS);
    expect(suggestedFor(10).suggestedKg).toBe(suggestedFor(6).suggestedKg);
    // 104 / (1 + 16,94/30) = 66,5 → 67,5.
    expect(suggestedFor(6).suggestedKg).toBe(67.5);
  });

  it('laisse en paix les séries d’échauffement de la routine, et ne les compte pas', () => {
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
    // Deux séries de travail, pas trois : 104 / (1 + 11,11/30) = 75,9 → 75.
    expect(line.plannedSets).toBe(2);
    expect(line.suggestedKg).toBe(75);
  });

  it('décale une pyramide en bloc au lieu de l’aplatir, le sommet fait foi', () => {
    const line = benchmarkLine(bench({ routine: workingRoutine([60, 70, 80]) }));

    // 80 × 9 est un max de 104 kg : la série la plus lourde se dimensionne seule (77,5 kg), et le reste
    // suit du même écart — 57,5 / 67,5 / 77,5. Dimensionnée sur la première (60 kg), la pyramide montait
    // à 77,5 / 87,5 / 97,5 : 94 % du max, deux répétitions pour une prescription de 8 à 12.
    expect(line.plannedSets).toBe(1);
    expect(line.pyramid).toBe(true);
    expect(line.suggestedKg).toBe(77.5);
    expect(line.currentKg).toBe(80);
    expect(line.proposal?.deltaKg).toBe(-2.5);
    expect(line.proposal?.fromWeight).toBe(60);
    expect(line.proposal?.anchorSetId).toBe('s0');
    expect(line.proposal?.targetSetIds).toEqual(['s0', 's1', 's2']);
    // Une pyramide n'a pas « les répétitions de la série » : chaque série a sa charge.
    expect(line.holdReps).toBeUndefined();
  });

  it('lit une série dégressive comme le reste de la routine : elle ne change ni le compte ni la charge, et suit le décalage', () => {
    const straight = workingRoutine([70, 70, 70]).sets;
    const withDrop = {
      routineExerciseId: 'row-1',
      sets: [
        ...straight,
        { id: 'd', setType: 'dropset' as const, targetReps: 8, targetRepsMax: 12, targetWeight: 55 },
      ],
    };

    const line = benchmarkLine(bench({ routine: withDrop }));

    // Trois séries à tenir, comme sans la dégressive : 72,5 kg et non les 77,5 d'une « pyramide ».
    expect(line.plannedSets).toBe(3);
    expect(line.suggestedKg).toBe(72.5);
    expect(line.currentKg).toBe(70);
    expect(line.proposal?.deltaKg).toBe(2.5);
    // La dégressive est écrite avec les autres : elle garde son écart à la série de travail.
    expect(line.proposal?.targetSetIds).toEqual(['s0', 's1', 's2', 'd']);
  });

  it('propose une charge plus basse quand la routine était trop lourde', () => {
    const line = benchmarkLine(bench({ routine: workingRoutine([90]) }));

    expect(line.proposal?.deltaKg).toBe(-12.5);
    expect(line.proposal?.proposedWeight).toBe(77.5);
  });

  it('n’écrit rien quand la routine porte déjà la charge calibrée', () => {
    const line = benchmarkLine(bench({ routine: workingRoutine([72.5, 72.5, 72.5]) }));

    expect(line.verdict).toBe('calibrated');
    expect(line.suggestedKg).toBe(72.5);
    expect(line.proposal).toBeUndefined();
    expect(line.aligned).toBe(true);
  });

  it('écrit la charge elle-même quand la routine n’en portait aucune', () => {
    const line = benchmarkLine(bench({ routine: workingRoutine([undefined, undefined]) }));

    expect(line.currentKg).toBeUndefined();
    expect(line.proposal).toEqual({
      routineExerciseId: 'row-1',
      exerciseId: 'bench',
      targetSetIds: ['s0', 's1'],
      anchorSetId: 's0',
      proposedWeight: 75,
    });
  });

  it('donne la charge sans écrire quand l’exercice n’est plus dans la routine : fourchette et séries par défaut', () => {
    const line = benchmarkLine(bench({ routine: undefined }));

    expect(line.zone).toEqual({ low: 8, high: 12 });
    // Trois séries pour un polyarticulaire : la même charge que pour une routine de trois séries.
    expect(line.plannedSets).toBe(3);
    expect(line.suggestedKg).toBe(72.5);
    expect(line.proposal).toBeUndefined();
    expect(line.aligned).toBeUndefined();
  });

  it('compte le défaut de la classe quand la routine ne porte que des échauffements : deux séries pour une isolation', () => {
    const warmupOnly = {
      routineExerciseId: 'row-1',
      sets: [{ id: 'w', setType: 'warmup' as const, targetReps: 10, targetWeight: 40 }],
    };

    expect(benchmarkLine(bench({ routine: warmupOnly })).plannedSets).toBe(3);
    const isolation = benchmarkLine(bench({ routine: warmupOnly, exerciseClass: 'isolation' }));
    expect(isolation.plannedSets).toBe(2);
    // Rien à réécrire : aucune série de travail à décaler.
    expect(isolation.proposal).toBeUndefined();
  });

  it('retient la série au plus haut max estimé quand il y en a plusieurs', () => {
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
    // 112 / (1 + 12,35/30) = 79,3 → 80.
    expect(line.suggestedKg).toBe(80);
  });

  it('compte un pas saisi sur l’exercice à partir de la charge essayée', () => {
    const line = benchmarkLine(bench({ loadIncrementKg: 1.125 }));

    // idéal 73,68 ; 80 − 6 × 1,125 = 73,25 est à 0,43 kg, 80 − 5 × 1,125 = 74,375 à 0,70 kg : le plus proche est 73,25.
    expect(line.suggestedKg).toBe(73.25);
  });

  it('lit un single comme le max lui-même', () => {
    const line = benchmarkLine(bench({ sets: [{ weight: 130, reps: 1 }] }));

    expect(line.oneRepMax).toBe(130);
    // 130 / (1 + 12,35/30) = 92,1 → 92,5.
    expect(line.suggestedKg).toBe(92.5);
  });

  it('dimensionne sur le bas de la première série de travail de la routine', () => {
    const line = benchmarkLine(bench({ routine: workingRoutine([70], 5, 5) }));

    // Une seule série : 104 / (1 + 7/30) = 84,3 → 85.
    expect(line.zone).toEqual({ low: 5, high: 5 });
    expect(line.plannedSets).toBe(1);
    expect(line.referenceReps).toBe(7);
    expect(line.suggestedKg).toBe(85);
  });
});

describe('benchmarkLine — les fourchettes hautes', () => {
  it('suit un 15 – 20 : 22 répétitions à 40 kg font une charge de travail de 42,5 kg, pas de 12 répétitions', () => {
    const line = benchmarkLine(
      bench({
        equipment: 'cable',
        exerciseClass: 'isolation',
        sets: [{ weight: 40, reps: 22 }],
        routine: workingRoutine([35, 35], 15, 20),
      }),
    );

    expect(line.verdict).toBe('calibrated');
    expect(line.zone).toEqual({ low: 15, high: 20 });
    // Deux séries d'une isolation (8 % de fatigue) : la première doit pouvoir faire 17 / 0,92 = 18,48
    // répétitions. 40 × (1 + 22/30) = 69,33 ; 69,33 / (1 + 18,48/30) = 42,9 → 42,5 sur la grille du câble.
    expect(line.plannedSets).toBe(2);
    expect(line.referenceReps).toBeCloseTo(18.4783, 3);
    expect(line.oneRepMax).toBeCloseTo(69.3333, 3);
    expect(line.suggestedKg).toBe(42.5);
    expect(line.rough).toBeUndefined();
    expect(line.proposal?.deltaKg).toBe(7.5);
  });

  it('retrouve l’exemple de la personne : 80 kg, 17 répétitions, un 15 – 20 sur trois séries', () => {
    const input = (overrides: Partial<BenchmarkLineInput>) =>
      bench({ sets: [{ weight: 80, reps: 17 }], routine: workingRoutine([70, 70, 70], 15, 20), ...overrides });

    // 80 × (1 + 17/30) = 125,3. Polyarticulaire : 17 / 0,9² = 20,99 répétitions pour la première série,
    // 125,3 / (1 + 20,99/30) = 73,7 → 72,5. L'essai en est à 4 répétitions : fiable.
    const compound = benchmarkLine(input({}));
    expect(compound.suggestedKg).toBe(72.5);
    expect(compound.referenceReps).toBeCloseTo(20.9877, 3);
    expect(compound.rough).toBeUndefined();

    // Une isolation fatigue moins : 17 / 0,92² = 20,09 répétitions → 75,07 → 75.
    const isolation = benchmarkLine(input({ exerciseClass: 'isolation' }));
    expect(isolation.suggestedKg).toBe(75);
    expect(isolation.referenceReps).toBeCloseTo(20.0851, 3);
    expect(isolation.referenceReps!).toBeLessThan(compound.referenceReps!);
  });

  it('descend la charge quand le repos raccourcit, la monte quand il s’allonge', () => {
    const withRest = (restSeconds: number) =>
      benchmarkLine(
        bench({
          sets: [{ weight: 80, reps: 17 }],
          routine: workingRoutine([70, 70, 70], 15, 20),
          restSeconds,
        }),
      ).suggestedKg;

    // Une minute : 20 % de fatigue, 17 / 0,8² = 26,6 répétitions → 66,5 → 67,5.
    // Trois minutes : 6,7 %, 17 / 0,933² = 19,5 répétitions → 75,9 → 75.
    expect([60, 120, 180].map(withRest)).toEqual([67.5, 72.5, 75]);
  });

  it('compte deux minutes sans repos connu : la même charge qu’un repos de 120 secondes', () => {
    const sets = [{ weight: 80, reps: 17 }];
    const routine = workingRoutine([70, 70, 70], 15, 20);

    expect(benchmarkLine(bench({ sets, routine })).referenceReps).toBe(
      benchmarkLine(bench({ sets, routine, restSeconds: 120 })).referenceReps,
    );
  });

  it('plafonne la capacité exigée à 30 répétitions : six séries d’un 20 ne demandent pas plus que la formule ne sait dire', () => {
    const line = benchmarkLine(
      bench({
        equipment: 'cable',
        sets: [{ weight: 30, reps: 21 }],
        routine: workingRoutine([25, 25, 25, 25, 25, 25], 20, 20),
      }),
    );

    expect(line.plannedSets).toBe(6);
    expect(line.referenceReps).toBe(BENCHMARK_MAX_REPS);
    // 30 × 1,7 = 51 ; 51 / (1 + 30/30) = 25,5 → 25.
    expect(line.suggestedKg).toBe(25);
  });

  it('ne plafonne pas à 12 : la même série lue sur une fourchette de 8 à 12 donnerait bien plus lourd', () => {
    const high = benchmarkLine(
      bench({ equipment: 'cable', sets: [{ weight: 40, reps: 16 }], routine: workingRoutine([35], 15, 20) }),
    );
    const low = benchmarkLine(
      bench({ equipment: 'cable', sets: [{ weight: 40, reps: 16 }], routine: workingRoutine([35], 8, 12) }),
    );

    expect(high.suggestedKg).toBeLessThan(low.suggestedKg!);
  });

  it('suit une cible unique de 20 : 21 répétitions à 30 kg se dimensionnent sur 22', () => {
    const line = benchmarkLine(
      bench({
        equipment: 'cable',
        sets: [{ weight: 30, reps: 21 }],
        routine: workingRoutine([25], 20, 20),
      }),
    );

    expect(line.zone).toEqual({ low: 20, high: 20 });
    expect(line.plannedSets).toBe(1);
    expect(line.referenceReps).toBe(22);
    // 30 × 1,7 = 51 ; 51 / (1 + 22/30) = 29,42 → 30.
    expect(line.suggestedKg).toBe(30);
  });

  it('lit un 18 : 20 répétitions à 25 kg se dimensionnent sur 20', () => {
    const line = benchmarkLine(
      bench({
        equipment: 'cable',
        sets: [{ weight: 25, reps: 20 }],
        routine: workingRoutine([20], 18, 18),
      }),
    );

    expect(line.referenceReps).toBe(20);
    // L'essai est pile à la référence : la charge de travail est la charge essayée, arrondie vers le bas.
    expect(line.suggestedKg).toBe(25);
  });

  it('lit jusqu’à 30 répétitions comme un max, et donne un minimum au-delà', () => {
    const readable = benchmarkLine(bench({ sets: [{ weight: 20, reps: 30 }] }));
    expect(readable.verdict).toBe('calibrated');
    expect(readable.minimum).toBeUndefined();

    const line = benchmarkLine(bench({ sets: [{ weight: 20, reps: 31 }] }));
    expect(line.verdict).toBe('calibrated');
    expect(line.minimum).toBe(true);
    expect(line.tested).toEqual({ weight: 20, reps: 31 });
    // Au-delà de 30 le max ne se calcule plus : on sait seulement qu'il est au moins celui de 30 répétitions.
    expect(line.oneRepMax).toBe(40);
    expect(line.holdReps).toBeUndefined();
  });

  it('préfère une série lisible à une série trop légère', () => {
    const line = benchmarkLine(
      bench({
        sets: [
          { weight: 20, reps: 40 },
          { weight: 80, reps: 9 },
        ],
      }),
    );

    expect(line.verdict).toBe('calibrated');
    expect(line.tested).toEqual({ weight: 80, reps: 9 });
  });
});

describe('benchmarkLine — un essai loin de la fourchette', () => {
  const single = workingRoutine([70]);

  it('reste fiable jusqu’à six répétitions sous la capacité exigée, approximatif au-delà', () => {
    // Une série d'un 8 – 12 : la capacité exigée est 10. En dessous : 4 est à six, 3 est à sept.
    expect(benchmarkLine(bench({ routine: single, sets: [{ weight: 100, reps: 4 }] })).rough).toBeUndefined();
    expect(benchmarkLine(bench({ routine: single, sets: [{ weight: 100, reps: 3 }] })).rough).toBe(true);
  });

  it('au-dessus de la capacité exigée, juge le saut de charge et non l’écart de répétitions : 30 % de plus que l’essai, pas davantage', () => {
    // Une série d'un 8 – 12 (capacité exigée 10), 60 kg sur la grille de la barre : 22 répétitions → 77,5 kg (+29 %),
    // 23 → 80 kg (+33 %). Avant, tout écart de plus de six répétitions était approximatif, même vers le haut.
    expect(benchmarkLine(bench({ routine: single, sets: [{ weight: 60, reps: 22 }] })).rough).toBeUndefined();
    expect(benchmarkLine(bench({ routine: single, sets: [{ weight: 60, reps: 23 }] })).rough).toBe(true);
  });

  it('juge l’écart sur la capacité de la première série, pas sur le bas de la fourchette plus la réserve', () => {
    // Trois séries d'un 8 – 12 : la capacité exigée est 12,35, pas 10. En dessous : 7 est à 5,35, 6 à 6,35.
    expect(benchmarkLine(bench({ sets: [{ weight: 100, reps: 7 }] })).rough).toBeUndefined();
    expect(benchmarkLine(bench({ sets: [{ weight: 100, reps: 6 }] })).rough).toBe(true);
    // Au-dessus, le saut de charge : 60 × 25 → 77,5 kg (+29 %), 60 × 26 → 80 kg (+33 %).
    expect(benchmarkLine(bench({ sets: [{ weight: 60, reps: 25 }] })).rough).toBeUndefined();
    expect(benchmarkLine(bench({ sets: [{ weight: 60, reps: 26 }] })).rough).toBe(true);
  });

  it('propose quand même une charge, mais la dit approximative', () => {
    const line = benchmarkLine(bench({ sets: [{ weight: 40, reps: 25 }], routine: workingRoutine([57.5], 5, 5) }));

    expect(line.verdict).toBe('calibrated');
    expect(line.rough).toBe(true);
    // 40 × (1 + 25/30) = 73,33 ; 73,33 / (1 + 7/30) = 59,46 → 60.
    expect(line.suggestedKg).toBe(60);
  });

  it('juge l’écart sur la fourchette de chaque exercice : 22 répétitions sont proches d’un 15 – 20, loin d’un 5', () => {
    const sets = [{ weight: 40, reps: 22 }];
    expect(benchmarkLine(bench({ sets, routine: workingRoutine([35], 15, 20) })).rough).toBeUndefined();
    expect(benchmarkLine(bench({ sets, routine: workingRoutine([35], 5, 5) })).rough).toBe(true);
  });
});

describe('benchmarkLine — très au-dessus de la fourchette', () => {
  // Valeurs de référence calculées à part (script Python hors du dépôt). Une machine au pas de 2,5 kg, compté
  // depuis la charge essayée ; 40 kg × N répétitions, style léger (15 – 20).
  const light = (reps: number, routine = workingRoutine([35, 35, 35])) =>
    benchmarkLine(
      bench({
        goal: 'light',
        equipment: 'machine',
        loadIncrementKg: 2.5,
        sets: [{ weight: 40, reps }],
        routine,
      }),
    );

  it('remet dans le 15 – 20 sans « approximatif » : 40 × 27 propose 45 kg, cochée et lue par le coach', () => {
    const line = light(27);

    expect(line.rough).toBeUndefined();
    expect(line.suggestedKg).toBe(45);
    expect(line.proposal).toBeDefined();
    expect(benchmarkSignal(line)).toMatchObject({ code: 'benchmark_calibrated', nextLoadKg: 45 });
  });

  it('va jusqu’à 30 répétitions : 40 × 30 propose 47,5 kg, 19 % de plus que l’essai', () => {
    const line = light(30);

    expect(line.rough).toBeUndefined();
    expect(line.suggestedKg).toBe(47.5);
    expect(benchmarkSignal(line)).toMatchObject({ nextLoadKg: 47.5 });
  });

  it('monte plus haut quand la routine n’a qu’une série, sans dépasser 30 % : 40 × 30 → 50 kg', () => {
    const line = light(30, workingRoutine([35]));

    expect(line.plannedSets).toBe(1);
    expect(line.suggestedKg).toBe(50);
    expect(line.rough).toBeUndefined();
  });

  it('reste approximatif quand la charge dépasse l’essai de plus de 30 % : un 8 – 12 testé à 30 répétitions', () => {
    // 40 × 30 est un max de 80 kg ; trois séries d'un 8 – 12 : 56,7 → 57,5 kg, soit +44 %.
    const line = benchmarkLine(
      bench({ goal: 'classic', sets: [{ weight: 40, reps: 30 }], routine: workingRoutine([35, 35, 35]) }),
    );

    expect(line.suggestedKg).toBe(57.5);
    expect(line.rough).toBe(true);
    expect(line.proposal).toBeDefined();
    expect(benchmarkSignal(line)).toBeUndefined();
  });
});

describe('benchmarkLine — plus de 30 répétitions : un minimum', () => {
  const light = (sets: BenchmarkLineInput['sets']) =>
    benchmarkLine(
      bench({
        goal: 'light',
        equipment: 'machine',
        loadIncrementKg: 2.5,
        sets,
        routine: workingRoutine([35, 35, 35]),
      }),
    );

  it('dimensionne comme si l’essai était de 30 répétitions : 40 × 35 propose au moins 47,5 kg', () => {
    const line = light([{ weight: 40, reps: 35 }]);

    expect(line.verdict).toBe('calibrated');
    expect(line.minimum).toBe(true);
    expect(line.tested).toEqual({ weight: 40, reps: 35 });
    // Le max d'une série de 30 répétitions : le vrai est au moins celui-là.
    expect(line.oneRepMax).toBe(80);
    expect(line.suggestedKg).toBe(47.5);
    expect(line.referenceReps).toBeCloseTo(20.99, 2);
    expect(line.rough).toBeUndefined();
    expect(line.proposal).toBeDefined();
  });

  it('ne dit pas ce qu’on tiendra : ce n’est qu’un minimum', () => {
    expect(light([{ weight: 40, reps: 35 }]).holdReps).toBeUndefined();
  });

  it('est lu par le coach, avec le drapeau qui dit que le max est un plancher', () => {
    const signal = benchmarkSignal(light([{ weight: 40, reps: 35 }]));

    expect(signal).toMatchObject({ code: 'benchmark_calibrated', nextLoadKg: 47.5 });
    expect(signal!.evidence).toEqual(
      expect.arrayContaining([
        { label: 'tested_reps', value: 35 },
        { label: 'one_rep_max_kg', value: 80 },
        { label: 'one_rep_max_floor', value: 1 },
      ]),
    );
  });

  it('ne pose pas le drapeau pour un max qui se calcule', () => {
    const signal = benchmarkSignal(light([{ weight: 40, reps: 27 }]));

    expect(signal!.evidence.map((item) => item.label)).not.toContain('one_rep_max_floor');
  });

  it('reste approximatif quand le minimum dépasse l’essai de plus de 30 % : un 8 – 12 testé à 35 répétitions', () => {
    const line = benchmarkLine(
      bench({ goal: 'classic', sets: [{ weight: 40, reps: 35 }], routine: workingRoutine([35, 35, 35]) }),
    );

    expect(line.minimum).toBe(true);
    expect(line.suggestedKg).toBe(57.5);
    expect(line.rough).toBe(true);
    expect(benchmarkSignal(line)).toBeUndefined();
  });

  it('laisse une série lisible l’emporter sur un minimum', () => {
    const line = light([
      { weight: 40, reps: 35 },
      { weight: 60, reps: 20 },
    ]);

    expect(line.minimum).toBeUndefined();
    expect(line.tested).toEqual({ weight: 60, reps: 20 });
  });
});

describe('benchmarkLine — le pas renseigné dans l’appli', () => {
  // Valeurs de référence calculées à part (script Python hors du dépôt). La séance du 16 octobre : des machines, un
  // pas de 1,125 kg (de petites plaques), le style léger, trois séries.
  const machine = (weight: number, reps: number, exerciseClass: 'compound' | 'isolation' = 'isolation') =>
    benchmarkLine(
      bench({
        exerciseClass,
        equipment: 'machine',
        loadIncrementKg: 1.125,
        goal: 'light',
        sets: [{ weight, reps }],
        routine: workingRoutine([weight - 5, weight - 5, weight - 5]),
      }),
    );

  it('arrondit au pas le plus proche : 35 × 20 propose 35, pas 33,875', () => {
    // Le calcul dit 34,94 kg. Arrondi vers le bas, un cran entier sous 35 pour 0,06 kg.
    const line = machine(35, 20);

    expect(line.suggestedKg).toBe(35);
    expect(line.holdReps).toEqual([20, 18, 16]);
  });

  it('compte le pas depuis la charge essayée : 37,5 × 22 propose 38,625, 55 × 26 propose 61,75', () => {
    expect(machine(37.5, 22).suggestedKg).toBe(38.625);
    expect(machine(55, 26).suggestedKg).toBe(61.75);
    expect(machine(110, 25, 'compound').suggestedKg).toBe(119);
  });

  it('suit le pas du matériel quand l’exercice n’en a pas saisi : une machine à 5 kg, le multiple de 5 le plus proche', () => {
    const line = benchmarkLine(
      bench({
        exerciseClass: 'isolation',
        equipment: 'machine',
        goal: 'light',
        sets: [{ weight: 35, reps: 20 }],
        routine: workingRoutine([30, 30, 30]),
      }),
    );

    // 34,94 kg → 35, et non 30 : l'ancien arrondi vers le bas coûtait ici 14 %.
    expect(line.suggestedKg).toBe(35);
  });
});

describe('benchmarkLine — les cas sans charge à proposer', () => {
  it('ne lit pas un max sans charge', () => {
    expect(benchmarkLine(bench({ sets: [{ reps: 10 }] })).verdict).toBe('no_load');
    expect(benchmarkLine(bench({ sets: [{ weight: 0, reps: 10 }] })).verdict).toBe('no_load');
  });

  it('dit qu’une charge sous le premier cran du matériel n’est pas lisible plutôt que zéro', () => {
    const line = benchmarkLine(bench({ sets: [{ weight: 1, reps: 10 }], equipment: 'barbell' }));

    expect(line.verdict).toBe('no_load');
    expect(line.proposal).toBeUndefined();
  });

  it('note les répétitions d’un exercice au poids du corps, sans proposition', () => {
    const line = benchmarkLine({
      exerciseId: 'pullup',
      exerciseName: 'Tractions',
      measurementType: 'reps_only',
      equipment: 'bodyweight',
      sets: [{ reps: 11 }],
      routine: workingRoutine([undefined]),
    });

    expect(line.verdict).toBe('recorded');
    expect(line.tested).toEqual({ reps: 11 });
    expect(line.suggestedKg).toBeUndefined();
    expect(line.proposal).toBeUndefined();
  });

  it('garde le plus de répétitions parmi des séries au poids du corps', () => {
    const line = benchmarkLine({
      exerciseId: 'pullup',
      exerciseName: 'Tractions',
      measurementType: 'reps_only',
      equipment: 'bodyweight',
      sets: [{ reps: 8 }, { reps: 11 }, { reps: 9 }],
    });

    expect(line.tested).toEqual({ reps: 11 });
  });

  it('note le maintien d’un exercice chronométré', () => {
    const line = benchmarkLine({
      exerciseId: 'plank',
      exerciseName: 'Gainage',
      measurementType: 'time_only',
      equipment: 'bodyweight',
      sets: [{ durationSeconds: 75 }, { durationSeconds: 90 }],
    });

    expect(line.verdict).toBe('recorded');
    expect(line.tested).toEqual({ durationSeconds: 90 });
  });

  it('donne ses répétitions à un exercice assisté, sans charge', () => {
    const line = benchmarkLine({
      exerciseId: 'assisted',
      exerciseName: 'Tractions assistées',
      measurementType: 'assisted_weight_reps',
      equipment: 'machine',
      sets: [{ weight: 30, reps: 8 }],
      routine: workingRoutine([30]),
    });

    expect(line.verdict).toBe('recorded');
    expect(line.tested).toEqual({ weight: 30, reps: 8 });
    expect(line.proposal).toBeUndefined();
  });

  it('marque un exercice que personne n’a fait', () => {
    expect(benchmarkLine(bench({ sets: [] })).verdict).toBe('skipped');
  });
});

describe('benchmarkLine — les pyramides', () => {
  const routineOf = (...sets: { w: number; lo: number; hi?: number }[]) => ({
    routineExerciseId: 'row-1',
    sets: sets.map((set, index) => ({
      id: `s${index}`,
      setType: 'normal' as const,
      targetReps: set.lo,
      ...(set.hi === undefined ? {} : { targetRepsMax: set.hi }),
      targetWeight: set.w,
    })),
  });

  it('lit une descendante comme avant : la première est déjà la plus lourde', () => {
    const line = benchmarkLine(bench({ routine: workingRoutine([80, 70, 60]) }));

    expect(line.suggestedKg).toBe(77.5);
    expect(line.proposal?.deltaKg).toBe(-2.5);
    expect(line.proposal?.fromWeight).toBe(80);
  });

  it('plafonne par la fourchette propre à chaque série : 75 kg × 20 puis 80 kg × 8', () => {
    const line = benchmarkLine(
      bench({ routine: routineOf({ w: 75, lo: 20 }, { w: 80, lo: 8 }) }),
    );

    // La série à 20 répétitions se dimensionne à 60 kg (−15), celle à 8 à 77,5 (−2,5) : on prend l'écart
    // le plus prudent, sans quoi la première se retrouvait à 72,5 kg pour 20 répétitions (13 de possibles).
    expect(line.proposal?.deltaKg).toBe(-15);
    expect(line.suggestedKg).toBe(65);
  });

  it('est alignée quand la pyramide est déjà au plafond', () => {
    const line = benchmarkLine(bench({ routine: workingRoutine([57.5, 67.5, 77.5]) }));

    expect(line.aligned).toBe(true);
    expect(line.proposal).toBeUndefined();
  });

  it('ne fait pas d’une charge unique une pyramide, ni d’une série sans charge', () => {
    expect(benchmarkLine(bench({ routine: workingRoutine([70, 70, 70]) })).pyramid).toBeUndefined();
    expect(benchmarkLine(bench({ routine: workingRoutine([70, undefined, 70]) })).pyramid).toBeUndefined();
  });

  it('ne pose pas d’objectif au coach : un objectif est un seul chiffre, et il aplatirait la pyramide', () => {
    const line = benchmarkLine(bench({ routine: workingRoutine([60, 70, 80]) }));

    expect(line.verdict).toBe('calibrated');
    expect(benchmarkSignal(line)).toBeUndefined();
  });
});

describe('benchmarkLine — le style choisi au lancement', () => {
  // Valeurs de référence calculées à part (script Python hors du dépôt), cf. la spec §3.
  it('léger : 40 × 18 propose 37,5 kg pour du 15 – 20 sur trois séries, et dit ce qu’on y tient', () => {
    const line = benchmarkLine(
      bench({ goal: 'light', sets: [{ weight: 40, reps: 18 }], routine: workingRoutine([35, 35, 35]) }),
    );

    expect(line.goal).toBe('light');
    expect(line.zone).toEqual({ low: 15, high: 20 });
    expect(line.plannedSets).toBe(3);
    expect(line.suggestedKg).toBe(37.5);
    expect(line.holdReps).toEqual([21, 19, 17]);
    expect(line.rough).toBeUndefined();
  });

  it('classique : 52,5 × 13 propose 52,5 kg pour du 8 – 12 sur trois séries', () => {
    const line = benchmarkLine(
      bench({ goal: 'classic', sets: [{ weight: 52.5, reps: 13 }], routine: workingRoutine([50, 50, 50]) }),
    );

    expect(line.zone).toEqual({ low: 8, high: 12 });
    expect(line.suggestedKg).toBe(52.5);
    expect(line.holdReps).toEqual([13, 11, 10]);
  });

  it('classique sur une machine au pas de 5 kg : 55 kg, le multiple de 5 le plus proche, trois séries tenues à fond de 11, 9 et 8', () => {
    const line = benchmarkLine(
      bench({
        goal: 'classic',
        equipment: 'machine',
        sets: [{ weight: 52.5, reps: 13 }],
        routine: workingRoutine([50, 50, 50]),
      }),
    );

    expect(line.suggestedKg).toBe(55);
    expect(line.holdReps).toEqual([11, 9, 8]);
  });

  it('lourd : 100 × 5 propose 90 kg pour du 5 – 8 sur trois séries', () => {
    const line = benchmarkLine(
      bench({ goal: 'heavy', sets: [{ weight: 100, reps: 5 }], routine: workingRoutine([85, 85, 85]) }),
    );

    // 100 × 5 est un max de 116,7 kg. Trois séries d'un 5 – 8 : la première doit pouvoir en faire
    // 7 / 0,9² = 8,64, soit 116,7 / (1 + 8,64 / 30) = 90,6 → 90 kg. On y tient 8 · 8 · 7 : sept à la dernière,
    // deux de réserve sur le 5.
    expect(line.zone).toEqual({ low: 5, high: 8 });
    expect(line.suggestedKg).toBe(90);
    expect(line.holdReps).toEqual([8, 8, 7]);
    expect(line.rough).toBeUndefined();
  });

  it('dimensionne sur la fourchette du style, pas sur celle de la routine', () => {
    // La routine dit 8 – 12 ; le style léger vise 15 – 20 : la charge est celle d'un 15 – 20.
    const light = benchmarkLine(
      bench({ goal: 'light', sets: [{ weight: 40, reps: 18 }], routine: workingRoutine([35, 35, 35], 8, 12) }),
    );
    const fromRoutine = benchmarkLine(
      bench({ sets: [{ weight: 40, reps: 18 }], routine: workingRoutine([35, 35, 35], 8, 12) }),
    );

    expect(light.suggestedKg).toBe(37.5);
    expect(fromRoutine.suggestedKg).toBeGreaterThan(light.suggestedKg!);
    expect(fromRoutine.goal).toBeUndefined();
  });

  it('juge « approximatif » sur la fourchette du style : 25 répétitions pour un 5 – 8 demandent 57,5 kg, 44 % de plus que l’essai', () => {
    const line = benchmarkLine(
      bench({ goal: 'heavy', sets: [{ weight: 40, reps: 25 }], routine: workingRoutine([90, 90, 90]) }),
    );

    expect(line.suggestedKg).toBe(57.5);
    expect(line.rough).toBe(true);
    expect(benchmarkSignal(line)).toBeUndefined();

    // 18 répétitions demandent 50 kg (+25 %) : une extrapolation qu'on écrit.
    const lighter = benchmarkLine(
      bench({ goal: 'heavy', sets: [{ weight: 40, reps: 18 }], routine: workingRoutine([90, 90, 90]) }),
    );
    expect(lighter.suggestedKg).toBe(50);
    expect(lighter.rough).toBeUndefined();
  });

  describe('et la fourchette qu’il écrit dans la routine', () => {
    it('l’écrit avec la charge quand la routine n’est pas dans le style', () => {
      const line = benchmarkLine(
        bench({
          goal: 'light',
          sets: [{ weight: 40, reps: 18 }],
          routine: workingRoutine([35, 35, 35], 8, 12),
        }),
      );

      expect(line.proposal?.zone).toEqual({ low: 15, high: 20, setIds: ['s0', 's1', 's2'] });
      expect(line.proposal?.deltaKg).toBe(2.5);
    });

    it('ne l’écrit pas quand la routine est déjà dans le style', () => {
      const line = benchmarkLine(
        bench({
          goal: 'classic',
          sets: [{ weight: 52.5, reps: 13 }],
          routine: workingRoutine([50, 50, 50], 8, 12),
        }),
      );

      expect(line.proposal?.zone).toBeUndefined();
      expect(line.proposal?.deltaKg).toBe(2.5);
    });

    it('propose la fourchette seule quand la charge est déjà la bonne', () => {
      const line = benchmarkLine(
        bench({
          goal: 'light',
          sets: [{ weight: 40, reps: 18 }],
          routine: workingRoutine([37.5, 37.5, 37.5], 8, 12),
        }),
      );

      expect(line.aligned).toBeUndefined();
      expect(line.proposal?.deltaKg).toBe(0);
      expect(line.proposal?.zone).toEqual({ low: 15, high: 20, setIds: ['s0', 's1', 's2'] });
    });

    it('est alignée quand la charge et la fourchette sont déjà celles du style', () => {
      const line = benchmarkLine(
        bench({
          goal: 'light',
          sets: [{ weight: 40, reps: 18 }],
          routine: workingRoutine([37.5, 37.5, 37.5], 15, 20),
        }),
      );

      expect(line.aligned).toBe(true);
      expect(line.proposal).toBeUndefined();
    });

    it('ne l’écrit jamais sans style : la routine garde sa fourchette', () => {
      const line = benchmarkLine(bench({ routine: workingRoutine([35, 35, 35], 15, 20) }));

      expect(line.proposal?.zone).toBeUndefined();
    });

    it('ne l’écrit pas sur une dégressive, qui garde ses propres répétitions', () => {
      const routine = {
        routineExerciseId: 'row-1',
        sets: [
          ...workingRoutine([35, 35, 35], 8, 12).sets,
          { id: 'd', setType: 'dropset' as const, targetReps: 10, targetWeight: 25 },
        ],
      };
      const line = benchmarkLine(
        bench({ goal: 'light', sets: [{ weight: 40, reps: 18 }], routine }),
      );

      expect(line.proposal?.zone?.setIds).toEqual(['s0', 's1', 's2']);
      // Mais elle suit le décalage de charge avec les autres.
      expect(line.proposal?.targetSetIds).toEqual(['s0', 's1', 's2', 'd']);
    });

    it('lit une cible unique comme une fourchette d’un seul point : « 5 » est un 5 – 5', () => {
      // Une routine à `targetReps: 5` sans haut porte le bas du 5 – 8 mais pas son haut : c'est un 5 – 5, pas
      // un « lourd ». Comparer le seul bas la prendrait pour déjà écrite, et la fourchette ne le serait jamais.
      const line = benchmarkLine(
        bench({
          goal: 'heavy',
          sets: [{ weight: 100, reps: 5 }],
          routine: workingRoutine([85, 85, 85], 5, undefined),
        }),
      );

      expect(line.proposal?.zone).toEqual({ low: 5, high: 8, setIds: ['s0', 's1', 's2'] });
    });
  });

  it('ne dit rien de plus pour un exercice qui ne se mesure pas en charge', () => {
    const line = benchmarkLine({
      exerciseId: 'plank',
      exerciseName: 'Gainage',
      measurementType: 'time_only',
      equipment: 'bodyweight',
      goal: 'light',
      sets: [{ durationSeconds: 60 }],
      routine: workingRoutine([undefined]),
    });

    expect(line.verdict).toBe('recorded');
    expect(line.proposal).toBeUndefined();
    expect(line.holdReps).toBeUndefined();
  });
});

describe('les répétitions qu’on conseille de viser dans l’essai de chaque style', () => {
  it('sont assez près de ce que la première série doit tenir pour que l’estimation soit fiable', () => {
    for (const goal of BENCHMARK_GOALS) {
      const low = goalZone(goal).low;
      // De une à trois séries, polyarticulaire (10 %) ou isolation (8 %) : les routines courantes.
      for (const sets of [1, 2, 3]) {
        for (const rest of [undefined, 90, 180]) {
          for (const klass of ['compound', 'isolation'] as const) {
            const reference = capacityForSets(low, sets, setFatigue(klass, rest));
            const gap = Math.abs(BENCHMARK_GOAL_TEST_REPS[goal] - reference);
            expect(gap, `${goal} · ${sets} séries · ${klass} · repos ${rest}`).toBeLessThanOrEqual(
              BENCHMARK_ROUGH_GAP,
            );
          }
        }
      }
    }
  });

  it('tombent dans la fourchette du style, ou juste au-dessus', () => {
    for (const goal of BENCHMARK_GOALS) {
      const zone = goalZone(goal);
      expect(BENCHMARK_GOAL_TEST_REPS[goal]).toBeGreaterThanOrEqual(zone.low);
    }
  });
});

describe('benchmarkSignal — ce que le coach lit', () => {
  it('pose la charge de la fourchette comme objectif, avec les chiffres qui l’ont produite', () => {
    const signal = benchmarkSignal(benchmarkLine(bench()));

    expect(signal).toEqual({
      code: 'benchmark_calibrated',
      exerciseId: 'bench',
      nextLoadKg: 72.5,
      severity: expect.any(Number),
      evidence: [
        { label: 'tested_load_kg', value: 80 },
        { label: 'tested_reps', value: 9 },
        { label: 'one_rep_max_kg', value: 104 },
        { label: 'target_reps', value: 8 },
        { label: 'target_reps_max', value: 12 },
        { label: 'planned_sets', value: 3 },
        // 12,3457 arrondi à une décimale : un chiffre de plus en dirait plus que le modèle n'en sait.
        { label: 'reference_reps', value: 12.3 },
        { label: 'current_load_kg', value: 70 },
      ],
    });
  });

  it('suit la fourchette de l’exercice : un 15 – 20 dit 15, 20, une série et 17', () => {
    const signal = benchmarkSignal(
      benchmarkLine(
        bench({
          equipment: 'cable',
          sets: [{ weight: 40, reps: 22 }],
          routine: workingRoutine([35], 15, 20),
        }),
      ),
    );

    expect(signal?.nextLoadKg).toBe(45);
    expect(signal?.evidence).toContainEqual({ label: 'target_reps', value: 15 });
    expect(signal?.evidence).toContainEqual({ label: 'target_reps_max', value: 20 });
    expect(signal?.evidence).toContainEqual({ label: 'planned_sets', value: 1 });
    expect(signal?.evidence).toContainEqual({ label: 'reference_reps', value: 17 });
  });

  it('dit le nombre de séries sur lequel la charge a été dimensionnée', () => {
    const planned = (count: number) =>
      benchmarkSignal(
        benchmarkLine(bench({ routine: workingRoutine(Array.from({ length: count }, () => 70)) })),
      )?.evidence.find((item) => item.label === 'planned_sets')?.value;

    expect([1, 2, 4].map(planned)).toEqual([1, 2, 4]);
  });

  it('ne dit pas la charge actuelle d’une routine qui n’en porte pas', () => {
    const signal = benchmarkSignal(benchmarkLine(bench({ routine: workingRoutine([undefined]) })));

    expect(signal?.evidence.map((item) => item.label)).not.toContain('current_load_kg');
  });

  it('en pose un aussi quand la routine porte déjà la charge : il remplace l’objectif d’avant', () => {
    expect(benchmarkSignal(benchmarkLine(bench({ routine: workingRoutine([77.5]) })))).toBeDefined();
  });

  it('en pose un quand l’exercice n’est plus dans la routine : la bibliothèque le garde', () => {
    expect(benchmarkSignal(benchmarkLine(bench({ routine: undefined })))?.nextLoadKg).toBe(72.5);
  });

  it('ne reprend pas une estimation approximative : le coach ne pousse pas une extrapolation', () => {
    // 40 × 30 pour un 8 – 12 sur trois séries demande 55 kg (+37,5 %) ; 100 × 3 est à neuf répétitions sous la capacité exigée.
    expect(benchmarkSignal(benchmarkLine(bench({ sets: [{ weight: 40, reps: 30 }] })))).toBeUndefined();
    expect(benchmarkSignal(benchmarkLine(bench({ sets: [{ weight: 100, reps: 3 }] })))).toBeUndefined();
  });

  it('reprend un essai très au-dessus quand la charge reste à moins de 30 % de plus : 40 × 24 pour un 8 – 12, 50 kg', () => {
    expect(benchmarkSignal(benchmarkLine(bench({ sets: [{ weight: 40, reps: 24 }] })))).toMatchObject({
      code: 'benchmark_calibrated',
      nextLoadKg: 50,
    });
  });

  it('ne dit rien de ce qui n’a pas de charge à proposer', () => {
    // Des répétitions décimales : la formule ne les lit pas.
    expect(benchmarkSignal(benchmarkLine(bench({ sets: [{ weight: 20, reps: 12.5 }] })))).toBeUndefined();
    expect(benchmarkSignal(benchmarkLine(bench({ sets: [{ reps: 10 }] })))).toBeUndefined();
    expect(benchmarkSignal(benchmarkLine(bench({ sets: [] })))).toBeUndefined();
    expect(
      benchmarkSignal(
        benchmarkLine({
          exerciseId: 'pullup',
          exerciseName: 'Tractions',
          measurementType: 'reps_only',
          equipment: 'bodyweight',
          sets: [{ reps: 11 }],
        }),
      ),
    ).toBeUndefined();
  });
});
