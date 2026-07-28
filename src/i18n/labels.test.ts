import { describe, expect, it } from 'vitest';
import {
  weeklyVolumeMetricLabel,
  weeklyVolumeReading,
  weeklyVolumeScaleReading,
} from './labels';

describe('weekly volume labels', () => {
  it('nomme les deux métriques en français', () => {
    expect(weeklyVolumeMetricLabel('tonnage')).toBe('Tonnage');
    expect(weeklyVolumeMetricLabel('duration')).toBe('Durée');
  });

  it('lit un tonnage décimal en kilogrammes', () => {
    expect(weeklyVolumeReading(1_234.5, 'tonnage')).toMatch(/^1\s234,5 kg$/);
  });

  it('arrondit une durée hebdomadaire à la minute', () => {
    expect(weeklyVolumeReading(3_690, 'duration')).toBe('1 h 02');
  });

  it('grave les grands tonnages sous une forme compacte', () => {
    expect(weeklyVolumeScaleReading(12_400, 'tonnage')).toMatch(/^12,4\s?k$/);
  });
});
