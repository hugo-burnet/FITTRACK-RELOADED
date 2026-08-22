import { describe, expect, it } from 'vitest';
import { CUES, clipsFor } from './cues';
import { HOLD_MARK_LIMIT_SECONDS, HOLD_MARK_SECONDS, holdMarkCue } from './holdMarks';

describe('HOLD_MARK_SECONDS', () => {
  it('compte trente-six repères, de cinq en cinq, de 5 s à 3 min', () => {
    expect(HOLD_MARK_SECONDS).toHaveLength(36);
    expect(HOLD_MARK_SECONDS[0]).toBe(5);
    expect(HOLD_MARK_LIMIT_SECONDS).toBe(180);
    expect([...HOLD_MARK_SECONDS]).toEqual(
      Array.from({ length: 36 }, (_, index) => (index + 1) * 5),
    );
  });

  it('nomme le cue d’un repère par ses secondes', () => {
    expect(holdMarkCue(45)).toBe('hold-45');
    expect(holdMarkCue(180)).toBe('hold-180');
  });
});

describe('les cues des repères', () => {
  it('sont tous définis, avec une tonalité et sans musique baissée', () => {
    for (const seconds of HOLD_MARK_SECONDS) {
      const definition = CUES[holdMarkCue(seconds)];
      expect(definition).toBeDefined();
      expect(definition.tone).toBe('repTap');
      expect(definition.duckMusic).toBe(false);
    }
  });

  // Le lot ne génère aucune voix : un identifiant déclaré sans MP3 derrière lui
  // est un silence qui se fait passer pour une phrase.
  it('n’ont encore aucun clip, donc aucune voix', () => {
    for (const seconds of HOLD_MARK_SECONDS) {
      expect(clipsFor(holdMarkCue(seconds))).toHaveLength(0);
    }
  });
});
