/**
 * Les points d'une mini-courbe de tuile `G` (DESIGN.md › « Grille modulaire »). Calcul pur, à part du
 * composant : la mini-courbe ne doit jamais tirer le module de graphiques dans le chunk d'une page d'objet.
 */
export type SparkPoint = { x: number; y: number };

/** Marge haute et basse : un trait de 2 px posé sur le bord serait rogné de moitié. */
const INSET = 2;

export function sparklinePoints(
  values: readonly number[],
  width: number,
  height: number,
): SparkPoint[] {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length < 2) return [];

  const low = Math.min(...finite);
  const high = Math.max(...finite);
  const span = high - low;
  const usable = height - 2 * INSET;
  const step = width / (finite.length - 1);

  return finite.map((value, index) => ({
    x: Math.round(index * step * 100) / 100,
    // Une série plate se pose au milieu : collée à la base, elle se lirait comme un zéro.
    y:
      span === 0
        ? height / 2
        : Math.round((INSET + (1 - (value - low) / span) * usable) * 100) / 100,
  }));
}
