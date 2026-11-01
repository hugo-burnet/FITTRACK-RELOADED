import type { CueId } from './cues';
import type { ToneId } from './tones';

/** Les trois annonces d'une série validée (`setValidationCue`). */
const SET_VALIDATION = new Set<CueId>(['set-validated', 'last-set-ahead', 'exercise-cleared']);

/**
 * Le ton d'une annonce, selon le thème.
 *
 * Partout, une série validée sonne du plus discret des sons de l'app. Dans le thème Cyber, elle sonne
 * l'impact de la cadence — à **chaque** validation (« je voudrais entendre le bruit à chaque
 * validation »). Or deux de ses trois annonces ont un délai de 20 s pendant lequel leur plan est muet :
 * l'impact ne peut donc pas passer par elles. Il est joué à part (`announceSetValidation`) et leur
 * ton est retiré ici, pour ne pas sonner deux fois ; leur voix, elle, suit toujours ses règles.
 */
export function skinTone(
  cue: CueId,
  tone: ToneId | null,
  theme: string | null = document.documentElement.getAttribute('data-theme'),
): ToneId | null {
  if (tone === null) return null;
  return theme === 'cyber' && SET_VALIDATION.has(cue) ? null : tone;
}
