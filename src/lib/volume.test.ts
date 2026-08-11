import { describe, expect, it } from 'vitest';
import type { WorkoutSet } from '@/data/types';
import type { WeightRole } from './measurement';
import { effectiveLoadKg, sessionTotals } from './volume';

let sequence = 0;

/** A validated set. Only what a test cares about is passed. */
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

const entry = (values: Partial<WorkoutSet>, weightRole?: WeightRole) => ({
  set: aSet(values),
  weightRole,
});

describe('sessionTotals', () => {
  it('expose la charge effective que les records de volume par série peuvent réutiliser', () => {
    const set = aSet({ weight: 10, reps: 8 });
    const load = effectiveLoadKg(
      { set, weightRole: 'added', bodyweightLoadFactor: 0.75 },
      80,
    );

    expect(load).toBe(70);
    expect(load * (set.reps ?? 0)).toBe(560);
  });

  it('ne compte rien sur une séance vide', () => {
    expect(sessionTotals([])).toEqual({
      workingSets: 0,
      totalReps: 0,
      tonnage: 0,
      durationSeconds: 0,
      distanceMeters: 0,
    });
  });

  it('additionne les séries, les répétitions et le tonnage', () => {
    const totals = sessionTotals([
      entry({ weight: 100, reps: 5 }, 'load'),
      entry({ weight: 100, reps: 5 }, 'load'),
      entry({ weight: 90, reps: 8 }, 'load'),
    ]);

    expect(totals.workingSets).toBe(3);
    expect(totals.totalReps).toBe(18);
    expect(totals.tonnage).toBe(1720);
  });

  /**
   * RF-20, appliqué depuis le Lot 3 : un échauffement ne pollue ni le volume ni
   * les records. La règle vit dans `isWorkingSet` et n'est pas redite ici.
   */
  it('exclut l’échauffement de tous les totaux', () => {
    const totals = sessionTotals([
      entry({ weight: 60, reps: 10, setType: 'warmup' }, 'load'),
      entry({ weight: 100, reps: 5 }, 'load'),
    ]);

    expect(totals.workingSets).toBe(1);
    expect(totals.totalReps).toBe(5);
    expect(totals.tonnage).toBe(500);
  });

  /**
   * Sans coefficient, le poids de corps ne peut pas contribuer au tonnage.
   * Le lest reste une charge déplacée, mais l'assistance ne peut jamais être
   * comptée comme une charge positive.
   */
  it('ne compte que le lest lorsque le coefficient de poids de corps manque', () => {
    const lest = sessionTotals([entry({ weight: 10, reps: 8 }, 'added')]);
    expect(lest.tonnage).toBe(80);
    expect(lest.totalReps).toBe(8);
    expect(lest.workingSets).toBe(1);

    const assistance = sessionTotals([entry({ weight: 20, reps: 8 }, 'assist')]);
    expect(assistance.tonnage).toBe(0);
    expect(assistance.totalReps).toBe(8);
  });

  it('additionne le temps et la distance des exercices qui en ont', () => {
    const totals = sessionTotals([
      entry({ durationSeconds: 45 }),
      entry({ durationSeconds: 60, weight: 20 }, 'load'),
      entry({ distanceMeters: 1000, durationSeconds: 300 }),
    ]);

    expect(totals.durationSeconds).toBe(405);
    expect(totals.distanceMeters).toBe(1000);
    // Un gainage lesté n'a pas de répétitions, donc pas de tonnage non plus.
    expect(totals.tonnage).toBe(0);
    expect(totals.workingSets).toBe(3);
  });

  it('encaisse une série à moitié remplie sans fausser le reste', () => {
    const totals = sessionTotals([
      entry({ weight: 100 }, 'load'),
      entry({ weight: 100, reps: 5 }, 'load'),
    ]);

    expect(totals.tonnage).toBe(500);
    expect(totals.totalReps).toBe(5);
    expect(totals.workingSets).toBe(2);
  });

  it('garde les décimales justes sur une charge à la demi-plaque', () => {
    expect(sessionTotals([entry({ weight: 102.5, reps: 3 }, 'load')]).tonnage).toBe(307.5);
  });

  it.each([
    ['traction', 'added', undefined, 1, 80, 8, 640],
    ['traction lestée', 'added', 10, 1, 80, 8, 720],
    ['traction assistée', 'assist', 20, 1, 80, 8, 480],
    ['pompes', 'added', undefined, 0.7, 80, 8, 448],
    ['squats', 'added', undefined, 0.9, 80, 10, 720],
  ] as const)('%s produit son tonnage effectif', (_name, weightRole, weight, factor, bodyWeight, reps, expected) => {
    expect(sessionTotals([
      { set: aSet({ weight, reps }), weightRole, bodyweightLoadFactor: factor },
    ], bodyWeight).tonnage).toBe(expected);
  });

  it('borne une assistance supérieure au poids effectif à zéro', () => {
    expect(sessionTotals([
      { set: aSet({ weight: 90, reps: 8 }), weightRole: 'assist', bodyweightLoadFactor: 1 },
    ], 80).tonnage).toBe(0);
  });

  it('compte seulement le lest quand le poids corporel manque', () => {
    expect(sessionTotals([
      { set: aSet({ weight: 10, reps: 8 }), weightRole: 'added', bodyweightLoadFactor: 1 },
    ]).tonnage).toBe(80);
  });

  it('ignore le poids corporel connu quand son coefficient manque', () => {
    expect(sessionTotals([
      { set: aSet({ weight: 10, reps: 8 }), weightRole: 'added' },
    ], 80).tonnage).toBe(80);
  });
});
