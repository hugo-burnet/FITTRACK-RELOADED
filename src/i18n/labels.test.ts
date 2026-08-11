import { describe, expect, it } from 'vitest';
import { t } from './fr';
import {
  oneRepMaxFormulaLabel,
  metricLabel,
  metricReading,
  recordContext,
  recordGain,
  recordLabel,
  recordValue,
  weeklyVolumeMetricLabel,
  weeklyVolumeReading,
  weeklyVolumeScaleReading,
} from './labels';
import type { PersonalRecord } from '@/data/types';

const stamps = { id: 'record', createdAt: 1, updatedAt: 1, deletedAt: 0 };

function record(
  type: PersonalRecord['type'],
  value: number,
  context: Partial<PersonalRecord> = {},
): PersonalRecord {
  return {
    ...stamps,
    exerciseId: 'bench',
    type,
    value,
    achievedAt: 2,
    workoutId: 'workout',
    ...context,
  };
}

describe('personal record labels', () => {
  it('names every persisted category in French', () => {
    expect([
      recordLabel('max_weight'),
      recordLabel('max_added_weight'),
      recordLabel('min_assistance'),
      recordLabel('max_reps'),
      recordLabel('best_1rm'),
      recordLabel('max_volume_set'),
      recordLabel('max_volume_session'),
      recordLabel('max_duration'),
      recordLabel('max_distance'),
    ]).toEqual([
      'Charge max',
      'Lest max',
      'Assistance minimale',
      'Répétitions max',
      '1RM estimé',
      'Meilleure série',
      'Tonnage séance',
      'Durée max',
      'Distance max',
    ]);
  });

  it('formats kilos, repetitions, seconds and metres for reading', () => {
    expect(recordValue(record('max_weight', 102.5))).toBe('102,5 kg');
    expect(recordValue(record('max_reps', 12))).toBe('12 reps');
    expect(recordValue(record('max_duration', 90))).toBe('1:30 min');
    expect(recordValue(record('max_distance', 750))).toBe('750 m');
  });

  it('makes assistance and session tonnage explicit', () => {
    expect(recordValue(record('min_assistance', 25))).toBe('25 kg d’assistance');
    expect(recordContext(record('max_volume_session', 1_250))).toBe('Tonnage de la séance');
  });

  it('does not mistake ambiguous repetition weight for added load', () => {
    expect(recordContext(record('max_reps', 12, { weight: 25, reps: 12 }))).toBe('');
  });

  it('reads the performed set and formula behind an estimated 1RM', () => {
    expect(
      recordContext(record('best_1rm', 116.67, { weight: 100, reps: 5, formula: 'epley' })),
    ).toBe('100 kg × 5 · Epley');
    expect(oneRepMaxFormulaLabel('brzycki')).toBe('Brzycki');
    expect(oneRepMaxFormulaLabel('lombardi')).toBe('Lombardi');
  });

  it('reads strict gains and leaves an initial mark without a gain', () => {
    expect(recordGain(record('max_weight', 105), 100)).toBe('+5 kg');
    expect(recordGain(record('max_reps', 12), 10)).toBe('+2 reps');
    expect(recordGain(record('max_duration', 75), 60)).toBe('+15 s');
    expect(recordGain(record('max_distance', 1_250), 1_000)).toBe('+250 m');
    expect(recordGain(record('min_assistance', 25), 30)).toBe('−5 kg d’assistance');
    expect(recordGain(record('max_weight', 105))).toBeUndefined();
  });
});

describe('estimated 1RM analytics labels', () => {
  it('names the metric and rounds its kilogram display to one decimal', () => {
    expect(metricLabel('estimatedOneRepMax')).toBe('1RM estimé');
    expect(metricReading(116.66666666666667, 'kg', 'estimatedOneRepMax')).toBe('116,7 kg');
  });

  it('describes the selected-formula estimate without claiming an exact maximum', () => {
    expect(oneRepMaxFormulaLabel('brzycki')).toBe('Brzycki');
    expect(t('settings.oneRepMaxBrzyckiHint')).toBe(
      'Une estimation fondée sur la charge et le nombre de répétitions.',
    );
  });
});

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

  it('lit une semaine sans durée en minutes, jamais en secondes', () => {
    expect(weeklyVolumeReading(0, 'duration')).toBe('0 min');
  });

  it('grave les grands tonnages sous une forme compacte', () => {
    expect(weeklyVolumeScaleReading(12_400, 'tonnage')).toMatch(/^12,4\s?k$/);
  });
});
