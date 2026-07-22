import { describe, expect, it } from 'vitest';
import { measurementShape, targetParts } from './measurement';
import type { Targets } from './measurement';

/** The unit keys are deliberately not words; this is the mapping the UI applies. */
const SYMBOL = {
  reps: 'reps',
  kg: 'kg',
  seconds: 's',
  minutes: 'min',
  meters: 'm',
  kilometers: 'km',
} as const;

const parts = (type: Parameters<typeof targetParts>[0], targets: Targets) =>
  targetParts(type, targets).map((p) => `${p.prefix ?? ''}${p.value} ${SYMBOL[p.unit]}`);

describe('measurementShape', () => {
  it('donne à chaque type de mesure les champs qu’il utilise vraiment', () => {
    expect(measurementShape('weight_reps').fields).toEqual(['reps', 'weight']);
    expect(measurementShape('reps_only').fields).toEqual(['reps', 'weight']);
    expect(measurementShape('weight_time').fields).toEqual(['duration', 'weight']);
    expect(measurementShape('time_only').fields).toEqual(['duration']);
    expect(measurementShape('distance_time').fields).toEqual(['distance', 'duration']);
    expect(measurementShape('assisted_weight_reps').fields).toEqual(['reps', 'weight']);
  });

  /**
   * Le même nombre de kilos est une charge, un lest qu'on ajoute à son propre
   * poids, ou une assistance qui en retire. Les appeler tous les trois
   * « charge » est la façon la plus simple pour une routine de mentir sur ce
   * qu'elle prescrit.
   */
  it('distingue les trois sens du champ de charge', () => {
    expect(measurementShape('weight_reps').weightRole).toBe('load');
    expect(measurementShape('weight_time').weightRole).toBe('load');
    expect(measurementShape('reps_only').weightRole).toBe('added');
    expect(measurementShape('assisted_weight_reps').weightRole).toBe('assist');
  });

  it('n’expose aucun rôle de charge là où il n’y a pas de champ de charge', () => {
    expect(measurementShape('time_only').weightRole).toBeUndefined();
    expect(measurementShape('distance_time').weightRole).toBeUndefined();
  });
});

describe('targetParts', () => {
  it('ne renvoie rien pour une série sans aucune cible', () => {
    expect(targetParts('weight_reps', {})).toEqual([]);
    expect(targetParts('time_only', {})).toEqual([]);
  });

  it('développé couché : reps puis charge', () => {
    expect(parts('weight_reps', { targetReps: 8, targetRepsMax: 12, targetWeight: 80 })).toEqual([
      '8 – 12 reps',
      '80 kg',
    ]);
  });

  it('affiche un nombre unique quand la fourchette n’en est pas une', () => {
    expect(parts('weight_reps', { targetReps: 5, targetWeight: 100 })).toEqual(['5 reps', '100 kg']);
    // Un maximum qui n'excède pas le minimum n'est pas une fourchette.
    expect(parts('weight_reps', { targetReps: 5, targetRepsMax: 5 })).toEqual(['5 reps']);
  });

  it('garde la virgule française sur les décimales', () => {
    expect(parts('weight_reps', { targetReps: 5, targetWeight: 102.5 })).toEqual([
      '5 reps',
      '102,5 kg',
    ]);
  });

  // Traction lestée : le poids s'ajoute au corps.
  it('marque le lest d’un plus', () => {
    expect(parts('reps_only', { targetReps: 8, targetWeight: 10 })).toEqual(['8 reps', '+10 kg']);
  });

  it('laisse une traction au poids du corps sans mention de charge', () => {
    expect(parts('reps_only', { targetReps: 12 })).toEqual(['12 reps']);
  });

  // Traction assistée : la charge soulage, elle ne pèse pas.
  it('marque l’assistance d’un moins', () => {
    expect(parts('assisted_weight_reps', { targetReps: 8, targetWeight: 20 })).toEqual([
      '8 reps',
      '−20 kg',
    ]);
  });

  it('planche : une durée, en secondes sous la minute', () => {
    expect(parts('time_only', { targetDurationSeconds: 45 })).toEqual(['45 s']);
  });

  it('passe en minutes à partir d’une minute', () => {
    expect(parts('time_only', { targetDurationSeconds: 60 })).toEqual(['1:00 min']);
    expect(parts('time_only', { targetDurationSeconds: 90 })).toEqual(['1:30 min']);
    expect(parts('time_only', { targetDurationSeconds: 1200 })).toEqual(['20:00 min']);
  });

  it('gainage lesté : durée puis charge', () => {
    expect(parts('weight_time', { targetDurationSeconds: 60, targetWeight: 20 })).toEqual([
      '1:00 min',
      '20 kg',
    ]);
  });

  it('rameur : distance puis durée', () => {
    expect(parts('distance_time', { targetDistanceMeters: 500, targetDurationSeconds: 120 })).toEqual(
      ['500 m', '2:00 min'],
    );
  });

  it('passe en kilomètres à partir de mille mètres', () => {
    expect(parts('distance_time', { targetDistanceMeters: 1000 })).toEqual(['1 km']);
    expect(parts('distance_time', { targetDistanceMeters: 1500 })).toEqual(['1,5 km']);
  });

  /** Une cible qui ne concerne pas ce type de mesure ne doit pas s'afficher. */
  it('ignore une cible étrangère au type de mesure', () => {
    expect(parts('time_only', { targetDurationSeconds: 45, targetReps: 10 })).toEqual(['45 s']);
    expect(parts('weight_reps', { targetReps: 8, targetDurationSeconds: 45 })).toEqual(['8 reps']);
  });

  it('ne rend jamais plus de deux éléments', () => {
    const full: Targets = {
      targetReps: 8,
      targetRepsMax: 12,
      targetWeight: 80,
      targetDurationSeconds: 60,
      targetDistanceMeters: 500,
    };
    for (const type of [
      'weight_reps',
      'reps_only',
      'weight_time',
      'time_only',
      'distance_time',
      'assisted_weight_reps',
    ] as const) {
      expect(targetParts(type, full).length).toBeLessThanOrEqual(2);
    }
  });
});
