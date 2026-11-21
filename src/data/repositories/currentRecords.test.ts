import { describe, expect, it } from 'vitest';
import type { PersonalRecord } from '@/data/types';
import { currentRecordsByExercise } from './currentRecords';
import type { RecordTimelineEntry } from './recordTimeline';

let counter = 0;
function entry(
  exerciseId: string,
  exerciseName: string,
  type: PersonalRecord['type'],
  value: number,
  achievedAt: number,
): RecordTimelineEntry {
  counter += 1;
  return {
    record: {
      id: `record-${counter}`,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: 0,
      exerciseId,
      type,
      value,
      achievedAt,
      workoutId: `workout-${counter}`,
    },
    exerciseName,
    workoutStatus: 'completed',
  };
}

describe('currentRecordsByExercise', () => {
  it('ne garde que le record en cours de chaque type : un record battu n’y figure pas', () => {
    // La chronologie arrive du plus récent au plus ancien.
    const groups = currentRecordsByExercise([
      entry('squat', 'Squat', 'max_weight', 62.5, 3),
      entry('squat', 'Squat', 'max_weight', 60, 2),
      entry('squat', 'Squat', 'max_weight', 50, 1),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.entries.map((current) => current.record.value)).toEqual([62.5]);
  });

  it('garde un record en cours par type, dans l’ordre charge, 1RM, meilleure série', () => {
    const groups = currentRecordsByExercise([
      entry('squat', 'Squat', 'max_volume_set', 500, 5),
      entry('squat', 'Squat', 'best_1rm', 78, 4),
      entry('squat', 'Squat', 'max_weight', 62.5, 3),
      entry('squat', 'Squat', 'max_volume_set', 400, 2),
    ]);

    expect(groups[0]!.entries.map((current) => current.record.type)).toEqual([
      'max_weight',
      'best_1rm',
      'max_volume_set',
    ]);
    expect(groups[0]!.entries[2]!.record.value).toBe(500);
  });

  it('regroupe par exercice, dans l’ordre alphabétique des noms', () => {
    const groups = currentRecordsByExercise([
      entry('squat', 'Squat', 'max_weight', 60, 3),
      entry('bench', 'Développé couché', 'max_weight', 80, 2),
      entry('curl', 'Curl', 'max_reps', 12, 1),
    ]);

    expect(groups.map((group) => group.exerciseId)).toEqual(['curl', 'bench', 'squat']);
  });

  it('rend une liste vide pour une chronologie vide', () => {
    expect(currentRecordsByExercise([])).toEqual([]);
  });
});
