import { describe, expect, it } from 'vitest';
import { CUES, clipsFor, type CueId } from './cues';

describe('ducking des annonces', () => {
  it('laisse la musique intacte uniquement pour les mots prononcés pendant la série', () => {
    const duringSet = new Set<CueId>(['rep-3', 'rep-2', 'rep-1']);

    for (const cue of Object.keys(CUES) as CueId[]) {
      if (clipsFor(cue).length === 0) continue;
      expect(CUES[cue].duckMusic, cue).toBe(!duringSet.has(cue));
    }
  });
});
