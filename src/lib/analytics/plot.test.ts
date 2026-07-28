import { describe, expect, it } from 'vitest';
import { barLayout, plotBounds, plotPoints } from './plot';

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

describe('barLayout', () => {
  it('mesure une barre depuis zéro, pas depuis le minimum des données', () => {
    // La longueur d'une barre EST la quantité : 2 et 4 doivent faire du simple
    // au double, pas « la petite et la grande ».
    const bars = barLayout([2, 4], box, 4);
    expect(bars[1]!.height).toBe(box.height);
    expect(bars[0]!.height).toBe(box.height / 2);
  });

  it('honore un plafond supérieur au maximum réel, pour que le manque se voie', () => {
    // Objectif 5, semaines à 2 : les barres montent à deux cinquièmes. C'est ce
    // qui remplace une ligne de repère en pointillés.
    const bars = barLayout([2, 2], box, 5);
    expect(bars[0]!.height).toBeCloseTo(box.height * 0.4);
  });

  it('conserve la colonne d’une valeur nulle, avec une hauteur nulle', () => {
    const bars = barLayout([3, 0, 3], box, 3);
    expect(bars).toHaveLength(3);
    expect(bars[1]!.height).toBe(0);
    expect(bars[1]!.width).toBe(bars[0]!.width);
  });

  it('ne divise pas par zéro quand tout est à zéro', () => {
    for (const bar of barLayout([0, 0, 0], box, 1)) {
      expect(bar.height).toBe(0);
      expect(Number.isFinite(bar.y)).toBe(true);
    }
  });

  it('ne divise pas par zéro non plus sur un plafond nul', () => {
    for (const bar of barLayout([0, 0], box, 0)) {
      expect(Number.isFinite(bar.height)).toBe(true);
      expect(Number.isFinite(bar.y)).toBe(true);
    }
  });

  it('donne à une barre unique la largeur d’une colonne, pas toute la boîte', () => {
    const bar = barLayout([3], box, 3)[0]!;
    expect(bar.width).toBeLessThan(box.width);
    expect(bar.width).toBeGreaterThan(0);
  });

  it('ne rend rien sans valeur', () => {
    expect(barLayout([], box, 1)).toEqual([]);
  });

  it('range les colonnes dans la boîte, sans chevauchement', () => {
    const bars = barLayout([1, 2, 3, 4, 5], box, 5);
    bars.forEach((bar, index) => {
      expect(bar.x).toBeGreaterThanOrEqual(0);
      expect(bar.x + bar.width).toBeLessThanOrEqual(box.width + 0.001);
      expect(bar.y).toBeGreaterThanOrEqual(0);
      expect(bar.y + bar.height).toBeCloseTo(box.height);
      expect(bar.centerX).toBeCloseTo(bar.x + bar.width / 2);
      const previous = bars[index - 1];
      if (previous !== undefined) expect(bar.x).toBeGreaterThanOrEqual(previous.x + previous.width);
    });
  });
});
