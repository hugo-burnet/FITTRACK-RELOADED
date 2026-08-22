/**
 * Le temps réellement tenu, compté depuis la coche.
 *
 * **On tape après avoir relâché.** La main quitte la barre ou le sol, puis va
 * chercher l'écran : entre la fin de l'effort et le geste, il s'écoule toujours
 * un peu de temps. Sans cette correction, chaque maintien serait sur-noté des
 * mêmes deux secondes, à chaque série, pour toujours — une dérive silencieuse
 * qui finirait dans les records de durée et dans les courbes, sans que rien à
 * l'écran ne permette de la soupçonner.
 *
 * Deux secondes, constante nommée : c'est un nombre qu'on règle une fois. Un
 * écran de réglage pour ça coûterait plus cher à comprendre qu'à corriger ici
 * si la salle dit autre chose.
 */
export const HOLD_RELEASE_SECONDS = 2;

export function heldSecondsAt(startedAt: number, tappedAt: number): number {
  const elapsed = Math.round((tappedAt - startedAt) / 1_000);
  return Math.max(0, elapsed - HOLD_RELEASE_SECONDS);
}
