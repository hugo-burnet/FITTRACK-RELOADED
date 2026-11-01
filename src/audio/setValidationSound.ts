import { announce } from './announce';
import type { CueId } from './cues';
import { playSetImpact } from './screenGlitch';

/**
 * Ce que l'app fait entendre d'une série validée : l'annonce (son ton et sa voix, selon les règles du
 * planificateur) et, dans le thème Cyber, l'impact — à chaque validation, sans délai ni priorité,
 * puisque c'est la réponse à un geste et non une annonce. `skinTone` retire alors le ton de l'annonce
 * pour que rien ne sonne deux fois.
 */
export function announceSetValidation(cue: CueId): void {
  announce(cue);
  if (document.documentElement.getAttribute('data-theme') === 'cyber') playSetImpact();
}
