import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CUES, allClips, clipsFor, textOf } from './cues';
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

  it('ont chacun exactement un clip, nommé d’après leur cue', () => {
    for (const seconds of HOLD_MARK_SECONDS) {
      expect(clipsFor(holdMarkCue(seconds))).toEqual([`hold-${seconds}-1`]);
    }
  });
});

describe('le cue du changement de côté', () => {
  it('sonne et porte sa phrase', () => {
    expect(CUES['side-change'].tone).toBe('chime');
    expect(clipsFor('side-change')).toEqual(['side-change-1']);
    expect(textOf('side-change-1')).toBe('Changement de côté. Reprise dans dix secondes.');
  });
});

/**
 * L'invariant que le dépôt tenait à la main dans `PROGRESS.md` — « le manifeste
 * reste complet à N identifiants / N MP3 » — et qu'un compte recopié de session
 * en session finit toujours par rater.
 *
 * **Un identifiant déclaré sans MP3 derrière lui est un silence qui se fait
 * passer pour une phrase.** Le lecteur de clips le traite proprement (il reste
 * muet et ne redemande pas), donc rien ne casse à l'écran : c'est exactement ce
 * qui rend l'écart indétectable sans ce test.
 */
describe('le manifeste', () => {
  it('a un MP3 pour chaque identifiant déclaré', () => {
    const missing = allClips().filter(
      (clip) => !existsSync(join(process.cwd(), 'public', 'voice', `${clip}.mp3`)),
    );

    expect(missing, `clips déclarés sans MP3 : ${missing.join(', ')}`).toEqual([]);
  });
});
