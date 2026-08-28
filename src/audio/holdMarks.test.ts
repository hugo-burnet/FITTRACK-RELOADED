import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import script from './voiceScript.json';
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
 *
 * **Le script entier, pas `allClips()`.** Ce dernier ne rend que les lignes dont
 * le `cue` existe dans `CUES` — la narration du tutoriel porte `cue: 'tutorial'`,
 * qui n'en est pas un, et passait donc à travers le contrôle. Dix clips sur
 * quatre-vingts n'étaient pas vérifiés, et les missions guidées seraient tombées
 * dans le même angle mort.
 *
 * **`pending` est la seule dérogation, et elle se referme toute seule.** Le
 * texte d'une consigne se relit et se corrige à l'écran ; l'enregistrer coûte
 * une génération payante, qu'on ne refait pas à chaque reformulation. Une ligne
 * marquée `pending` déclare donc une phrase écrite mais pas encore dite — le
 * lecteur retombe sur le texte, qui suffit. Le second test interdit qu'elle le
 * reste : dès que le MP3 existe, le drapeau doit disparaître, sans quoi il
 * deviendrait l'excuse permanente que ce fichier existe pour empêcher.
 */
const isPending = (line: { id: string }): boolean => 'pending' in line;
const hasClip = (id: string): boolean =>
  existsSync(join(process.cwd(), 'public', 'voice', `${id}.mp3`));

describe('le manifeste', () => {
  it('a un MP3 pour chaque identifiant déclaré et non différé', () => {
    const missing = script.lines
      .filter((line) => !isPending(line))
      .map((line) => line.id)
      .filter((clip) => !hasClip(clip));

    expect(missing, `clips déclarés sans MP3 : ${missing.join(', ')}`).toEqual([]);
  });

  it('ne laisse pas un clip différé alors qu’il a été enregistré', () => {
    const recorded = script.lines.filter(isPending).map((line) => line.id).filter(hasClip);

    expect(recorded, `clips à sortir de « pending » : ${recorded.join(', ')}`).toEqual([]);
  });

  /*
   * L'autre moitié de l'enquête sur la double annonce. Si le code n'émet qu'un
   * cue et qu'on entend deux fois « reprise dans dix secondes », la répétition
   * est dans l'artefact et pas dans la machine. Ce test épingle la source :
   * un seul clip pour ce cue, et une seule occurrence de la phrase dedans.
   *
   * Il ne peut pas écouter le MP3. C'est écrit dans PROGRESS.md, et la règle
   * qui va avec : on remplace le fichier, on ne supprime pas une annonce
   * légitime pour masquer un enregistrement fautif.
   */
  it('ne dit la reprise qu’une fois dans le texte du changement de côté', () => {
    const lines = script.lines.filter((line) => line.cue === 'side-change');

    expect(lines).toHaveLength(1);
    const text = lines[0]?.text.toLowerCase() ?? '';
    expect(text.split('reprise dans dix secondes')).toHaveLength(2);
  });

  it('couvre bien plus que les clips rattachés à un cue', () => {
    expect(script.lines.length).toBeGreaterThan(allClips().length);
  });
});
