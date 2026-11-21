import { describe, expect, it } from 'vitest';
import type { RecordTimelineEntry } from '@/data/repositories/recordTimeline';
import { latestRecordLine } from './progressionText';

const entry = (
  overrides: Partial<RecordTimelineEntry['record']> = {},
  previousValue?: number,
): RecordTimelineEntry => ({
  record: {
    id: 'r1',
    exerciseId: 'bench',
    type: 'max_weight',
    value: 85,
    achievedAt: new Date(2026, 10, 16, 18).getTime(),
    workoutId: 'w1',
    createdAt: 0,
    updatedAt: 0,
    deletedAt: 0,
    ...overrides,
  },
  exerciseName: 'Développé couché (barre)',
  workoutStatus: 'completed',
  ...(previousValue === undefined ? {} : { previousValue }),
});

describe('latestRecordLine', () => {
  it('dit l’exercice, le type, l’écart et le jour', () => {
    expect(latestRecordLine(entry({}, 82.5))).toBe(
      'Développé couché (barre) · Charge max, +2,5 kg le lun. 16 nov.',
    );
  });

  it('se passe de l’écart pour un premier jalon', () => {
    expect(latestRecordLine(entry())).toBe('Développé couché (barre) · Charge max le lun. 16 nov.');
  });

  it('suffixe un exercice unilatéral comme la frise', () => {
    expect(latestRecordLine({ ...entry(), isUnilateral: 1 })).toContain('(unilatéral)');
  });
});
