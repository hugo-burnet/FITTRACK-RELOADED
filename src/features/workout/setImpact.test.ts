import { describe, expect, it } from 'vitest';
import { t } from '@/i18n/fr';
import { setImpactTag } from './setImpact';

describe('setImpactTag', () => {
  it('says what the set just added, in kilograms', () => {
    expect(setImpactTag({ weight: 142.5, reps: 5 }, 'normal')).toBe(
      t('workout.setTonnage', { value: '712,5' }),
    );
  });

  it('rounds to a tenth, the way a load is read', () => {
    expect(setImpactTag({ weight: 33.75, reps: 3 }, 'normal')).toBe(
      t('workout.setTonnage', { value: '101,3' }),
    );
  });

  it('falls back to the set itself when there is no tonnage (a plank, a pull-up)', () => {
    expect(setImpactTag({ duration: 60 }, 'normal')).toBe(t('workout.setPlusOne'));
    expect(setImpactTag({ reps: 12 }, 'normal')).toBe(t('workout.setPlusOne'));
  });

  it('claims no tonnage for a warm-up, which counts for none', () => {
    expect(setImpactTag({ weight: 60, reps: 5 }, 'warmup')).toBe(t('workout.setPlusOne'));
  });
});
