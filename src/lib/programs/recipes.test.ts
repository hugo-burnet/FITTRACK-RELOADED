import { describe, expect, it } from 'vitest';
import { PROGRAM_PHASES } from '@/data/types';
import { SUGGESTED_LOAD_INDEX } from './phaseSuggestions';
import { PROGRAM_RECIPE_IDS, applyProgramRecipe, matchingProgramRecipe } from './recipes';

const shape = (weeks: readonly { phase: string; loadIndex: number }[]): string =>
  weeks.map((week) => `${week.phase} ${week.loadIndex}`).join(' | ');

describe('applyProgramRecipe', () => {
  it('repeats the 4-week hypertrophy pattern across 8 weeks', () => {
    const weeks = applyProgramRecipe('hypertrophy', 8);

    expect(shape(weeks)).toBe(
      [
        'construction 100',
        'progression 105',
        'overload 110',
        'deload 60',
        'construction 100',
        'progression 105',
        'overload 110',
        'deload 60',
      ].join(' | '),
    );
  });

  it('truncates mid-pattern on 5 weeks', () => {
    expect(shape(applyProgramRecipe('strength', 5))).toBe(
      [
        'construction 100',
        'construction 100',
        'progression 105',
        'test 110',
        'construction 100',
      ].join(' | '),
    );
  });

  it('covers exactly one pattern on 4 weeks', () => {
    expect(shape(applyProgramRecipe('return', 4))).toBe(
      ['return 100', 'construction 100', 'progression 105', 'deload 60'].join(' | '),
    );
  });

  it('numbers weeks from 0 without a gap, whatever the duration', () => {
    for (const durationWeeks of [4, 5, 8, 12]) {
      const weeks = applyProgramRecipe('hypertrophy', durationWeeks);
      expect(weeks).toHaveLength(durationWeeks);
      expect(weeks.map((week) => week.weekIndex)).toEqual(
        Array.from({ length: durationWeeks }, (_, index) => index),
      );
    }
  });

  /**
   * Contract: a recipe is a sequence of *phases*. The level is read from the
   * editor suggestion, so there is never a second scale to keep in sync.
   */
  it('reads every loadIndex from the phase suggestion table', () => {
    for (const id of PROGRAM_RECIPE_IDS) {
      for (const week of applyProgramRecipe(id, 12)) {
        expect(week.loadIndex).toBe(SUGGESTED_LOAD_INDEX[week.phase]);
      }
    }
  });

  it('only produces phases the schema knows', () => {
    const known = new Set<string>(PROGRAM_PHASES);
    for (const id of PROGRAM_RECIPE_IDS) {
      for (const week of applyProgramRecipe(id, 12)) {
        expect(known.has(week.phase)).toBe(true);
      }
    }
  });

  it('returns nothing for a non-positive duration', () => {
    expect(applyProgramRecipe('hypertrophy', 0)).toEqual([]);
    expect(applyProgramRecipe('hypertrophy', -3)).toEqual([]);
  });

  describe('sealed weeks', () => {
    it('leaves weeks before the effective index untouched', () => {
      const existing = [
        { weekIndex: 0, phase: 'test' as const, loadIndex: 110 },
        { weekIndex: 1, phase: 'test' as const, loadIndex: 110 },
        { weekIndex: 2, phase: 'test' as const, loadIndex: 110 },
        { weekIndex: 3, phase: 'test' as const, loadIndex: 110 },
      ];

      const weeks = applyProgramRecipe('hypertrophy', 4, {
        existing,
        effectiveFromWeekIndex: 2,
      });

      expect(shape(weeks)).toBe(['test 110', 'test 110', 'overload 110', 'deload 60'].join(' | '));
    });

    /** The pattern is anchored to the block, not to the edit: S5 of an 8-week
     * hypertrophy block stays a construction week whether or not S1–S4 are sealed. */
    it('keeps the pattern anchored to weekIndex, not to the effective index', () => {
      const full = applyProgramRecipe('hypertrophy', 8);
      const partial = applyProgramRecipe('hypertrophy', 8, {
        existing: full.map((week) => ({ ...week, phase: 'test' as const, loadIndex: 110 })),
        effectiveFromWeekIndex: 4,
      });

      expect(shape(partial.slice(4))).toBe(shape(full.slice(4)));
    });

    it('rewrites everything when the effective index is 0', () => {
      const existing = Array.from({ length: 4 }, (_, weekIndex) => ({
        weekIndex,
        phase: 'test' as const,
        loadIndex: 110,
      }));

      expect(shape(applyProgramRecipe('return', 4, { existing, effectiveFromWeekIndex: 0 }))).toBe(
        shape(applyProgramRecipe('return', 4)),
      );
    });

    it('falls back to the recipe when a sealed week is missing from existing', () => {
      const weeks = applyProgramRecipe('hypertrophy', 4, {
        existing: [{ weekIndex: 0, phase: 'test', loadIndex: 110 }],
        effectiveFromWeekIndex: 2,
      });

      expect(weeks[0]).toMatchObject({ phase: 'test', loadIndex: 110 });
      expect(weeks[1]).toMatchObject({ phase: 'progression', loadIndex: 105 });
    });
  });
});

describe('matchingProgramRecipe', () => {
  it('reconnaît la recette déjà appliquée au premier affichage', () => {
    expect(matchingProgramRecipe(applyProgramRecipe('hypertrophy', 8))).toBe('hypertrophy');
    expect(matchingProgramRecipe(applyProgramRecipe('strength', 8))).toBe('strength');
    expect(matchingProgramRecipe(applyProgramRecipe('return', 8))).toBe('return');
  });

  it('ne garde aucun bouton actif après une retouche manuelle', () => {
    const weeks = applyProgramRecipe('hypertrophy', 8);
    weeks[4] = { ...weeks[4]!, phase: 'deload', loadIndex: 60 };

    expect(matchingProgramRecipe(weeks)).toBeNull();
  });

  it('ignore les semaines scellées et reconnaît le trajet encore modifiable', () => {
    const weeks = applyProgramRecipe('hypertrophy', 8);
    weeks[0] = { ...weeks[0]!, phase: 'test', loadIndex: 110 };

    expect(matchingProgramRecipe(weeks, 4)).toBe('hypertrophy');
  });
});
