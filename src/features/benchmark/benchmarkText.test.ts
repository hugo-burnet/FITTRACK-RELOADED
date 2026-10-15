import { describe, expect, it } from 'vitest';
import type { BenchmarkLine } from '@/lib/benchmark';
import {
  appliedReading,
  loadReading,
  oneRepMaxReading,
  proposalMark,
  routineReading,
  testedReading,
  withoutLoadReading,
} from './benchmarkText';

const line = (overrides: Partial<BenchmarkLine> = {}): BenchmarkLine => ({
  exerciseId: 'bench',
  exerciseName: 'Développé couché',
  measurementType: 'weight_reps',
  verdict: 'calibrated',
  tested: { weight: 80, reps: 9 },
  oneRepMax: 104,
  referenceReps: 10,
  suggestedKg: 77.5,
  currentKg: 70,
  ...overrides,
});

describe('les lectures du bilan', () => {
  it('écrit une charge comme une charge de routine, à la française', () => {
    expect(loadReading(77.5)).toBe('77,5 kg');
    expect(loadReading(80)).toBe('80 kg');
  });

  it('arrondit un 1RM au dixième : une estimation ne promet pas mieux', () => {
    expect(oneRepMaxReading(103.9999)).toBe('104 kg');
    expect(oneRepMaxReading(103.84)).toBe('103,8 kg');
  });

  it('écrit ce qui a été fait comme une série d’historique', () => {
    expect(testedReading(line())).toBe('9 reps · 80 kg');
    expect(
      testedReading(
        line({ measurementType: 'time_only', tested: { durationSeconds: 90 }, verdict: 'recorded' }),
      ),
    ).toBe('1:30 min');
    expect(testedReading(line({ tested: undefined }))).toBeUndefined();
  });

  it('montre l’écart quand la routine porte une charge, la charge sinon', () => {
    const base = { routineExerciseId: 'row', targetSetIds: ['a'], anchorSetId: 'a', proposedWeight: 77.5 };
    expect(proposalMark({ ...base, fromWeight: 70, deltaKg: 7.5 })).toBe('+7,5 kg');
    expect(proposalMark({ ...base, fromWeight: 90, deltaKg: -12.5 })).toBe('−12,5 kg');
    expect(proposalMark(base)).toBe('77,5 kg');
  });

  it('dit ce que la routine porte, ou pourquoi elle ne reçoit rien', () => {
    const proposal = { routineExerciseId: 'row', targetSetIds: ['a'], anchorSetId: 'a', proposedWeight: 77.5 };
    expect(routineReading(line({ proposal }))).toBe('Dans la routine : 70 kg');
    expect(routineReading(line({ proposal, currentKg: undefined }))).toBe(
      'Aucune charge dans la routine.',
    );
    expect(routineReading(line({ aligned: true }))).toBe('La routine est déjà à ce niveau.');
    expect(routineReading(line())).toBe('Cet exercice n’est plus dans la routine : rien à écrire.');
    expect(routineReading(line({ verdict: 'too_light' }))).toBeUndefined();
  });

  it('dit pourquoi un exercice n’a pas de charge', () => {
    expect(withoutLoadReading(line({ verdict: 'too_light' }))).toMatch(/Plus de 12 répétitions/);
    expect(withoutLoadReading(line({ verdict: 'no_load' }))).toMatch(/Aucune charge exploitable/);
    expect(withoutLoadReading(line({ verdict: 'recorded' }))).toMatch(/Résultat noté/);
    expect(withoutLoadReading(line())).toBeUndefined();
  });

  it('accorde le compte des exercices mis à jour', () => {
    expect(appliedReading(0)).toMatch(/rien n’a été écrit/);
    expect(appliedReading(1)).toBe('1 exercice mis à jour dans la routine.');
    expect(appliedReading(3)).toBe('3 exercices mis à jour dans la routine.');
  });
});
