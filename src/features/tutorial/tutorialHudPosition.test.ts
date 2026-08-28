import { describe, expect, it } from 'vitest';
import { hudPlacement } from './tutorialHudPosition';

describe('le placement du panneau de tutoriel', () => {
  it('se met à l’opposé de la cible', () => {
    expect(hudPlacement({ top: 620, bottom: 680 }, { height: 844 })).toBe('top');
    expect(hudPlacement({ top: 80, bottom: 140 }, { height: 844 })).toBe('bottom');
  });

  it('décide sur le centre de la cible, pas sur son bord haut', () => {
    // Un bouton haut de 96 px dont le bord haut est juste au-dessus du milieu :
    // il a l'essentiel de sa matière en bas, et le panneau doit monter.
    expect(hudPlacement({ top: 410, bottom: 506 }, { height: 844 })).toBe('top');
  });

  it('reste en bas quand il n’y a rien à désigner', () => {
    expect(hudPlacement(null, { height: 844 })).toBe('bottom');
  });
});
