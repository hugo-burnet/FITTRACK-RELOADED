import { describe, expect, it } from 'vitest';
import { formatElapsed } from './elapsed';

describe('formatElapsed', () => {
  it('démarre à zéro et compte les secondes', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(9)).toBe('0:09');
    expect(formatElapsed(59)).toBe('0:59');
  });

  it('passe aux minutes sans perdre les secondes', () => {
    expect(formatElapsed(60)).toBe('1:00');
    expect(formatElapsed(90)).toBe('1:30');
    expect(formatElapsed(3599)).toBe('59:59');
  });

  /** Une séance qui passe l'heure ne doit pas afficher « 61:00 ». */
  it('passe aux heures au bout d’une heure', () => {
    expect(formatElapsed(3600)).toBe('1:00:00');
    expect(formatElapsed(3661)).toBe('1:01:01');
    expect(formatElapsed(7200)).toBe('2:00:00');
  });

  /**
   * L'horloge du téléphone peut reculer (mise à l'heure réseau, changement
   * d'heure). Un chronomètre qui afficherait « -3:00 » ferait douter de la
   * séance entière, alors qu'il ne s'est rien passé.
   */
  it('ne descend jamais sous zéro', () => {
    expect(formatElapsed(-42)).toBe('0:00');
  });

  it('ne montre jamais de fraction de seconde', () => {
    expect(formatElapsed(59.9)).toBe('0:59');
  });
});
