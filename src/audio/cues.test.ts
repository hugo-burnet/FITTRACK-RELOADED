import { describe, expect, it } from 'vitest';
import { CUES, clipsFor, type CueId } from './cues';
import { HOLD_MARK_SECONDS, holdMarkCue } from './holdMarks';

describe('ducking des annonces', () => {
  it('laisse la musique intacte uniquement pour les mots prononcés pendant la série', () => {
    // Les repères du chrono tombent pendant le maintien, exactement comme les
    // trois derniers battements tombent sous la barre : baisser la musique
    // trente-six fois en trois minutes la hacherait. Le changement de côté, lui,
    // arrive entre les deux côtés — c'est une annonce, et elle a droit au silence.
    const duringSet = new Set<CueId>([
      'rep-3',
      'rep-2',
      'rep-1',
      ...HOLD_MARK_SECONDS.map(holdMarkCue),
    ]);

    for (const cue of Object.keys(CUES) as CueId[]) {
      if (clipsFor(cue).length === 0) continue;
      expect(CUES[cue].duckMusic, cue).toBe(!duringSet.has(cue));
    }
  });
});
