import { describe, expect, it } from 'vitest';
import type { Equipment, Exercise } from '@/data/types';
import catalogueRows from '@/data/seed/exercises.json';
import type { CatalogueExercise } from '@/data/seed/seedDatabase';
import type { HevyParsedSet } from './hevyCsv';
import {
  findCanonicalHevyExercise,
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

const catalogue = (catalogueRows as CatalogueExercise[]).map(
  (row): Exercise => ({
    ...row,
    id: row.slug,
    createdAt: 1,
    updatedAt: 1,
    deletedAt: 0,
    isCustom: 0,
  }),
);

function catalogueExercise(slug: string): Exercise {
  const found = catalogue.find((candidate) => candidate.slug === slug);
  if (found === undefined) throw new Error(`Missing catalogue slug: ${slug}`);
  return found;
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

  it.each([
    ['Abduction Hanche', 'hip-abduction-machine'],
    ['Adduction Hanche', 'hip-adduction-machine'],
    ['Chest Press (Machine)', 'machine-chest-press'],
    ['Curl Biceps (Haltère)', 'dumbbell-curl'],
    ['Curl Marteau (Haltère)', 'hammer-curl'],
    ['Dead Hang', 'dead-hang'],
    ['Développé Couché (Haltère)', 'dumbbell-bench-press'],
    [
      'Développé Couché Incliné (Haltère)',
      'dumbbell-incline-bench-press',
    ],
    ['Élévation Latérale (Poulie)', 'cable-lateral-raise'],
    [
      'Extension Dos (Hyperextension Lestée)',
      'weighted-back-extension',
    ],
    ['Extension Jambes', 'leg-extension'],
    ['Extension Triceps Corde', 'cable-triceps-pushdown-rope'],
    ['Kickbacks Poulie', 'cable-glute-kickback'],
    ['Leg Curl Assis', 'seated-leg-curl'],
    ['Planche', 'plank'],
    ['Planche Latérale', 'side-plank'],
    ['Presse à Cuisses Horizontal', 'leg-press'],
    ['Presse Épaules Assis (Machine)', 'machine-shoulder-press'],
    ['Tirage Poitrine (Poulie)', 'lat-pulldown'],
    ['Tirage vers Visage', 'face-pull'],
  ])('maps %s to the catalogue slug %s', (title, slug) => {
    const candidate = catalogueExercise(slug);
    expect(
      findCanonicalHevyExercise(title, candidate.measurementType, [
        candidate,
      ])?.slug,
    ).toBe(slug);
  });

  it.each([
    'Développé Debout Poulie Centrée',
    'Hip Thrust (Dumbbell)',
    'Rotation Externe Poulie',
    'Tirage bas iso-latéral',
  ])('does not invent a canonical target for %s', (title) => {
    expect(
      findCanonicalHevyExercise(title, 'weight_reps', catalogue),
    ).toBeUndefined();
  });

  it('rejects an alias target with an incompatible measurement', () => {
    const deadHang = catalogueExercise('dead-hang');
    expect(
      findCanonicalHevyExercise('Dead Hang', 'time_only', [
        { ...deadHang, measurementType: 'weight_reps' },
      ]),
    ).toBeUndefined();
  });

  it('uses bilingual movement synonyms for non-canonical titles', () => {
    const exercises = [
      exercise('Développé épaules (haltères)', 'dumbbell'),
      exercise('Curl haltères', 'dumbbell'),
    ];
    expect(
      rankHevyExerciseCandidates(
        'Seated Dumbbell Shoulder Press',
        exercises,
      )[0]?.name,
    ).toBe('Développé épaules (haltères)');
  });

  it('uses movement tokens to distinguish a horizontal low row', () => {
    const exercises = [
      exercise('Tirage horizontal (poulie basse)', 'cable'),
      exercise('Tirage vertical (poulie haute)', 'cable'),
    ];
    expect(
      rankHevyExerciseCandidates(
        'Horizontal Low Cable Row',
        exercises,
      )[0]?.name,
    ).toBe('Tirage horizontal (poulie basse)');
  });
});
