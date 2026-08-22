import { describe, expect, it } from 'vitest';
import { HOLD_RELEASE_SECONDS, heldSecondsAt } from './holdDuration';

describe('heldSecondsAt', () => {
  it('retire le temps de relâchement du temps écoulé', () => {
    expect(HOLD_RELEASE_SECONDS).toBe(2);
    expect(heldSecondsAt(0, 47_000)).toBe(45);
  });

  it('arrondit à la seconde la plus proche avant de corriger', () => {
    expect(heldSecondsAt(0, 47_400)).toBe(45);
    expect(heldSecondsAt(0, 47_600)).toBe(46);
  });

  // Une coche immédiate note zéro, jamais une durée négative : une série de
  // −2 s dans l'historique serait un chiffre que rien ne peut plus expliquer.
  it('ne descend jamais sous zéro', () => {
    expect(heldSecondsAt(0, 1_000)).toBe(0);
    expect(heldSecondsAt(0, 0)).toBe(0);
  });

  // Toucher la coche pendant la préparation, avant même le premier repère.
  it('note zéro quand la coche tombe avant le départ', () => {
    expect(heldSecondsAt(10_000, 4_000)).toBe(0);
  });
});
