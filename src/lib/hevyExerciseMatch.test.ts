import { describe, expect, it } from 'vitest';
import type { Equipment, Exercise } from '@/data/types';
import type { HevyParsedSet } from './hevyCsv';
import {
  inferHevyEquipment,
  inferHevyMeasurementType,
  normalizeHevyExerciseTitle,
  rankHevyExerciseCandidates,
} from './hevyExerciseMatch';

const BASE_SET: HevyParsedSet = {
  sourceLine: 2,
  order: 0,
  setType: 'normal',
};

function exercise(name: string, equipment: Equipment): Exercise {
  return {
    id: name,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: 0,
    name,
    primaryMuscle: 'other',
    secondaryMuscles: [],
    equipment,
    measurementType: 'weight_reps',
    isCustom: 0,
    isUnilateral: 0,
  };
}

describe('inferHevyMeasurementType', () => {
  it.each([
    [{ weight: 20, reps: 8 }, 'weight_reps'],
    [{ reps: 12 }, 'reps_only'],
    [{ durationSeconds: 60 }, 'time_only'],
    [
      { distanceMeters: 1000, durationSeconds: 300 },
      'distance_time',
    ],
    [{ weight: 20, durationSeconds: 60 }, 'weight_time'],
  ] as const)('infers the measurement shape from %o', (set, expected) => {
    expect(
      inferHevyMeasurementType([{ ...BASE_SET, ...set }]),
    ).toBe(expected);
  });

  it('rejects incompatible shapes for one source exercise', () => {
    expect(
      inferHevyMeasurementType([
        { ...BASE_SET, weight: 20, reps: 8 },
        { ...BASE_SET, durationSeconds: 60 },
      ]),
    ).toBeUndefined();
  });

  it('rejects an unsupported or empty measurement shape', () => {
    expect(inferHevyMeasurementType([BASE_SET])).toBeUndefined();
    expect(
      inferHevyMeasurementType([
        { ...BASE_SET, weight: 20, distanceMeters: 1000 },
      ]),
    ).toBeUndefined();
  });
});

describe('Hevy exercise title matching', () => {
  it('removes accents, plurals, case and equipment mentions', () => {
    expect(
      normalizeHevyExerciseTitle('Développés couchés (Haltères)'),
    ).toBe('developpe couche');
  });

  it.each([
    ['Squat (barre)', 'barbell'],
    ['Curl avec haltères', 'dumbbell'],
    ['Développé machine Smith', 'smith'],
    ['Tirage à la poulie', 'cable'],
    ['Presse à cuisses machine', 'machine'],
    ['Écarté avec élastique', 'band'],
    ['Swing kettlebell', 'kettlebell'],
    ['Pompes au poids du corps', 'bodyweight'],
    ['Élévation avec disque', 'plate'],
    ['Extension de jambes', 'other'],
  ] as const)('infers %s equipment as %s', (title, expected) => {
    expect(inferHevyEquipment(title)).toBe(expected);
  });

  it('ranks the normalized movement ahead of partial matches', () => {
    const exercises = [
      exercise('Développé couché à la barre', 'barbell'),
      exercise('Développé militaire à la barre', 'barbell'),
      exercise('Écarté couché avec haltères', 'dumbbell'),
    ];

    expect(
      rankHevyExerciseCandidates(
        'Développés couchés (barre)',
        exercises,
      )[0]!.name,
    ).toBe('Développé couché à la barre');
  });

  it('uses French collation as the deterministic tie breaker', () => {
    const exercises = [
      exercise('Tirage zèbre', 'cable'),
      exercise('Tirage épaules', 'cable'),
    ];

    expect(
      rankHevyExerciseCandidates('Tirage', exercises).map(
        (candidate) => candidate.name,
      ),
    ).toEqual(['Tirage épaules', 'Tirage zèbre']);
  });
});
