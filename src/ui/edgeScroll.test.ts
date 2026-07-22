import { describe, expect, it } from 'vitest';
import { EDGE_PX, EDGE_SPEED_PX, edgeScrollDelta } from './edgeScroll';

/** The scroll area of the app shell on a 812px phone. */
const BOX = { top: 0, bottom: 755 };

describe('edgeScrollDelta', () => {
  it('ne défile pas quand le doigt est loin des deux bords', () => {
    expect(edgeScrollDelta(BOX, 400)).toBe(0);
  });

  it('ne défile pas exactement sur le seuil', () => {
    expect(edgeScrollDelta(BOX, BOX.top + EDGE_PX)).toBe(0);
    expect(edgeScrollDelta(BOX, BOX.bottom - EDGE_PX)).toBe(0);
  });

  it('remonte la liste près du bord haut', () => {
    expect(edgeScrollDelta(BOX, 30)).toBeLessThan(0);
  });

  it('descend la liste près du bord bas', () => {
    expect(edgeScrollDelta(BOX, 740)).toBeGreaterThan(0);
  });

  it('accélère à mesure qu’on s’enfonce dans la zone', () => {
    const shallow = Math.abs(edgeScrollDelta(BOX, 60));
    const deep = Math.abs(edgeScrollDelta(BOX, 10));
    expect(deep).toBeGreaterThan(shallow);
  });

  /**
   * Un doigt traîné au-delà du haut de l'écran renvoie une coordonnée négative.
   * Sans la borne, la liste filerait de plus en plus vite à mesure qu'on sort de
   * l'écran — exactement quand on ne peut plus corriger.
   */
  it('plafonne la vitesse quand le doigt sort de l’écran', () => {
    expect(edgeScrollDelta(BOX, -500)).toBe(-EDGE_SPEED_PX);
    expect(edgeScrollDelta(BOX, 5000)).toBe(EDGE_SPEED_PX);
  });

  it('tient compte d’un conteneur qui ne commence pas à zéro', () => {
    const offset = { top: 200, bottom: 900 };
    expect(edgeScrollDelta(offset, 210)).toBeLessThan(0);
    expect(edgeScrollDelta(offset, 400)).toBe(0);
    expect(edgeScrollDelta(offset, 890)).toBeGreaterThan(0);
  });

  it('donne la priorité au haut sur un conteneur plus court que deux zones', () => {
    const short = { top: 0, bottom: 100 };
    expect(edgeScrollDelta(short, 50)).toBeLessThan(0);
  });
});
