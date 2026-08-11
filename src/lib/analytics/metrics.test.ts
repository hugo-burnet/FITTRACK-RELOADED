import { describe, expect, it } from 'vitest';
import type { MeasurementType, WorkoutSet } from '@/data/types';
import {
  availableMetrics,
  bestPointIndex,
  metricDefinition,
  metricSeries,
  type AnalyticsSet,
  type AnalyticsSession,
} from './metrics';

let sequence = 0;

const aSet = (values: Partial<WorkoutSet>): WorkoutSet => ({
  id: `set-${(sequence += 1)}`,
  createdAt: 0,
  updatedAt: 0,
  deletedAt: 0,
  workoutExerciseId: 'we',
  exerciseId: 'ex',
  workoutId: 'w',
  order: 0,
  setType: 'normal',
  side: 'both',
  isCompleted: 1,
  performedAt: 1,
  ...values,
});

const session = (
  startedAt: number,
  measurementType: MeasurementType | undefined,
  sets: Array<
    Partial<WorkoutSet> & Pick<Partial<AnalyticsSet>, 'bodyweightLoadFactor'>
  >,
  overrides: Partial<AnalyticsSession> = {},
): AnalyticsSession => ({
  workoutId: `w-${startedAt}`,
  startedAt,
  measurementType,
  sets: sets.map(aSet),
  ...overrides,
});

const values = (points: { value: number }[]): number[] => points.map((point) => point.value);

describe('availableMetrics', () => {
  it('n’offre jamais la même liste à deux mesures différentes', () => {
    const keys = (type: MeasurementType) =>
      availableMetrics(type).map((metric) => metric.key);

    expect(keys('weight_reps')).toContain('topWeight');
    expect(keys('time_only')).not.toContain('topWeight');
    expect(keys('time_only')).toContain('topDuration');
    expect(keys('distance_time')).toContain('topDistance');
    expect(keys('reps_only')).toContain('sessionTonnage');
  });

  it('place le 1RM estimé après la charge max et seulement pour poids-répétitions', () => {
    const weighted = availableMetrics('weight_reps').map((metric) => metric.key);

    expect(weighted.slice(0, 2)).toEqual(['topWeight', 'estimatedOneRepMax']);
    for (const type of [
      'reps_only',
      'weight_time',
      'time_only',
      'distance_time',
      'assisted_weight_reps',
    ] as const) {
      expect(availableMetrics(type).map((metric) => metric.key)).not.toContain(
        'estimatedOneRepMax',
      );
    }
  });

  it('offre l’assistance minimale, et elle seule, sur une machine assistée', () => {
    const keys = availableMetrics('assisted_weight_reps').map((metric) => metric.key);
    expect(keys).toContain('lowestAssist');
    // Le poids d’une machine assistée n’est pas une charge : « charge max »
    // féliciterait la séance la plus aidée.
    expect(keys).not.toContain('topWeight');
    expect(keys).toContain('sessionTonnage');
  });

  it('n’offre rien quand le type de mesure est inconnu', () => {
    expect(availableMetrics(undefined)).toEqual([]);
  });

  it('propose une première métrique pour chacun des six types', () => {
    const types: MeasurementType[] = [
      'weight_reps',
      'reps_only',
      'weight_time',
      'time_only',
      'distance_time',
      'assisted_weight_reps',
    ];
    for (const type of types) expect(availableMetrics(type).length).toBeGreaterThan(0);
  });
});

describe('metricDefinition', () => {
  it('ne renverse le sens du progrès que pour l’assistance', () => {
    expect(metricDefinition('lowestAssist').betterWhen).toBe('lower');
    expect(metricDefinition('topWeight').betterWhen).toBe('higher');
    expect(metricDefinition('totalDuration').betterWhen).toBe('higher');
  });

  it('porte une unité pour chaque métrique offerte', () => {
    for (const type of ['weight_reps', 'time_only', 'distance_time'] as const) {
      for (const metric of availableMetrics(type)) {
        expect(metric.unit).toBeTruthy();
      }
    }
  });
});

describe('metricSeries', () => {
  it('garde le meilleur 1RM éligible de chaque séance avec la formule choisie', () => {
    const sessions = [
      session(1, 'weight_reps', [
        { weight: 100, reps: 5 },
        { weight: 105, reps: 3 },
        { weight: 140, reps: 1, setType: 'warmup' },
      ]),
    ];

    expect(values(metricSeries('estimatedOneRepMax', sessions))).toEqual([100 * (1 + 5 / 30)]);
    expect(values(metricSeries('estimatedOneRepMax', sessions, 'brzycki'))).toEqual([
      (100 * 36) / (37 - 5),
    ]);
  });

  it('omet les charges et répétitions invalides ainsi que les séances sans estimation', () => {
    const points = metricSeries('estimatedOneRepMax', [
      session(1, 'weight_reps', [
        { weight: 120, reps: 13 },
        { weight: 0, reps: 5 },
        { weight: Number.NaN, reps: 5 },
        { weight: 100, reps: 2.5 },
      ]),
      session(2, 'weight_reps', [{ weight: 97.5, reps: 8 }]),
      session(3, 'time_only', [{ durationSeconds: 60 }]),
    ]);

    expect(points).toEqual([
      { workoutId: 'w-2', timestamp: 2, value: 97.5 * (1 + 8 / 30) },
    ]);
  });

  it('conserve la valeur 1RM brute sans arrondi dans le point', () => {
    const [point] = metricSeries('estimatedOneRepMax', [
      session(1, 'weight_reps', [{ weight: 100, reps: 5 }]),
    ]);

    expect(point?.value).toBe(100 * (1 + 5 / 30));
    expect(point?.value).not.toBe(Math.round(point!.value * 10) / 10);
  });

  it('rend un point par séance, dans l’ordre du temps', () => {
    const points = metricSeries('topWeight', [
      session(1, 'weight_reps', [{ weight: 80, reps: 5 }]),
      session(2, 'weight_reps', [{ weight: 100, reps: 3 }]),
    ]);

    expect(values(points)).toEqual([80, 100]);
    expect(points.map((point) => point.timestamp)).toEqual([1, 2]);
  });

  it('exclut les échauffements et garde dégressives et séries à l’échec', () => {
    const points = metricSeries('topWeight', [
      session(1, 'weight_reps', [
        { weight: 200, reps: 1, setType: 'warmup' },
        { weight: 100, reps: 5, setType: 'dropset' },
        { weight: 110, reps: 2, setType: 'failure' },
      ]),
    ]);

    expect(values(points)).toEqual([110]);
  });

  it('ne rend aucun point pour une séance sans valeur, jamais un zéro', () => {
    const points = metricSeries('topWeight', [
      session(1, 'weight_reps', [{ weight: 100, reps: 5 }]),
      // Séance enregistrée en gainage : aucune charge à lire.
      session(2, 'time_only', [{ durationSeconds: 45 }]),
      session(3, 'weight_reps', [{ weight: 105, reps: 5 }]),
    ]);

    expect(values(points)).toEqual([100, 105]);
  });

  it('ne rend aucun point pour une séance qui n’a que des échauffements', () => {
    expect(metricSeries('workingSets', [session(1, 'weight_reps', [
      { weight: 40, reps: 10, setType: 'warmup' },
    ])])).toEqual([]);
  });

  it('lit le type de mesure de chaque séance, pas celui d’aujourd’hui', () => {
    // L’exercice a été retypé depuis : la séance de gainage reste du gainage.
    const points = metricSeries('topDuration', [
      session(1, 'time_only', [{ durationSeconds: 45 }]),
      session(2, 'weight_reps', [{ weight: 60, reps: 8 }]),
    ]);

    expect(values(points)).toEqual([45]);
  });

  it('compte le tonnage comme l’écran de séance, assistance exclue', () => {
    const points = metricSeries('sessionTonnage', [
      session(1, 'weight_reps', [
        { weight: 100, reps: 5 },
        { weight: 100, reps: 5 },
      ]),
    ]);

    expect(values(points)).toEqual([1000]);
  });

  it('compte le poids corporel effectif pour les répétitions seules', () => {
    const points = metricSeries('sessionTonnage', [
      session(
        1,
        'reps_only',
        [{
          weight: undefined,
          reps: 8,
          bodyweightLoadFactor: 0.7,
        }],
        { bodyWeightKg: 80 },
      ),
    ]);

    expect(values(points)).toEqual([448]);
  });

  it('prend l’assistance la plus faible, zéro compris', () => {
    const points = metricSeries('lowestAssist', [
      session(1, 'assisted_weight_reps', [
        { weight: 30, reps: 8 },
        { weight: 20, reps: 6 },
      ]),
      session(2, 'assisted_weight_reps', [{ weight: 0, reps: 4 }]),
    ]);

    expect(values(points)).toEqual([20, 0]);
  });

  it('garde deux points quand deux séances tombent le même jour', () => {
    const morning = new Date(2026, 6, 27, 9).getTime();
    const evening = new Date(2026, 6, 27, 19).getTime();
    const points = metricSeries('topWeight', [
      session(morning, 'weight_reps', [{ weight: 90, reps: 5 }]),
      session(evening, 'weight_reps', [{ weight: 95, reps: 5 }]),
    ]);

    expect(values(points)).toEqual([90, 95]);
  });

  it('additionne les répétitions de travail de la séance', () => {
    const points = metricSeries('totalReps', [
      session(1, 'reps_only', [{ reps: 12 }, { reps: 10 }, { reps: 20, setType: 'warmup' }]),
    ]);

    expect(values(points)).toEqual([22]);
  });
});

describe('bestPointIndex', () => {
  const points = [
    { workoutId: 'a', timestamp: 1, value: 80 },
    { workoutId: 'b', timestamp: 2, value: 105 },
    { workoutId: 'c', timestamp: 3, value: 100 },
  ];

  it('désigne le maximum quand monter est un progrès', () => {
    expect(bestPointIndex(points, 'higher')).toBe(1);
  });

  it('désigne le minimum quand descendre est un progrès', () => {
    // Moins d’assistance est une amélioration : le record est en bas.
    expect(bestPointIndex(points, 'lower')).toBe(0);
  });

  it('garde le plus ancien à égalité — un record s’établit la première fois', () => {
    expect(
      bestPointIndex(
        [
          { workoutId: 'a', timestamp: 1, value: 100 },
          { workoutId: 'b', timestamp: 2, value: 100 },
        ],
        'higher',
      ),
    ).toBe(0);
  });

  it('ne désigne rien sans point', () => {
    expect(bestPointIndex([], 'higher')).toBeUndefined();
  });
});
