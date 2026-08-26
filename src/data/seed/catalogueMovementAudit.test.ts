import { describe, expect, it } from 'vitest';
import { MOVEMENT_PATTERNS } from '@/data/types';
import { movementPatternLabel } from '@/i18n/labels';
import catalogue from './exercises.json';

/**
 * L'audit du catalogue : chaque exercice livré porte une décision explicite.
 *
 * Le point du test n'est pas qu'une valeur soit *valide* — le typecheck s'en
 * charge — mais qu'aucune ligne ne soit **oubliée**. Un exercice sans propriété
 * ne se distingue pas d'un exercice qu'on n'a pas su classer, et c'est
 * exactement cette confusion qui laisserait la documentation muette sans que
 * personne ne s'en aperçoive.
 */
// La propriété est déclarée facultative *ici seulement*, pour que le test
// puisse constater son absence. Le JSON n'a pas de `undefined` : un champ
// absent est donc exactement une ligne oubliée par l'audit.
const rows = catalogue as { slug: string; movementPattern?: string | null }[];

describe('audit des familles de mouvement du catalogue', () => {
  it('énumère le vocabulaire fermé du contrat KB, dans son ordre', () => {
    expect([...MOVEMENT_PATTERNS]).toEqual([
      'poussee_horizontale',
      'poussee_verticale',
      'tirage_horizontal',
      'tirage_vertical',
      'squat',
      'hinge',
      'fente',
      'isolation_coude',
      'isolation_epaule',
      'isolation_genou',
      'isolation_hanche',
      'isolation_cheville',
      'isolation_poignet',
      'autre',
    ]);
  });

  it('donne un libellé français à chacune des quatorze familles', () => {
    for (const pattern of MOVEMENT_PATTERNS) {
      const label = movementPatternLabel(pattern);
      expect(label, pattern).not.toBe('');
      expect(label, pattern).not.toBe(`movementPattern.${pattern}`);
    }
  });

  it('décide explicitement pour chacun des exercices livrés', () => {
    const undecided = rows
      .filter((row) => row.movementPattern === undefined)
      .map((row) => row.slug);
    expect(undecided).toEqual([]);
  });

  it('n’emploie que le vocabulaire fermé, ou null', () => {
    const invalid = rows
      .filter(
        (row) =>
          typeof row.movementPattern === 'string' &&
          !(MOVEMENT_PATTERNS as readonly string[]).includes(row.movementPattern),
      )
      .map((row) => row.slug);
    expect(invalid).toEqual([]);
  });

  it('réserve null aux mouvements auxquels la notion ne s’applique pas', () => {
    // Cardio, étirements et mobilité. Si un exercice de résistance devait
    // atterrir ici, c'est la décision qu'il faudrait rouvrir, pas le test.
    const unclassified = rows.filter((row) => row.movementPattern === null).map((row) => row.slug);
    expect(unclassified).toEqual([
      'treadmill-run',
      'outdoor-run',
      'rowing-machine',
      'stationary-bike',
      'elliptical',
      'stair-climber',
      'ski-erg',
      'assault-bike',
      'jump-rope',
      'stretching-session',
      'mobility-session',
      'foam-rolling',
    ]);
  });
});
