import { describe, expect, it } from 'vitest';
import { sparklinePoints } from './sparkline';

describe('sparklinePoints', () => {
  it('rend rien sous deux valeurs : une courbe a besoin de deux points', () => {
    expect(sparklinePoints([], 100, 64)).toEqual([]);
    expect(sparklinePoints([42], 100, 64)).toEqual([]);
  });

  it('étale les points sur toute la largeur, le plus haut en haut et le plus bas en bas', () => {
    expect(sparklinePoints([0, 10, 5], 100, 64)).toEqual([
      { x: 0, y: 55 },
      { x: 50, y: 2 },
      { x: 100, y: 28.5 },
    ]);
  });

  it('pose une série plate au milieu, plutôt que collée à la base', () => {
    expect(sparklinePoints([80, 80, 80], 100, 64)).toEqual([
      { x: 0, y: 32 },
      { x: 50, y: 32 },
      { x: 100, y: 32 },
    ]);
  });

  it('ignore une valeur non finie au lieu de dessiner un trou ou un NaN', () => {
    expect(sparklinePoints([0, Number.NaN, 10], 100, 64)).toEqual([
      { x: 0, y: 55 },
      { x: 100, y: 2 },
    ]);
  });

  it('laisse la courbe au-dessus de la base : le point le plus bas ne se lit pas comme un zéro', () => {
    const lowest = Math.max(...sparklinePoints([3, 9, 6], 100, 64).map((point) => point.y));
    // La base est tracée à y = 63 : au moins 6 px de jour entre elle et le trait.
    expect(63 - lowest).toBeGreaterThanOrEqual(6);
  });

  describe('avec un dernier point partiel (la semaine en cours)', () => {
    it('met la courbe à l’échelle des points complets seulement', () => {
      const [first, second] = sparklinePoints([4, 8, 1], 100, 64, { partialLast: true });
      // 4 est le bas et 8 le haut des semaines finies : la semaine partielle ne les déplace pas.
      expect(first).toEqual({ x: 0, y: 55 });
      expect(second).toEqual({ x: 50, y: 2 });
    });

    it('borne le point partiel au bas de la zone, jamais sur la base', () => {
      const points = sparklinePoints([4, 8, 1], 100, 64, { partialLast: true });
      expect(points[2]).toEqual({ x: 100, y: 55 });
      expect(63 - points[2]!.y).toBeGreaterThanOrEqual(6);
    });

    it('borne aussi un point partiel plus haut que tout le reste', () => {
      const points = sparklinePoints([4, 8, 20], 100, 64, { partialLast: true });
      expect(points[2]).toEqual({ x: 100, y: 2 });
    });

    it('garde un point partiel dans la fourchette à sa vraie place', () => {
      const points = sparklinePoints([4, 8, 6], 100, 64, { partialLast: true });
      expect(points[2]).toEqual({ x: 100, y: 28.5 });
    });

    it('pose des semaines finies plates au milieu, partiel compris', () => {
      const points = sparklinePoints([5, 5, 1], 100, 64, { partialLast: true });
      expect(points.map((point) => point.y)).toEqual([32, 32, 32]);
    });
  });
});
