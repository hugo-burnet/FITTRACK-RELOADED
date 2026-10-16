import { describe, expect, it } from 'vitest';
import type { BenchmarkLine } from '@/lib/benchmark';
import {
  appliedReading,
  bannerReading,
  changedReading,
  goalName,
  holdReading,
  loadReading,
  oneRepMaxReading,
  planReading,
  proposalMark,
  pyramidReading,
  roughReading,
  routineReading,
  testedReading,
  withoutLoadReading,
  zoneNoteReading,
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

  it('montre la fourchette quand c’est la seule chose à écrire : la charge est déjà la bonne', () => {
    const proposal = {
      routineExerciseId: 'row',
      exerciseId: 'bench',
      targetSetIds: ['a'],
      anchorSetId: 'a',
      fromWeight: 37.5,
      proposedWeight: 37.5,
      deltaKg: 0,
      zone: { low: 15, high: 20, setIds: ['a'] },
    };
    expect(proposalMark(proposal)).toBe('15 – 20 reps');
    // Avec un écart de charge, la marque garde l'écart ; la fourchette se dit dessous.
    expect(proposalMark({ ...proposal, deltaKg: 2.5, proposedWeight: 40 })).toBe('+2,5 kg');
    expect(zoneNoteReading({ ...proposal, deltaKg: 2.5, proposedWeight: 40 })).toBe(
      'Écrit aussi la fourchette 15 – 20 reps sur les séries de travail.',
    );
    expect(zoneNoteReading(proposal)).toBeUndefined();
    expect(zoneNoteReading({ ...proposal, zone: undefined, deltaKg: 2.5 })).toBeUndefined();
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
    expect(routineReading(line())).toBe('Cet exercice n’est pas dans la routine : rien à écrire.');
    expect(routineReading(line({ routineEmpty: true }))).toBe(
      'La routine n’a aucune série de travail pour cet exercice : rien à écrire.',
    );
    expect(routineReading(line({ verdict: 'too_light' }))).toBeUndefined();
  });

  it('prévient quand la routine a changé depuis le benchmark, mais seulement s’il y a quelque chose à écrire', () => {
    const proposal = {
      routineExerciseId: 'row',
      exerciseId: 'bench',
      targetSetIds: ['a'],
      anchorSetId: 'a',
      proposedWeight: 77.5,
    };
    expect(changedReading(line({ proposal, routineChanged: true }))).toBe(
      'La routine a changé depuis ce benchmark : vérifie la charge avant de l’appliquer.',
    );
    expect(changedReading(line({ routineChanged: true }))).toBeUndefined();
    expect(changedReading(line({ proposal }))).toBeUndefined();
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

  it('dit le style choisi plutôt que la routine : « Ton style : léger · 15 – 20 reps »', () => {
    expect(zoneReading(line({ goal: 'light', zone: { low: 15, high: 20 } }))).toBe(
      'Ton style : léger · 15 – 20 reps',
    );
    expect(zoneReading(line({ goal: 'classic', zone: { low: 8, high: 12 } }))).toBe(
      'Ton style : classique · 8 – 12 reps',
    );
    expect(zoneReading(line({ goal: 'heavy', zone: { low: 5, high: 8 } }))).toBe(
      'Ton style : lourd · 5 – 8 reps',
    );
  });

  it('nomme les trois styles', () => {
    expect(['classic', 'light', 'heavy'].map((goal) => goalName(goal as 'classic'))).toEqual([
      'classique',
      'léger',
      'lourd',
    ]);
  });

  it('dit la charge pour la fourchette et les séries : « 72,5 kg pour 3 séries de 8 – 12 reps »', () => {
    const base = line({ zone: { low: 8, high: 12 } });
    expect(planReading(base)).toBe('72,5 kg pour 3 séries de 8 – 12 reps');
    expect(planReading(line({ zone: { low: 15, high: 20 }, plannedSets: 2, suggestedKg: 37.5 }))).toBe(
      '37,5 kg pour 2 séries de 15 – 20 reps',
    );
    expect(planReading(line({ zone: { low: 20, high: 20 }, plannedSets: 4 }))).toBe(
      '72,5 kg pour 4 séries de 20 reps',
    );
  });

  it('n’accorde pas « 1 séries » : une série seule se dit une série', () => {
    expect(planReading(line({ zone: { low: 8, high: 12 }, plannedSets: 1 }))).toBe(
      '72,5 kg pour une série de 8 – 12 reps',
    );
  });

  it('dit la charge de la série la plus lourde pour une pyramide', () => {
    expect(planReading(line({ zone: { low: 8, high: 12 }, pyramid: true, suggestedKg: 77.5 }))).toBe(
      '77,5 kg pour ta série la plus lourde',
    );
    expect(pyramidReading(line({ pyramid: true }))).toBe(
      'Les autres séries suivent du même écart : la forme de ta pyramide ne change pas.',
    );
    expect(pyramidReading(line())).toBeUndefined();
  });

  it('ne dit rien d’une ligne qui n’a pas de charge conseillée', () => {
    expect(planReading(line({ zone: undefined }))).toBeUndefined();
    expect(planReading(line({ zone: { low: 8, high: 12 }, plannedSets: undefined }))).toBeUndefined();
    expect(planReading(line({ zone: { low: 8, high: 12 }, suggestedKg: undefined }))).toBeUndefined();
  });

  it('dit ce que chaque série tient à fond à cette charge', () => {
    expect(holdReading(line({ holdReps: [13, 11, 10], suggestedKg: 52.5 }))).toBe(
      'À 52,5 kg, tu tiendras environ 13 · 11 · 10 reps à fond.',
    );
    expect(holdReading(line({ holdReps: [10], suggestedKg: 77.5 }))).toBe(
      'À 77,5 kg, tu tiendras environ 10 reps à fond.',
    );
    expect(holdReading(line())).toBeUndefined();
    expect(holdReading(line({ holdReps: [] }))).toBeUndefined();
  });

  it('met en garde contre une estimation tirée d’un essai loin de ce que la première série doit tenir, et d’elle seule', () => {
    expect(roughReading(line({ rough: true, tested: { weight: 40, reps: 25 } }))).toMatch(
      /Estimation approximative : 25 répétitions, c’est loin des 12 que la première série doit tenir/,
    );
    expect(roughReading(line())).toBeUndefined();
    expect(roughReading(line({ rough: true, referenceReps: undefined }))).toBeUndefined();
  });

  it('ne parle de l’interrupteur que quand il existe : il n’y en a pas sans proposition', () => {
    const proposal = {
      routineExerciseId: 'row',
      exerciseId: 'bench',
      targetSetIds: ['a'],
      anchorSetId: 'a',
      proposedWeight: 77.5,
    };
    const rough = { rough: true as const, tested: { weight: 40, reps: 25 } };

    expect(roughReading(line({ ...rough, proposal }))).toMatch(/L’interrupteur est éteint, à toi de le rallumer\.$/);
    expect(roughReading(line({ ...rough }))).not.toMatch(/interrupteur/);
    expect(roughReading(line({ ...rough, aligned: true }))).not.toMatch(/interrupteur/);
  });

  it('rappelle en tête de séance ce que le benchmark demande, et le nombre de répétitions à viser avec un style', () => {
    expect(bannerReading(undefined)).toBe(
      'Benchmark · une série à l’échec par exercice, avec la charge que tu penses tenir dans sa fourchette.',
    );
    expect(bannerReading('light')).toBe(
      'Benchmark léger · une série à l’échec par exercice, avec la charge que tu penses tenir environ 18 fois.',
    );
    expect(bannerReading('classic')).toMatch(/Benchmark classique .* environ 12 fois\.$/);
    expect(bannerReading('heavy')).toMatch(/Benchmark lourd .* environ 8 fois\.$/);
  });

  it('accorde le compte des exercices mis à jour', () => {
    expect(appliedReading(0)).toMatch(/rien n’a été écrit/);
    expect(appliedReading(1)).toBe('1 exercice mis à jour dans la routine.');
    expect(appliedReading(3)).toBe('3 exercices mis à jour dans la routine.');
  });
});
