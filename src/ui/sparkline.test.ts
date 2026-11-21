import { describe, expect, it } from 'vitest';
import { sparklinePoints } from './sparkline';

describe('sparklinePoints', () => {
  it('rend rien sous deux valeurs : une courbe a besoin de deux points', () => {
    expect(sparklinePoints([], 100, 64)).toEqual([]);
    expect(sparklinePoints([42], 100, 64)).toEqual([]);
  });

  it('étale les points sur toute la largeur, le plus haut en haut et le plus bas en bas', () => {
    expect(sparklinePoints([0, 10, 5], 100, 64)).toEqual([
      { x: 0, y: 62 },
      { x: 50, y: 2 },
      { x: 100, y: 32 },
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
      { x: 0, y: 62 },
      { x: 100, y: 2 },
    ]);
  });
});
