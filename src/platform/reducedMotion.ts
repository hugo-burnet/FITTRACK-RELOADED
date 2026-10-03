/**
 * Le choix « réduire les animations » du système, lu une fois.
 *
 * `matchMedia` est sondé plutôt que supposé : jsdom ne l'implémente pas, et un appel non gardé ferait
 * échouer tout test qui monte un écran pour une ligne qui ne parle que de mouvement. La feuille de
 * style a sa propre règle ; celle-ci sert à ce que le CSS ne sait pas faire — décider quelles
 * lignes existent, ou combien de temps un écran reste.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
