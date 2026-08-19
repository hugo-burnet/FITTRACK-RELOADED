import { describe, expect, it } from 'vitest';
import { t } from './fr';

describe('bodyweight tonnage copy', () => {
  it.each([
    'finish.tonnageHint',
    'export.tonnageNote',
    'volume.tonnageHint',
    'metricHint.sessionTonnage',
  ] as const)('%s describes the estimated effective bodyweight load', (key) => {
    const copy = t(key);
    expect(copy).toContain('poids du corps effectif estim\u00e9');
    expect(copy).not.toContain('ni poids du corps');
  });

  it('guides zero-volume users to the body-weight entry', () => {
    expect(t('volume.zeroTonnage')).toContain('Renseigne ton poids');
  });
});

describe('program week intention copy', () => {
  it('prints the shared week line without claiming a 1RM calculation', () => {
    expect(
      t('program.weekLine', { number: '05', level: 60, phase: t('program.phase.deload') }),
    ).toBe('05 — 60 % · Décharge');
    expect(t('program.weekPhaseReading', { number: 3, phase: t('program.phase.progression') })).toBe(
      'Semaine 3 · Progression',
    );
    expect(t('program.stepProgress', { current: 2, name: t('program.stepSplit') })).toBe(
      'Étape 2 sur 3 · Split',
    );
  });

  it('exposes phase labels from the design spec', () => {
    expect(t('program.phase.construction')).toBe('Construction');
    expect(t('program.phase.overload')).toBe('Surcharge');
    expect(t('program.phase.return')).toBe('Reprise');
  });

  it('states what the level does, in load increments and never as a factor', () => {
    // Les anciennes phrases d'intention étaient au conditionnel parce que le
    // niveau ne prescrivait rien. Il opère : la règle est donc affirmative.
    expect(t('program.loadRule.neutral')).toBe('Charges inchangées : celles de tes routines.');
    expect(t('program.loadRule.up')).toBe('+1 cran de charge sur les séries de travail.');
    expect(t('program.loadRule.downMany', { count: 2 })).toBe(
      '−2 crans de charge sur les séries de travail.',
    );
    expect(t('program.loadRule.hint')).toContain('tous les 5 points');
  });
});
