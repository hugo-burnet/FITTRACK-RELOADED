import type { CueId } from './cues';
import type { ToneId } from './tones';

/**
 * Le son d'une série validée, selon le thème.
 *
 * Partout, c'est le plus discret des sons de l'app : il revient trente fois par séance. Le thème
 * Cyber le remplace par l'impact de la cadence (`repTap`, `public/audio/rep-impact.wav`) — décision
 * de l'utilisateur pendant la maquette : la coche doit être percutante, et une répétition et une
 * série ont désormais le même coup. Seul ce cue change ; le reste du plan (silence, voix seule)
 * décide toujours s'il y a un son.
 */
export function skinTone(
  cue: CueId,
  tone: ToneId | null,
  theme: string | null = document.documentElement.getAttribute('data-theme'),
): ToneId | null {
  if (tone === null) return null;
  return theme === 'cyber' && cue === 'set-validated' ? 'repTap' : tone;
}
