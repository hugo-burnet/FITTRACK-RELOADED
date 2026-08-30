import { describe, expect, it } from 'vitest';
import { MILESTONE_ART_KEYS } from '@/lib/milestones/art';
import { captionForArt } from './artCaption';

describe('la légende d’un jeton', () => {
  it('donne une phrase française à chaque illustration', () => {
    for (const key of MILESTONE_ART_KEYS) {
      const caption = captionForArt(key);
      expect(caption, key).not.toBe(`milestone.art.${key}`);
      expect(caption, key).not.toBe('');
    }
  });

  it('explique git gud sans trophée', () => {
    expect(captionForArt('git-gud')).toBe('Tu es mort. Tu recommences.');
  });
});
