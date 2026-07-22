import { describe, expect, it } from 'vitest';
import type { WorkoutSet } from '@/data/types';
import type { WeightRole } from './measurement';
import { sessionTotals } from './volume';

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
   * Le cœur de ce module. Le même nombre de kilos est une charge, un lest ou une
   * assistance ; un tonnage qui additionne les trois est faux. Un lest de 10 kg
   * sur une traction ne dit rien du poids réellement déplacé — le poids de corps
   * n'est pas connu de l'app — et une assistance de 20 kg est du poids **retiré**.
   */
  it('ne compte en tonnage que les kilos qui sont vraiment la charge', () => {
    const lest = sessionTotals([entry({ weight: 10, reps: 8 }, 'added')]);
    expect(lest.tonnage).toBe(0);
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
});
