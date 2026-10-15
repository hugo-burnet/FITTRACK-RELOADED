import { describe, expect, it } from 'vitest';
import {
  BENCHMARK_MAX_REPS,
  benchmarkLine,
  benchmarkSignal,
  floorLoad,
  loadForReps,
  oneRepMaxOf,
  referenceReps,
  repZone,
  type BenchmarkLineInput,
} from './benchmark';

describe('oneRepMaxOf / loadForReps', () => {
  it('sont l’inverse l’un de l’autre, de 1 à 30 répétitions', () => {
    for (let reps = 1; reps <= BENCHMARK_MAX_REPS; reps += 1) {
      const max = oneRepMaxOf(100, reps);
      expect(max).toBeDefined();
      expect(loadForReps(max!, reps)).toBeCloseTo(100, 8);
    }
  });

  it('donnent des valeurs connues : 100 kg × 20 est un max de 166,7 kg, et un max de 120 kg tient 10 à 90 kg', () => {
    expect(oneRepMaxOf(100, 20)).toBeCloseTo(166.6667, 3);
    expect(loadForReps(120, 10)).toBeCloseTo(90, 8);
  });

  it('lisent un single comme le max lui-même', () => {
    expect(oneRepMaxOf(137.5, 1)).toBe(137.5);
    expect(loadForReps(137.5, 1)).toBe(137.5);
  });

  it('refusent ce que la formule ne couvre pas', () => {
    expect(oneRepMaxOf(100, 0)).toBeUndefined();
    expect(oneRepMaxOf(100, BENCHMARK_MAX_REPS + 1)).toBeUndefined();
    expect(oneRepMaxOf(100, 2.5)).toBeUndefined();
    expect(oneRepMaxOf(0, 5)).toBeUndefined();
    expect(oneRepMaxOf(-10, 5)).toBeUndefined();
    expect(oneRepMaxOf(Number.NaN, 5)).toBeUndefined();
    expect(loadForReps(100, 0)).toBeUndefined();
    expect(loadForReps(100, BENCHMARK_MAX_REPS + 1)).toBeUndefined();
    expect(loadForReps(0, 5)).toBeUndefined();
  });
});

describe('repZone', () => {
  it('lit la fourchette de la routine, quelle qu’elle soit', () => {
    expect(repZone(8, 12)).toEqual({ low: 8, high: 12 });
    expect(repZone(15, 20)).toEqual({ low: 15, high: 20 });
    expect(repZone(18, 25)).toEqual({ low: 18, high: 25 });
  });

  it('lit une cible unique comme une fourchette d’un seul point', () => {
    expect(repZone(5, undefined)).toEqual({ low: 5, high: 5 });
    expect(repZone(20, 20)).toEqual({ low: 20, high: 20 });
  });

  it('ne laisse pas un haut sous le bas', () => {
    expect(repZone(10, 8)).toEqual({ low: 10, high: 10 });
  });

  it('retombe sur 8 – 12 quand la routine n’en dit rien d’exploitable', () => {
    expect(repZone(undefined, undefined)).toEqual({ low: 8, high: 12 });
    expect(repZone(0, 5)).toEqual({ low: 8, high: 12 });
    expect(repZone(-3, undefined)).toEqual({ low: 8, high: 12 });
    expect(repZone(6.5, 8)).toEqual({ low: 8, high: 12 });
  });
});

describe('referenceReps', () => {
  it('garde deux répétitions en réserve au bas de la fourchette', () => {
    expect(referenceReps(8)).toBe(10);
    expect(referenceReps(5)).toBe(7);
  });

  it('suit les fourchettes hautes : un 15 – 20 se dimensionne sur 17, un 20 sur 22', () => {
    expect(referenceReps(15)).toBe(17);
    expect(referenceReps(18)).toBe(20);
    expect(referenceReps(20)).toBe(22);
  });

  it('ne sort pas du domaine de la formule', () => {
    expect(referenceReps(29)).toBe(BENCHMARK_MAX_REPS);
    expect(referenceReps(40)).toBe(BENCHMARK_MAX_REPS);
  });

  it('retombe sur 8 quand la routine ne prescrit rien d’exploitable', () => {
    expect(referenceReps(undefined)).toBe(10);
    expect(referenceReps(0)).toBe(10);
    expect(referenceReps(-3)).toBe(10);
    expect(referenceReps(6.5)).toBe(10);
  });
});

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
  it('transforme un max en charge de travail qui garde deux répétitions en réserve au bas de la fourchette', () => {
    const line = benchmarkLine(bench());

    expect(line.verdict).toBe('calibrated');
    expect(line.tested).toEqual({ weight: 80, reps: 9 });
    expect(line.zone).toEqual({ low: 8, high: 12 });
    // 80 × (1 + 9/30) = 104 ; 104 / (1 + 10/30) = 78 → 77,5 sur une grille de 2,5.
    expect(line.oneRepMax).toBeCloseTo(104, 8);
    expect(line.referenceReps).toBe(10);
    expect(line.suggestedKg).toBe(77.5);
    expect(line.currentKg).toBe(70);
    expect(line.rough).toBeUndefined();
    expect(line.proposal).toEqual({
      routineExerciseId: 'row-1',
      exerciseId: 'bench',
      targetSetIds: ['s0', 's1', 's2'],
      anchorSetId: 's0',
      fromWeight: 70,
      proposedWeight: 77.5,
      deltaKg: 7.5,
    });
  });

  it('laisse en paix les séries d’échauffement de la routine', () => {
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

  it('décale une pyramide en bloc au lieu de l’aplatir', () => {
    const line = benchmarkLine(bench({ routine: workingRoutine([60, 70, 80]) }));

    expect(line.proposal?.deltaKg).toBe(17.5);
    expect(line.proposal?.targetSetIds).toEqual(['s0', 's1', 's2']);
    expect(line.currentKg).toBe(80);
  });

  it('propose une charge plus basse quand la routine était trop lourde', () => {
    const line = benchmarkLine(bench({ routine: workingRoutine([90]) }));

    expect(line.proposal?.deltaKg).toBe(-12.5);
    expect(line.proposal?.proposedWeight).toBe(77.5);
  });

  it('n’écrit rien quand la routine porte déjà la charge calibrée', () => {
    const line = benchmarkLine(bench({ routine: workingRoutine([77.5, 77.5]) }));

    expect(line.verdict).toBe('calibrated');
    expect(line.suggestedKg).toBe(77.5);
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
      proposedWeight: 77.5,
    });
  });

  it('donne la charge sans écrire quand l’exercice n’est plus dans la routine, sur la fourchette par défaut', () => {
    const line = benchmarkLine(bench({ routine: undefined }));

    expect(line.zone).toEqual({ low: 8, high: 12 });
    expect(line.suggestedKg).toBe(77.5);
    expect(line.proposal).toBeUndefined();
    expect(line.aligned).toBeUndefined();
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
  });

  it('compte un pas saisi sur l’exercice à partir de la charge essayée', () => {
    const line = benchmarkLine(bench({ loadIncrementKg: 1.125 }));

    // idéal 78 ; 80 − 1 × 1,125 = 78,875 est au-dessus, 80 − 2 × 1,125 = 77,75 en dessous.
    expect(line.suggestedKg).toBe(77.75);
  });

  it('lit un single comme le max lui-même', () => {
    const line = benchmarkLine(bench({ sets: [{ weight: 130, reps: 1 }] }));

    expect(line.oneRepMax).toBe(130);
    // 130 / (1 + 10/30) = 97,5
    expect(line.suggestedKg).toBe(97.5);
  });

  it('dimensionne sur le bas de la première série de travail de la routine', () => {
    const line = benchmarkLine(bench({ routine: workingRoutine([70], 5, 5) }));

    // 104 / (1 + 7/30) = 84,3 → 82,5.
    expect(line.zone).toEqual({ low: 5, high: 5 });
    expect(line.referenceReps).toBe(7);
    expect(line.suggestedKg).toBe(82.5);
  });
});

describe('benchmarkLine — les fourchettes hautes', () => {
  it('suit un 15 – 20 : 22 répétitions à 40 kg font une charge de travail de 42,5 kg, pas de 12 répétitions', () => {
    const line = benchmarkLine(
      bench({
        equipment: 'cable',
        sets: [{ weight: 40, reps: 22 }],
        routine: workingRoutine([35, 35], 15, 20),
      }),
    );

    expect(line.verdict).toBe('calibrated');
    expect(line.zone).toEqual({ low: 15, high: 20 });
    expect(line.referenceReps).toBe(17);
    // 40 × (1 + 22/30) = 69,33 ; 69,33 / (1 + 17/30) = 44,25 → 42,5 sur la grille du câble.
    expect(line.oneRepMax).toBeCloseTo(69.3333, 3);
    expect(line.suggestedKg).toBe(42.5);
    expect(line.rough).toBeUndefined();
    expect(line.proposal?.deltaKg).toBe(7.5);
  });

  it('ne plafonne plus à 12 : la même série lue sur une fourchette de 8 à 12 donnerait bien plus lourd', () => {
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
    expect(line.referenceReps).toBe(22);
    // 30 × 1,7 = 51 ; 51 / (1 + 22/30) = 29,42 → 27,5.
    expect(line.suggestedKg).toBe(27.5);
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

  it('accepte jusqu’à 30 répétitions, et dit « trop léger » au-delà', () => {
    expect(benchmarkLine(bench({ sets: [{ weight: 20, reps: 30 }] })).verdict).toBe('calibrated');

    const line = benchmarkLine(bench({ sets: [{ weight: 20, reps: 31 }] }));
    expect(line.verdict).toBe('too_light');
    expect(line.tested).toEqual({ weight: 20, reps: 31 });
    expect(line.oneRepMax).toBeUndefined();
    expect(line.suggestedKg).toBeUndefined();
    expect(line.proposal).toBeUndefined();
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
  it('reste fiable jusqu’à six répétitions d’écart avec la référence, approximatif au-delà', () => {
    // Fourchette 8 – 12, référence 10 : 16 est à six, 17 est à sept.
    expect(benchmarkLine(bench({ sets: [{ weight: 60, reps: 16 }] })).rough).toBeUndefined();
    expect(benchmarkLine(bench({ sets: [{ weight: 60, reps: 17 }] })).rough).toBe(true);
    // Dans l'autre sens : 4 est à six, 3 est à sept.
    expect(benchmarkLine(bench({ sets: [{ weight: 100, reps: 4 }] })).rough).toBeUndefined();
    expect(benchmarkLine(bench({ sets: [{ weight: 100, reps: 3 }] })).rough).toBe(true);
  });

  it('propose quand même une charge, mais la dit approximative', () => {
    const line = benchmarkLine(bench({ sets: [{ weight: 40, reps: 25 }], routine: workingRoutine([57.5], 5, 5) }));

    expect(line.verdict).toBe('calibrated');
    expect(line.rough).toBe(true);
    // 40 × (1 + 25/30) = 73,33 ; 73,33 / (1 + 7/30) = 59,46 → 57,5.
    expect(line.suggestedKg).toBe(57.5);
  });

  it('juge l’écart sur la fourchette de chaque exercice : 22 répétitions sont proches d’un 15 – 20, loin d’un 5', () => {
    const sets = [{ weight: 40, reps: 22 }];
    expect(benchmarkLine(bench({ sets, routine: workingRoutine([35], 15, 20) })).rough).toBeUndefined();
    expect(benchmarkLine(bench({ sets, routine: workingRoutine([35], 5, 5) })).rough).toBe(true);
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

describe('benchmarkSignal — ce que le coach lit', () => {
  it('pose la charge de la fourchette comme objectif, avec les chiffres qui l’ont produite', () => {
    const signal = benchmarkSignal(benchmarkLine(bench()));

    expect(signal).toEqual({
      code: 'benchmark_calibrated',
      exerciseId: 'bench',
      nextLoadKg: 77.5,
      severity: expect.any(Number),
      evidence: [
        { label: 'tested_load_kg', value: 80 },
        { label: 'tested_reps', value: 9 },
        { label: 'one_rep_max_kg', value: 104 },
        { label: 'target_reps', value: 8 },
        { label: 'target_reps_max', value: 12 },
        { label: 'reference_reps', value: 10 },
        { label: 'current_load_kg', value: 70 },
      ],
    });
  });

  it('suit la fourchette de l’exercice : un 15 – 20 dit 15, 20 et 17', () => {
    const signal = benchmarkSignal(
      benchmarkLine(
        bench({
          equipment: 'cable',
          sets: [{ weight: 40, reps: 22 }],
          routine: workingRoutine([35], 15, 20),
        }),
      ),
    );

    expect(signal?.nextLoadKg).toBe(42.5);
    expect(signal?.evidence).toContainEqual({ label: 'target_reps', value: 15 });
    expect(signal?.evidence).toContainEqual({ label: 'target_reps_max', value: 20 });
    expect(signal?.evidence).toContainEqual({ label: 'reference_reps', value: 17 });
  });

  it('ne dit pas la charge actuelle d’une routine qui n’en porte pas', () => {
    const signal = benchmarkSignal(benchmarkLine(bench({ routine: workingRoutine([undefined]) })));

    expect(signal?.evidence.map((item) => item.label)).not.toContain('current_load_kg');
  });

  it('en pose un aussi quand la routine porte déjà la charge : il remplace l’objectif d’avant', () => {
    expect(benchmarkSignal(benchmarkLine(bench({ routine: workingRoutine([77.5]) })))).toBeDefined();
  });

  it('en pose un quand l’exercice n’est plus dans la routine : la bibliothèque le garde', () => {
    expect(benchmarkSignal(benchmarkLine(bench({ routine: undefined })))?.nextLoadKg).toBe(77.5);
  });

  it('ne reprend pas une estimation approximative : le coach ne pousse pas une extrapolation', () => {
    expect(benchmarkSignal(benchmarkLine(bench({ sets: [{ weight: 40, reps: 25 }] })))).toBeUndefined();
  });

  it('ne dit rien de ce qui n’a pas de charge à proposer', () => {
    expect(benchmarkSignal(benchmarkLine(bench({ sets: [{ weight: 20, reps: 40 }] })))).toBeUndefined();
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
