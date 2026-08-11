import { describe, expect, it } from 'vitest';
import { MUSCLE_GROUPS } from '@/data/types';
import { MUSCLE_SCOPE } from '@/lib/analytics/muscles';
import {
  ALL_REGION_IDS,
  REGIONS_BY_MUSCLE,
  UNDRAWN_REGIONS,
  hasDrawableMuscles,
  isDrawable,
  muscleOfRegion,
} from './regionsByMuscle';

/**
 * The join between our 16 groups and the vendor's 89 regions, tested where it
 * can actually break: the geometry is a file we did not write and may re-fetch.
 * A renamed id is invisible to review and silent at runtime — the region simply
 * never lights. These assertions read the embedded data, so that failure is a
 * red test instead of a hole in the drawing nobody notices.
 */

const mapped = Object.values(REGIONS_BY_MUSCLE).flat();

describe('REGIONS_BY_MUSCLE', () => {
  it('only names regions the embedded geometry defines', () => {
    const unknown = mapped.filter((id) => !ALL_REGION_IDS.includes(id));
    expect(unknown).toEqual([]);
  });

  it('gives every drawable group at least one region', () => {
    for (const [muscle, ids] of Object.entries(REGIONS_BY_MUSCLE)) {
      expect(ids.length, `${muscle} has nowhere to be drawn`).toBeGreaterThan(0);
    }
  });

  it('never lets two groups claim the same region', () => {
    const seen = new Set<string>();
    const duplicates = mapped.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
    expect(duplicates).toEqual([]);
  });

  it('covers exactly the groups scoped as regions', () => {
    const drawable = MUSCLE_GROUPS.filter((muscle) => MUSCLE_SCOPE[muscle] === 'region');
    expect(Object.keys(REGIONS_BY_MUSCLE).sort()).toEqual([...drawable].sort());
  });
});

describe('UNDRAWN_REGIONS', () => {
  // The one assertion that catches a vendor update: mapped ∪ undrawn must be
  // the whole body, with nothing left over on either side.
  it('is exactly what the mapping leaves out', () => {
    const leftOver = ALL_REGION_IDS.filter(
      (id) => !mapped.includes(id) && !UNDRAWN_REGIONS.includes(id),
    );
    expect(leftOver, 'geometry region belonging to no group and not declared undrawn').toEqual([]);
  });

  it('declares nothing the geometry does not have', () => {
    const stale = UNDRAWN_REGIONS.filter((id) => !ALL_REGION_IDS.includes(id));
    expect(stale).toEqual([]);
  });

  it('never declares a region that a group also claims', () => {
    expect(UNDRAWN_REGIONS.filter((id) => mapped.includes(id))).toEqual([]);
  });
});

describe('muscleOfRegion', () => {
  it('reads a region back to its group', () => {
    expect(muscleOfRegion('biceps-left')).toBe('biceps');
    expect(muscleOfRegion('traps-upper-right')).toBe('traps');
    expect(muscleOfRegion('traps-mid-right')).toBe('upper_back');
  });

  it('is undefined for a region no group lights', () => {
    expect(muscleOfRegion('serratus-anterior-left')).toBeUndefined();
    expect(muscleOfRegion('nope')).toBeUndefined();
  });
});

describe('isDrawable', () => {
  it('accepts a muscle and rejects a filing box', () => {
    expect(isDrawable('chest')).toBe(true);
    expect(isDrawable('cardio')).toBe(false);
    expect(isDrawable('full_body')).toBe(false);
    expect(isDrawable('other')).toBe(false);
  });
});

describe('hasDrawableMuscles', () => {
  it('is true when the primary muscle is a region', () => {
    expect(hasDrawableMuscles({ primaryMuscle: 'chest' })).toBe(true);
  });

  // A rower is `cardio` with no secondaries: the screen must show no silhouette
  // at all rather than a blank body. This is the roadmap's second checkpoint.
  it('is false when nothing at all can be drawn', () => {
    expect(hasDrawableMuscles({ primaryMuscle: 'cardio', secondaryMuscles: [] })).toBe(false);
    expect(hasDrawableMuscles({ primaryMuscle: 'other' })).toBe(false);
  });

  // A farmer's walk could plausibly be filed as `full_body` while still naming
  // the forearms: the drawing has something to say, so it is shown.
  it('is true on a secondary alone', () => {
    expect(hasDrawableMuscles({ primaryMuscle: 'full_body', secondaryMuscles: ['forearms'] })).toBe(
      true,
    );
  });
});
