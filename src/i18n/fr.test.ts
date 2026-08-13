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

  it('exposes phase labels and intention phrases from the design spec', () => {
    expect(t('program.phase.construction')).toBe('Construction');
    expect(t('program.phase.overload')).toBe('Surcharge');
    expect(t('program.phase.return')).toBe('Reprise');
    expect(t('program.intention.progression')).toBe('Progresser si les perfs le permettent.');
    expect(t('program.intention.deload')).toBe('Charge et volume réduits.');
    expect(t('program.intention.test')).toBe(
      'Tentative contrôlée, seulement si déjà autorisée.',
    );
  });
});
