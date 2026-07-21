import { describe, expect, it } from 'vitest';
import type { WorkoutSet } from '@/data/types';
import { bestSets, setVolume } from './records';

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

describe('setVolume', () => {
  it('multiplie la charge par les répétitions', () => {
    expect(setVolume(aSet({ weight: 100, reps: 5 }))).toBe(500);
  });

  it('vaut 0 sans répétitions — un gainage lesté n’a pas de volume', () => {
    expect(setVolume(aSet({ weight: 20, durationSeconds: 60 }))).toBe(0);
  });

  it('vaut 0 sans charge — une traction au poids du corps non plus', () => {
    expect(setVolume(aSet({ reps: 12 }))).toBe(0);
  });
});

describe('bestSets', () => {
  it('ne rend rien sur un historique vide', () => {
    expect(bestSets([])).toEqual({
      heaviest: undefined,
      mostReps: undefined,
      bestVolume: undefined,
    });
  });

  it('retient la charge la plus lourde', () => {
    const heavy = aSet({ weight: 110, reps: 3 });
    const best = bestSets([aSet({ weight: 100, reps: 5 }), heavy, aSet({ weight: 90, reps: 8 })]);
    expect(best.heaviest).toBe(heavy);
  });

  it('retient la série au plus gros volume, pas la plus lourde', () => {
    const volume = aSet({ weight: 60, reps: 12 }); // 720
    const best = bestSets([aSet({ weight: 100, reps: 5 }), volume]); // 500
    expect(best.bestVolume).toBe(volume);
    expect(best.heaviest).not.toBe(volume);
  });

  // Règle du Lot 6, encodée ici : sinon le Lot 6 doit revenir modifier une
  // fonction déjà consommée par la fiche exercice.
  it('exclut les séries d’échauffement', () => {
    const best = bestSets([
      aSet({ weight: 200, reps: 1, setType: 'warmup' }),
      aSet({ weight: 100, reps: 5 }),
    ]);
    expect(best.heaviest!.weight).toBe(100);
    expect(best.bestVolume!.weight).toBe(100);
  });

  it('à égalité, garde la série la plus ancienne', () => {
    const first = aSet({ weight: 100, reps: 5, performedAt: 1_000 });
    const later = aSet({ weight: 100, reps: 5, performedAt: 2_000 });
    expect(bestSets([later, first]).heaviest).toBe(first);
  });

  it('compte les répétitions d’une série sans charge', () => {
    const pullUps = aSet({ reps: 14 });
    const best = bestSets([pullUps, aSet({ reps: 10 })]);
    expect(best.mostReps).toBe(pullUps);
    expect(best.heaviest).toBeUndefined();
  });

  it('ignore une charge à zéro : le poids du corps n’est pas un record de charge', () => {
    expect(bestSets([aSet({ weight: 0, reps: 20 })]).heaviest).toBeUndefined();
  });
});
