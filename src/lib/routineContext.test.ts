import { describe, expect, it } from 'vitest';
import {
  normalizeRoutineFolderContext,
  routineContextFromValues,
  routineContextValues,
} from './routineContext';

describe('normalizeRoutineFolderContext', () => {
  it('reads the two historical shapes unchanged', () => {
    expect(normalizeRoutineFolderContext({ kind: 'root' })).toEqual({ kind: 'root' });
    expect(normalizeRoutineFolderContext({ kind: 'folder', folderId: 'push' })).toEqual({
      kind: 'folder',
      folderId: 'push',
    });
  });

  it('reads several folders, with or without the root', () => {
    expect(
      normalizeRoutineFolderContext({ kind: 'folders', folderIds: ['ul', 'ppl'], root: false }),
    ).toEqual({ kind: 'folders', folderIds: ['ul', 'ppl'], root: false });
    expect(
      normalizeRoutineFolderContext({ kind: 'folders', folderIds: ['ul'], root: true }),
    ).toEqual({ kind: 'folders', folderIds: ['ul'], root: true });
  });

  it('reads the root alone as a selection, and a missing root flag as false', () => {
    expect(normalizeRoutineFolderContext({ kind: 'folders', folderIds: [], root: true })).toEqual({
      kind: 'folders',
      folderIds: [],
      root: true,
    });
    expect(normalizeRoutineFolderContext({ kind: 'folders', folderIds: ['ul'] })).toEqual({
      kind: 'folders',
      folderIds: ['ul'],
      root: false,
    });
  });

  it('lists a folder once, however many times the file says it', () => {
    expect(
      normalizeRoutineFolderContext({ kind: 'folders', folderIds: ['ul', 'ppl', 'ul'], root: false }),
    ).toEqual({ kind: 'folders', folderIds: ['ul', 'ppl'], root: false });
  });

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a string', 'root'],
    ['an array', ['root']],
    ['an unknown kind', { kind: 'all' }],
    ['a folder without id', { kind: 'folder', folderId: '' }],
    ['a folder with a non-string id', { kind: 'folder', folderId: 3 }],
    ['an empty selection', { kind: 'folders', folderIds: [], root: false }],
    ['a selection without a list', { kind: 'folders', root: true }],
    ['a selection whose ids are not a list', { kind: 'folders', folderIds: 'ul', root: false }],
    ['a selection with an empty id', { kind: 'folders', folderIds: ['ul', ''], root: false }],
    ['a selection with a non-string id', { kind: 'folders', folderIds: ['ul', 2], root: false }],
    ['a selection whose root flag is not a boolean', { kind: 'folders', folderIds: ['ul'], root: 1 }],
  ])('treats %s as no choice at all', (_label, value) => {
    expect(normalizeRoutineFolderContext(value)).toBeNull();
  });
});

describe('routineContextValues', () => {
  it('selects nothing when no choice was made', () => {
    expect(routineContextValues(null)).toEqual([]);
  });

  it('names what each shape selects, in the vocabulary of the picker', () => {
    expect(routineContextValues({ kind: 'root' })).toEqual(['root']);
    expect(routineContextValues({ kind: 'folder', folderId: 'ul' })).toEqual(['folder:ul']);
    expect(
      routineContextValues({ kind: 'folders', folderIds: ['ul', 'ppl'], root: true }),
    ).toEqual(['folder:ul', 'folder:ppl', 'root']);
  });
});

describe('routineContextFromValues', () => {
  it('has nothing to persist for an empty selection', () => {
    expect(routineContextFromValues([])).toBeNull();
  });

  it('keeps writing the historical shape for a single choice', () => {
    expect(routineContextFromValues(['root'])).toEqual({ kind: 'root' });
    expect(routineContextFromValues(['folder:ul'])).toEqual({ kind: 'folder', folderId: 'ul' });
  });

  it('writes a selection as soon as there are several', () => {
    expect(routineContextFromValues(['folder:ul', 'folder:ppl'])).toEqual({
      kind: 'folders',
      folderIds: ['ul', 'ppl'],
      root: false,
    });
    expect(routineContextFromValues(['root', 'folder:ul'])).toEqual({
      kind: 'folders',
      folderIds: ['ul'],
      root: true,
    });
  });

  it('counts a value once', () => {
    expect(routineContextFromValues(['folder:ul', 'folder:ul'])).toEqual({
      kind: 'folder',
      folderId: 'ul',
    });
  });

  it('keeps a folder id whole even when it contains the separator', () => {
    expect(routineContextFromValues(['folder:a:b'])).toEqual({ kind: 'folder', folderId: 'a:b' });
  });

  it('reads back what it wrote', () => {
    for (const values of [
      ['root'],
      ['folder:ul'],
      ['folder:ul', 'folder:ppl'],
      ['folder:ul', 'root'],
    ] as const) {
      expect(routineContextValues(routineContextFromValues(values))).toEqual([...values]);
    }
  });
});
