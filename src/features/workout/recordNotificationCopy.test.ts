import { describe, expect, it } from 'vitest';
import type { RecordTimelineEntry } from '@/data/repositories/personalRecords';
import type { PersonalRecordType } from '@/data/types';
import { recordNotificationCopy } from './recordNotificationCopy';

function entry(
  exerciseName: string,
  type: PersonalRecordType,
  value: number,
): RecordTimelineEntry {
  return {
    record: {
      id: `${exerciseName}-${type}`,
      createdAt: 0,
      updatedAt: 0,
      deletedAt: 0,
      exerciseId: exerciseName,
      type,
      value,
      achievedAt: 0,
      workoutId: 'w1',
    },
    exerciseName,
    workoutStatus: 'active',
    previousValue: value - 5,
  };
}

describe('recordNotificationCopy', () => {
  it('says nothing at all when nothing fell', () => {
    expect(recordNotificationCopy([])).toBeUndefined();
  });

  it('names the exercise first: a line in the shade has no context of its own', () => {
    expect(recordNotificationCopy([entry('Développé couché', 'max_weight', 102.5)])).toEqual({
      title: 'Record battu',
      body: 'Développé couché · Charge max 102,5 kg',
    });
  });

  it('counts a batch instead of stacking near-identical lines', () => {
    const copy = recordNotificationCopy([
      entry('Développé couché', 'max_weight', 102.5),
      entry('Développé couché', 'best_1rm', 120),
      entry('Squat', 'max_weight', 140),
    ]);

    expect(copy?.body).toBe('3 records · Développé couché et Squat');
  });
});
