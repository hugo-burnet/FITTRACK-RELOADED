import { describe, expect, it } from 'vitest';
import { MUSCLE_GROUPS } from '@/data/types';
import { MUSCLE_SCOPE, type RegionMuscle } from '@/lib/analytics/muscles';
import { MUSCLE_IDS } from './muscleGroups';
import {
  ALL_MUSCLE_IDS,
  MAPPED_MUSCLE_IDS,
  MUSCLE_IDS_BY_GROUP,
  UNMAPPED_MUSCLE_IDS,
  groupOfMuscleId,
  hasDrawableMuscles,
  isDrawable,
  toIntensities,
} from './musclesByGroup';

/**
 * The groups the catalogue says have somewhere to be drawn.
 *
 * Read off `MUSCLE_SCOPE` rather than through `isDrawable`, so the coverage
 * assertions below still hold the table to the catalogue if `isDrawable` is ever
 * the thing that breaks.
 */
const DRAWABLE_GROUPS = MUSCLE_GROUPS.filter(
  (group): group is RegionMuscle => MUSCLE_SCOPE[group] === 'region',
);

describe('MUSCLE_IDS_BY_GROUP', () => {
  it('only names muscles the drawing defines', () => {
    for (const id of MAPPED_MUSCLE_IDS) {
      expect(MUSCLE_IDS).toContain(id);
    }
  });

  it('gives every drawable group at least one muscle', () => {
    for (const group of DRAWABLE_GROUPS) {
      expect(MUSCLE_IDS_BY_GROUP[group].length).toBeGreaterThan(0);
    }
  });

  it('never lets two groups claim the same muscle', () => {
    expect(new Set(MAPPED_MUSCLE_IDS).size).toBe(MAPPED_MUSCLE_IDS.length);
  });

  it('covers exactly the groups scoped as regions', () => {
    expect(Object.keys(MUSCLE_IDS_BY_GROUP).sort()).toEqual([...DRAWABLE_GROUPS].sort());
  });
});

describe('UNMAPPED_MUSCLE_IDS', () => {
  it('is exactly what the mapping leaves out', () => {
    const left = MUSCLE_IDS.filter((id) => !MAPPED_MUSCLE_IDS.includes(id));
    expect([...UNMAPPED_MUSCLE_IDS].sort()).toEqual([...left].sort());
  });

  it('never declares a muscle that a group also claims', () => {
    for (const id of UNMAPPED_MUSCLE_IDS) {
      expect(MAPPED_MUSCLE_IDS).not.toContain(id);
    }
  });

  it('accounts for every muscle in the drawing, once', () => {
    expect(MAPPED_MUSCLE_IDS.length + UNMAPPED_MUSCLE_IDS.length).toBe(ALL_MUSCLE_IDS.length);
  });
});

describe('isDrawable', () => {
  it('accepts a muscle and rejects a filing box', () => {
    expect(isDrawable('chest')).toBe(true);
    expect(isDrawable('neck')).toBe(true);
    expect(isDrawable('cardio')).toBe(false);
    expect(isDrawable('full_body')).toBe(false);
    expect(isDrawable('other')).toBe(false);
  });
});

describe('hasDrawableMuscles', () => {
  it('is true when the primary muscle is a region', () => {
    expect(hasDrawableMuscles({ primaryMuscle: 'chest' })).toBe(true);
  });

  it('is false when nothing at all can be drawn', () => {
    expect(hasDrawableMuscles({ primaryMuscle: 'cardio', secondaryMuscles: ['other'] })).toBe(
      false,
    );
  });

  it('is true on a secondary alone', () => {
    expect(hasDrawableMuscles({ primaryMuscle: 'cardio', secondaryMuscles: ['quads'] })).toBe(true);
  });
});

describe('toIntensities', () => {
  it('gives every muscle of a group the group intensity', () => {
    expect(toIntensities({ shoulders: 0.5 })).toEqual({
      deltoid_anterior: 0.5,
      deltoid_lateral: 0.5,
      deltoid_posterior: 0.5,
      rotator_cuff: 0.5,
    });
  });

  it('drops groups that have nowhere to be drawn', () => {
    expect(toIntensities({ cardio: 1, full_body: 1, other: 1 })).toEqual({});
  });

  it('drops a group worked at zero rather than drawing it lit', () => {
    expect(toIntensities({ chest: 0 })).toEqual({});
  });

  it('clamps to the ramp the drawing understands', () => {
    expect(toIntensities({ chest: 4 })).toEqual({ pectoralis_major: 1 });
    expect(toIntensities({ chest: -2 })).toEqual({});
  });

  it('keeps two groups apart', () => {
    expect(toIntensities({ chest: 1, lats: 0.3 })).toEqual({
      pectoralis_major: 1,
      latissimus_dorsi: 0.3,
    });
  });
});

describe('groupOfMuscleId', () => {
  it('rend le groupe du catalogue pour un muscle dessiné', () => {
    expect(groupOfMuscleId('pectoralis_major')).toBe('chest');
    expect(groupOfMuscleId('rhomboids')).toBe('upper_back');
    expect(groupOfMuscleId('rotator_cuff')).toBe('shoulders');
  });

  it('est l’exact inverse de la table de lecture', () => {
    for (const [group, ids] of Object.entries(MUSCLE_IDS_BY_GROUP)) {
      for (const id of ids) expect(groupOfMuscleId(id)).toBe(group);
    }
  });

  it('ne rend rien pour les muscles que le catalogue ne nomme pas', () => {
    // Ils sont dessinés exprès : un doigt tombera dessus, et l'écran doit avoir
    // une réponse — simplement pas une liste d'exercices.
    for (const id of UNMAPPED_MUSCLE_IDS) expect(groupOfMuscleId(id)).toBeNull();
  });

  it('répond pour chaque muscle du dessin, sans exception muette', () => {
    for (const id of ALL_MUSCLE_IDS) {
      const group = groupOfMuscleId(id);
      const claimed: readonly string[] = group === null ? [] : MUSCLE_IDS_BY_GROUP[group];
      expect(group === null || claimed.includes(id)).toBe(true);
    }
  });
});
