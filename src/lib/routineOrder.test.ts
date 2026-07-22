import { describe, expect, it } from 'vitest';
import { moveItem, normalizeSupersets, toBlocks } from './routineOrder';

/** Shorthand: a list of rows described by their superset group alone. */
const rows = (...groups: number[]) => groups.map((supersetGroup, i) => ({ supersetGroup, i }));
const groups = (result: { supersetGroup: number }[]) => result.map((row) => row.supersetGroup);

describe('moveItem', () => {
  it('moves an item down', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item up', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('leaves the list alone when the item does not move', () => {
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'b', 'c']);
  });

  it('moves across the whole list, both ways', () => {
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });

  it('never mutates its input', () => {
    const original = ['a', 'b', 'c'];
    moveItem(original, 0, 2);
    expect(original).toEqual(['a', 'b', 'c']);
  });

  it('ignores an out-of-range index rather than producing holes', () => {
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
    expect(moveItem(['a', 'b'], 0, 9)).toEqual(['a', 'b']);
  });
});

describe('normalizeSupersets', () => {
  it('leaves an ungrouped list untouched', () => {
    expect(groups(normalizeSupersets(rows(0, 0, 0)))).toEqual([0, 0, 0]);
  });

  it('keeps a pair grouped and renumbers it from 1', () => {
    expect(groups(normalizeSupersets(rows(0, 4, 4, 0)))).toEqual([0, 1, 1, 0]);
  });

  it('renumbers several groups in order of appearance', () => {
    expect(groups(normalizeSupersets(rows(7, 7, 0, 3, 3, 3)))).toEqual([1, 1, 0, 2, 2, 2]);
  });

  // A superset of one exercise is an exercise.
  it('dissolves a group left with a single member', () => {
    expect(groups(normalizeSupersets(rows(0, 2, 0)))).toEqual([0, 0, 0]);
  });

  // The accent rule draws a container; dropping into a container puts you in it.
  it('lets a row dropped between two members of one group join it', () => {
    expect(groups(normalizeSupersets(rows(1, 0, 1)))).toEqual([1, 1, 1]);
  });

  /**
   * Dragging a superset member into the middle of *another* superset breaks
   * both, and that is the intended answer rather than a gap to patch: nothing
   * in `[B:1, C:2, A:1, D:2]` says whether A moved into (C, D) or C into
   * (B, A). Any rule that picks one is guessing. The two accent rules vanish on
   * screen the moment it happens, so it is visible, not silent.
   */
  it('dissolves both groups when one is dragged through the other', () => {
    expect(groups(normalizeSupersets(rows(1, 2, 1, 2)))).toEqual([0, 0, 0, 0]);
  });

  it('does not join a row dropped between two different groups', () => {
    expect(groups(normalizeSupersets(rows(1, 1, 0, 2, 2)))).toEqual([1, 1, 0, 2, 2]);
  });

  it('does not bridge a gap of two rows', () => {
    expect(groups(normalizeSupersets(rows(1, 0, 0, 1)))).toEqual([0, 0, 0, 0]);
  });

  // Dragging the first exercise of a superset down to the end of the routine:
  // its group travels with it, but it is no longer adjacent to anything.
  it('dissolves a row that its group left behind', () => {
    expect(groups(normalizeSupersets(rows(5, 5, 0, 0, 5)))).toEqual([1, 1, 0, 0, 0]);
  });

  it('splits one group number into two when a different group sits between', () => {
    expect(groups(normalizeSupersets(rows(1, 1, 2, 2, 1, 1)))).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('never mutates its input', () => {
    const original = rows(4, 4, 0);
    normalizeSupersets(original);
    expect(groups(original)).toEqual([4, 4, 0]);
  });
});

describe('toBlocks', () => {
  it('gives every ungrouped row a block of its own', () => {
    const blocks = toBlocks(rows(0, 0));
    expect(blocks).toHaveLength(2);
    expect(blocks.every((block) => block.group === 0 && block.rows.length === 1)).toBe(true);
  });

  it('gathers consecutive rows of one group into a single block', () => {
    const blocks = toBlocks(rows(0, 1, 1, 1, 0));
    expect(blocks.map((block) => block.group)).toEqual([0, 1, 0]);
    expect(blocks[1]?.rows).toHaveLength(3);
  });

  it('preserves order and loses no row', () => {
    const source = rows(0, 2, 2, 0, 1, 1);
    const flattened = toBlocks(source).flatMap((block) => block.rows);
    expect(flattened).toEqual(source);
  });
});
