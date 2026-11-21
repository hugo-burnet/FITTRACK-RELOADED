/**
 * Les points d'une mini-courbe de tuile `G` (DESIGN.md › « Grille modulaire »). Calcul pur, à part du
 * composant : la mini-courbe ne doit jamais tirer le module de graphiques dans le chunk d'une page d'objet.
 */
export type SparkPoint = { x: number; y: number };

/** Marge haute : un trait de 2 px posé sur le bord serait rogné de moitié. */
const INSET = 2;

/**
 * Jour laissé entre le point le plus bas et la base (tracée à `height - 1`) : collé à elle, le minimum
 * d'une série se lit comme un zéro, alors que la courbe n'a pas d'axe pour dire d'où elle part.
 */
const BASE_GAP = 8;

type Options = {
  /** Le dernier point est une période pas finie : il ne fixe ni le bas ni le haut de l'échelle. */
  partialLast?: boolean;
};

export function sparklinePoints(
  values: readonly number[],
  width: number,
  height: number,
  { partialLast = false }: Options = {},
): SparkPoint[] {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length < 2) return [];

  // Une semaine en cours est presque toujours le minimum : l'échelle qui l'inclurait ferait plonger le
  // dernier segment jusqu'à la base chaque semaine. L'échelle se prend donc sur les points complets.
  const complete = partialLast && finite.length > 2 ? finite.slice(0, -1) : finite;
  const low = Math.min(...complete);
  const high = Math.max(...complete);
  const span = high - low;
  const usable = height - 1 - BASE_GAP - INSET;
  const step = width / (finite.length - 1);

  return finite.map((value, index) => {
    // Le point partiel est borné à la fourchette des points complets, donc à la zone, jamais sous elle.
    const bounded = Math.min(high, Math.max(low, value));
    return {
      x: Math.round(index * step * 100) / 100,
      // Une série plate se pose au milieu : collée à la base, elle se lirait comme un zéro.
      y:
        span === 0
          ? height / 2
          : Math.round((INSET + (1 - (bounded - low) / span) * usable) * 100) / 100,
    };
  });
}
