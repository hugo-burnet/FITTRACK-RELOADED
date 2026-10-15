import { describe, expect, it } from 'vitest';
import type { BenchmarkLine } from '@/lib/benchmark';
import {
  appliedReading,
  basisReading,
  loadReading,
  oneRepMaxReading,
  proposalMark,
  roughReading,
  routineReading,
  testedReading,
  withoutLoadReading,
  zoneReading,
} from './benchmarkText';

const line = (overrides: Partial<BenchmarkLine> = {}): BenchmarkLine => ({
  exerciseId: 'bench',
  exerciseName: 'Développé couché',
  measurementType: 'weight_reps',
  verdict: 'calibrated',
  tested: { weight: 80, reps: 9 },
  oneRepMax: 104,
  plannedSets: 3,
  referenceReps: 12.3457,
  suggestedKg: 72.5,
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
    const base = {
      routineExerciseId: 'row',
      exerciseId: 'bench',
      targetSetIds: ['a'],
      anchorSetId: 'a',
      proposedWeight: 77.5,
    };
    expect(proposalMark({ ...base, fromWeight: 70, deltaKg: 7.5 })).toBe('+7,5 kg');
    expect(proposalMark({ ...base, fromWeight: 90, deltaKg: -12.5 })).toBe('−12,5 kg');
    expect(proposalMark(base)).toBe('77,5 kg');
  });

  it('dit ce que la routine porte, ou pourquoi elle ne reçoit rien', () => {
    const proposal = {
      routineExerciseId: 'row',
      exerciseId: 'bench',
      targetSetIds: ['a'],
      anchorSetId: 'a',
      proposedWeight: 77.5,
    };
    expect(routineReading(line({ proposal }))).toBe('Dans la routine : 70 kg');
    expect(routineReading(line({ proposal, currentKg: undefined }))).toBe(
      'Aucune charge dans la routine.',
    );
    expect(routineReading(line({ aligned: true }))).toBe('La routine est déjà à ce niveau.');
    expect(routineReading(line())).toBe('Cet exercice n’est plus dans la routine : rien à écrire.');
    expect(routineReading(line({ verdict: 'too_light' }))).toBeUndefined();
  });

  it('dit pourquoi un exercice n’a pas de charge', () => {
    expect(withoutLoadReading(line({ verdict: 'too_light' }))).toMatch(/Plus de 30 répétitions/);
    expect(withoutLoadReading(line({ verdict: 'no_load' }))).toMatch(/Aucune charge exploitable/);
    expect(withoutLoadReading(line({ verdict: 'recorded' }))).toMatch(/Résultat noté/);
    expect(withoutLoadReading(line())).toBeUndefined();
  });

  it('écrit la fourchette de la routine comme sa ligne : « 8 – 12 reps », « 15 – 20 reps », « 20 reps »', () => {
    expect(zoneReading(line({ zone: { low: 8, high: 12 } }))).toBe('Fourchette de la routine : 8 – 12 reps');
    expect(zoneReading(line({ zone: { low: 15, high: 20 } }))).toBe('Fourchette de la routine : 15 – 20 reps');
    expect(zoneReading(line({ zone: { low: 20, high: 20 } }))).toBe('Fourchette de la routine : 20 reps');
    expect(zoneReading(line({ zone: undefined }))).toBeUndefined();
  });

  it('dit sur combien de séries la charge est calculée, ce que la première tient à fond et la réserve de la dernière', () => {
    expect(basisReading(line())).toBe(
      'Pour 3 séries : environ 12 répétitions à fond à la première, 2 en réserve à la dernière.',
    );
    expect(basisReading(line({ plannedSets: 6, referenceReps: 16.9351 }))).toBe(
      'Pour 6 séries : environ 17 répétitions à fond à la première, 2 en réserve à la dernière.',
    );
  });

  it('n’a pas de « dernière série » à nommer quand il n’y en a qu’une', () => {
    expect(basisReading(line({ plannedSets: 1, referenceReps: 10 }))).toBe(
      'Pour une série : environ 10 répétitions à fond.',
    );
  });

  it('ne dit rien de la base d’une ligne qui n’a pas de charge conseillée', () => {
    expect(basisReading(line({ plannedSets: undefined }))).toBeUndefined();
    expect(basisReading(line({ referenceReps: undefined }))).toBeUndefined();
  });

  it('met en garde contre une estimation tirée d’un essai loin de ce que la première série doit tenir, et d’elle seule', () => {
    expect(roughReading(line({ rough: true, tested: { weight: 40, reps: 25 } }))).toMatch(
      /Estimation approximative : 25 répétitions, c’est loin des 12 que la première série doit tenir/,
    );
    expect(roughReading(line())).toBeUndefined();
    expect(roughReading(line({ rough: true, referenceReps: undefined }))).toBeUndefined();
  });

  it('accorde le compte des exercices mis à jour', () => {
    expect(appliedReading(0)).toMatch(/rien n’a été écrit/);
    expect(appliedReading(1)).toBe('1 exercice mis à jour dans la routine.');
    expect(appliedReading(3)).toBe('3 exercices mis à jour dans la routine.');
  });
});
