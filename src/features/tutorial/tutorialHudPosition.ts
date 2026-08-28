export interface VerticalRect {
  top: number;
  bottom: number;
}

export interface Viewport {
  height: number;
}

/**
 * De quel côté poser le panneau pour ne pas couvrir ce qu'il désigne.
 *
 * Le panneau était toujours en bas, sauf quand la cible était basse. Mesuré à
 * 390 × 844, il occupait jusqu'à 359 px — près de la moitié de l'écran — et une
 * cible dans cette moitié se retrouvait derrière la consigne qui en parle. La
 * règle est donc l'opposition, décidée sur le **centre** de la cible : un
 * bouton à cheval sur le milieu penche du côté où il a le plus de matière, et
 * non du côté de son bord haut.
 */
export function hudPlacement(target: VerticalRect | null, viewport: Viewport): 'top' | 'bottom' {
  if (target === null) return 'bottom';
  return (target.top + target.bottom) / 2 > viewport.height / 2 ? 'top' : 'bottom';
}
