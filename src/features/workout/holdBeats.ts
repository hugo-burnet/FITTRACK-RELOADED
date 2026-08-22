import { announce } from '@/audio/announce';
import type { CueId } from '@/audio/cues';
import { HOLD_MARK_SECONDS, holdMarkCue } from '@/audio/holdMarks';

/**
 * Les repères d'un maintien : un toutes les cinq secondes, et rien d'autre.
 *
 * **Aucun battement de fin.** C'est toute la différence avec `repBeats` : une
 * série en répétitions sait combien de fois battre, donc elle sait quand elle
 * s'arrête. Un maintien ne le sait pas — il s'arrête quand celui qui tient n'en
 * peut plus, et c'est la coche qui le dit. Rien ici ne décide de la fin d'une
 * série, pas même une durée prescrite : la cible est un objectif, pas une
 * limite.
 *
 * **Dérivés d'un départ absolu, jamais accumulés.** Chaque repère est
 * `startedAt + n × 5 s` : un minuteur qui tire en retard coûte ce repère-là et
 * non l'alignement de tout le maintien. Même règle que la barre de repos et que
 * le métronome de répétitions.
 */
export interface HoldBeat {
  cue: CueId;
  /** Instant du repère, à l'horloge murale. */
  at: number;
}

export function holdBeats(startedAt: number): HoldBeat[] {
  return HOLD_MARK_SECONDS.map((seconds) => ({
    cue: holdMarkCue(seconds),
    at: startedAt + seconds * 1_000,
  }));
}

/**
 * Les repères encore devant. Un chrono armé en retard garde ceux qu'il peut
 * honorer ; les 150 ms de mou absorbent un minuteur qui tire d'un cheveu trop
 * tard — sans quoi le premier repère est celui qu'on perd, à chaque fois.
 */
export function pendingHoldBeats(beats: readonly HoldBeat[], now: number): HoldBeat[] {
  return beats.filter((beat) => beat.at >= now - 150);
}

/**
 * Arme les repères restants et rend l'annulation.
 *
 * Un minuteur par repère plutôt qu'un intervalle, pour la même raison que le
 * métronome : un intervalle qui dérive de 20 ms par tour est à 700 ms au
 * trente-sixième. Annuler les efface tous d'un coup — relâcher tôt ne doit pas
 * laisser un « quarante-cinq » en l'air.
 */
export function armHoldChrono(startedAt: number, now = Date.now()): () => void {
  const timers = pendingHoldBeats(holdBeats(startedAt), now).map((beat) =>
    setTimeout(() => announce(beat.cue), Math.max(0, beat.at - now)),
  );

  return () => {
    for (const timer of timers) clearTimeout(timer);
  };
}
