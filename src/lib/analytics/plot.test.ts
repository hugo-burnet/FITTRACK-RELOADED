import { describe, expect, it } from 'vitest';
import { plotBounds, plotPoints } from './plot';

const box = { width: 300, height: 100 };

describe('plotBounds', () => {
  it('borne sur les données et non sur zéro', () => {
    // 80 → 85 sur un axe partant de zéro est une ligne plate, donc muette.
    expect(plotBounds([80, 82.5, 85])).toEqual({ min: 80, max: 85 });
  });

  it('ouvre une plage autour d’une valeur unique plutôt qu’un intervalle nul', () => {
    const { min, max } = plotBounds([100]);
    expect(max).toBeGreaterThan(min);
  });

  it('ouvre aussi la plage quand toutes les valeurs sont identiques', () => {
    const { min, max } = plotBounds([60, 60, 60]);
    expect(max).toBeGreaterThan(min);
  });
});

describe('plotPoints', () => {
  it('ne rend rien sans valeur', () => {
    expect(plotPoints([], box)).toEqual([]);
  });

  it('centre un point unique au lieu de diviser par zéro', () => {
    const point = plotPoints([100], box)[0]!;
    expect(point.x).toBe(150);
    expect(Number.isFinite(point.y)).toBe(true);
  });

  it('étale les points d’un bord à l’autre, dans l’ordre reçu', () => {
    const points = plotPoints([80, 90, 100], box);
    expect(points.map((point) => point.x)).toEqual([0, 150, 300]);
    // Le maximum est en haut : l’axe des y du SVG descend.
    expect(points[2]!.y).toBeLessThan(points[0]!.y);
  });

  it('pose une ligne horizontale centrée quand rien ne varie', () => {
    const points = plotPoints([60, 60, 60], box);
    expect(points.every((point) => point.y === points[0]!.y)).toBe(true);
    expect(points[0]!.y).toBe(50);
  });

  it('garde chaque point dans la boîte', () => {
    for (const point of plotPoints([12, 400, 3, 87], box)) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(box.width);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(box.height);
    }
  });
});
