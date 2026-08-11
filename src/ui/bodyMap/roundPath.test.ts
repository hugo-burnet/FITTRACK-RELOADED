import { describe, expect, it } from 'vitest';
import { CORNER_RADIUS, roundPath } from './roundPath';
import { BACK_REGIONS, FRONT_REGIONS } from './vendorPaths';

/** The numeric pairs of a path, whatever the commands around them. */
const points = (d: string): [number, number][] => {
  const numbers = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) out.push([numbers[i]!, numbers[i + 1]!]);
  return out;
};

const bounds = (d: string) => {
  const all = points(d);
  return {
    minX: Math.min(...all.map(([x]) => x)),
    maxX: Math.max(...all.map(([x]) => x)),
    minY: Math.min(...all.map(([, y]) => y)),
    maxY: Math.max(...all.map(([, y]) => y)),
  };
};

describe('roundPath — ce qu’il refuse de toucher', () => {
  // Approximating a curve would invent a shape. Angular is a disappointment;
  // a forearm smoothed into a sausage is a bug.
  it('rend verbatim un tracé qui porte déjà une courbe', () => {
    const curved = 'm 1,1 2,2 c 1,1 2,2 3,3 z';
    expect(roundPath(curved)).toBe(curved);
  });

  it('rend verbatim un tracé avec un arc', () => {
    const arc = 'M 1,1 A 2,2 0 0 1 4,4 Z';
    expect(roundPath(arc)).toBe(arc);
  });

  it('rend verbatim ce qu’il ne sait pas lire', () => {
    expect(roundPath('rien du tout')).toBe('rien du tout');
    expect(roundPath('')).toBe('');
  });

  // Un triangle est souvent un doigt ou une phalange : l’arrondir coûte la forme.
  it('laisse un triangle en segments droits', () => {
    const rounded = roundPath('m 0,0 10,0 -5,10 z');
    expect(rounded).not.toContain('Q');
  });
});

describe('roundPath — ce qu’il produit', () => {
  const square = 'm 0,0 10,0 0,10 -10,0 z';

  it('arrondit chaque sommet d’un quadrilatère', () => {
    const rounded = roundPath(square);
    expect((rounded.match(/Q/g) ?? []).length).toBe(4);
  });

  // La quadratique passe par le sommet d’origine et reste dans le triangle du
  // coin : la forme arrondie ne sort jamais de la forme d’origine.
  it('ne déborde pas de la boîte englobante d’origine', () => {
    const before = bounds(square);
    const after = bounds(roundPath(square));

    expect(after.minX).toBeGreaterThanOrEqual(before.minX);
    expect(after.minY).toBeGreaterThanOrEqual(before.minY);
    expect(after.maxX).toBeLessThanOrEqual(before.maxX);
    expect(after.maxY).toBeLessThanOrEqual(before.maxY);
  });

  // Deux coins voisins sur une arête courte se mangeraient et se croiseraient.
  it('ne mord jamais plus d’un tiers de l’arête la plus courte', () => {
    const thin = 'm 0,0 0.3,0 0,10 -0.3,0 z';
    const rounded = roundPath(thin, 5);
    const xs = points(rounded).map(([x]) => x);

    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(0.3);
  });
});

describe('roundPath — sur la géométrie réellement embarquée', () => {
  const all = [...FRONT_REGIONS, ...BACK_REGIONS];

  it('traite la quasi-totalité des régions', () => {
    const changed = all.filter((region) => roundPath(region.path) !== region.path);
    // Les huit commandes de courbe du fichier concernent une poignée de tracés,
    // qui restent verbatim. Le reste doit passer.
    expect(changed.length).toBeGreaterThan(all.length * 0.9);
  });

  /**
   * La référence est `roundPath(d, 0)` et **pas** le tracé d’origine : celui-ci
   * est écrit en coordonnées relatives, donc lire ses nombres bruts donne des
   * deltas, pas des positions. À rayon nul la fonction rend le même polygone,
   * en absolu et sans rien couper — c’est la seule comparaison qui ait un sens.
   */
  it('garde chaque région dans sa boîte englobante', () => {
    for (const region of all) {
      const rounded = roundPath(region.path);
      if (rounded === region.path) continue;

      const before = bounds(roundPath(region.path, 0));
      const after = bounds(rounded);
      // Une tolérance d’un rayon : la boîte est lue sur les points de contrôle,
      // et un point de contrôle peut être le sommet d’origine lui-même.
      const slack = CORNER_RADIUS + 0.01;

      expect(after.minX, region.id).toBeGreaterThanOrEqual(before.minX - slack);
      expect(after.maxX, region.id).toBeLessThanOrEqual(before.maxX + slack);
      expect(after.minY, region.id).toBeGreaterThanOrEqual(before.minY - slack);
      expect(after.maxY, region.id).toBeLessThanOrEqual(before.maxY + slack);
    }
  });
});
