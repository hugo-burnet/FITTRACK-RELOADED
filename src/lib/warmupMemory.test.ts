import { describe, expect, it } from 'vitest';
import type { SetType } from '@/data/types';
import { rememberedWarmup, type RememberedSet } from './warmupMemory';

function set(setType: SetType, values: Partial<RememberedSet> = {}): RememberedSet {
  return { setType, ...values };
}

describe('rememberedWarmup', () => {
  it('relit la montée de la dernière fois en pourcentages de la charge de travail', () => {
    const previous = [
      set('warmup', { weight: 20, reps: 10 }),
      set('warmup', { weight: 40, reps: 5 }),
      set('normal', { weight: 60, reps: 8 }),
      set('normal', { weight: 60, reps: 7 }),
    ];

    expect(rememberedWarmup(previous)).toEqual({
      referenceWeightKg: 60,
      steps: [
        { percentage: 33, reps: 10 },
        { percentage: 67, reps: 5 },
      ],
    });
  });

  it('ne retient rien quand la dernière fois n’avait pas d’échauffement', () => {
    expect(rememberedWarmup([set('normal', { weight: 60, reps: 8 })])).toBeNull();
  });

  it('ne retient rien sans charge de travail à laquelle rapporter la montée', () => {
    // Sans référence, un « 20 kg » ne dit pas s'il vaut 30 % ou 80 % : le
    // rapporter à la charge du jour serait une invention, pas une mémoire.
    const previous = [set('warmup', { weight: 20, reps: 10 }), set('normal', { reps: 8 })];
    expect(rememberedWarmup(previous)).toBeNull();
  });

  it('lit la cible quand la série n’a pas été faite avec une valeur saisie', () => {
    const previous = [
      set('warmup', { targetWeight: 30, targetReps: 8 }),
      set('normal', { targetWeight: 60, targetReps: 5 }),
    ];

    expect(rememberedWarmup(previous)?.steps).toEqual([{ percentage: 50, reps: 8 }]);
  });

  it('écarte un palier qui n’est plus un échauffement', () => {
    // Une « montée » à la charge de travail, ou au-dessus, n'est pas une montée.
    const previous = [
      set('warmup', { weight: 20, reps: 10 }),
      set('warmup', { weight: 60, reps: 3 }),
      set('normal', { weight: 60, reps: 8 }),
    ];

    expect(rememberedWarmup(previous)?.steps).toEqual([{ percentage: 33, reps: 10 }]);
  });

  it('ignore les échauffements sans répétitions lisibles', () => {
    const previous = [
      set('warmup', { weight: 20 }),
      set('warmup', { weight: 40, reps: 5 }),
      set('normal', { weight: 60, reps: 8 }),
    ];

    expect(rememberedWarmup(previous)?.steps).toEqual([{ percentage: 67, reps: 5 }]);
  });

  it('garde l’ordre des paliers, même donné à l’envers', () => {
    const previous = [
      set('warmup', { weight: 40, reps: 5 }),
      set('warmup', { weight: 20, reps: 10 }),
      set('normal', { weight: 60, reps: 8 }),
    ];

    expect(rememberedWarmup(previous)?.steps).toEqual([
      { percentage: 67, reps: 5 },
      { percentage: 33, reps: 10 },
    ]);
  });

  it('prend la première série de travail comme référence, pas la plus lourde', () => {
    // La rampe a été montée pour la charge d'attaque ; une série montée plus
    // haut en cours de séance ne raconte pas l'échauffement.
    const previous = [
      set('warmup', { weight: 25, reps: 10 }),
      set('normal', { weight: 50, reps: 8 }),
      set('normal', { weight: 70, reps: 4 }),
    ];

    expect(rememberedWarmup(previous)?.referenceWeightKg).toBe(50);
  });
});
