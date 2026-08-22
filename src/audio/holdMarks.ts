/**
 * Les repères parlés d'un maintien : où on en est, toutes les cinq secondes.
 *
 * **Le temps écoulé, jamais un décompte.** Un gainage à l'usure n'a pas de
 * cible : il n'y a rien à décompter, et la seule question de celui qui tient
 * est « depuis combien de temps ». C'est aussi ce qui rend les repères
 * réutilisables d'une série prescrite à une série tenue jusqu'à la faute.
 *
 * **Trois minutes, et pas une seconde de plus.** Au-delà, le chrono continue à
 * l'écran et se tait : un repère annoncé sans clip enregistré derrière lui est
 * un silence qui se fait passer pour une phrase.
 *
 * Ce tableau est **la** source. Le type des cues en dérive, et `cues.ts` génère
 * les définitions depuis lui — trente-six lignes recopiées à la main finiraient
 * par diverger d'une seule.
 */
export const HOLD_MARK_SECONDS = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115,
  120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180,
] as const;

export type HoldMarkSeconds = (typeof HOLD_MARK_SECONDS)[number];

/** Un cue par repère : il faut jouer *le* bon nombre, pas un tirage au sort. */
export type HoldMarkCue = `hold-${HoldMarkSeconds}`;

/**
 * Le dernier repère annoncé. Le chrono continue muet ensuite.
 *
 * Un `max` et non le dernier indice : indexer un tuple par un calcul rend
 * `number | undefined` sous `noUncheckedIndexedAccess`, et le `?? 0` qu'il
 * faudrait écrire serait une valeur inventée pour un cas qui n'existe pas.
 */
export const HOLD_MARK_LIMIT_SECONDS: number = Math.max(...HOLD_MARK_SECONDS);

export function holdMarkCue(seconds: HoldMarkSeconds): HoldMarkCue {
  return `hold-${seconds}`;
}
