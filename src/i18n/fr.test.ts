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
