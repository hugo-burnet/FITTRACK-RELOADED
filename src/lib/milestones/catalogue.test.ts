import { describe, expect, it } from 'vitest';
import catalogue from '@/data/seed/exercises.json';
import { t, type TranslationKey } from '@/i18n/fr';
import { MILESTONES, milestoneById } from './catalogue';

const SLUGS = new Set(catalogue.map((row) => row.slug));

/**
 * Le catalogue est une liste écrite à la main, donc une liste où l'on se
 * trompe : un slug renommé dans le seed, un sujet oublié, un identifiant copié
 * d'une ligne voisine. Aucune de ces trois fautes ne casse la compilation, et
 * aucune n'est visible avant le jour où un jalon ne tombe pas — c'est-à-dire
 * jamais, puisque personne ne remarque un événement qui n'arrive pas.
 *
 * Ce fichier ferme les trois classes d'un coup, sur la liste entière.
 */
describe('le catalogue des jalons', () => {
  it('ne nomme que des exercices qui existent dans le seed', () => {
    const unknown = MILESTONES.flatMap((definition) =>
      (definition.slugs ?? []).filter((slug) => !SLUGS.has(slug)),
    );
    expect(unknown).toEqual([]);
  });

  it('donne un identifiant unique à chaque jalon', () => {
    const ids = MILESTONES.map((definition) => definition.id);
    expect(ids).toHaveLength(new Set(ids).size);
  });

  it('donne un sujet traduit à chaque jalon qui nomme un exercice', () => {
    const named = MILESTONES.filter((definition) => definition.slugs !== undefined);
    expect(named.length).toBeGreaterThan(0);

    for (const definition of named) {
      const key = definition.subjectKey ?? '';
      // `t` rend la clé elle-même quand elle n'existe pas — c'est son contrat,
      // et c'est ce qui permet de vérifier le dictionnaire sans l'exporter.
      expect(t(key as TranslationKey), `sujet manquant pour ${definition.id}`).not.toBe(key);
    }
  });

  it('ne pose aucun sujet sur un jalon générique', () => {
    // La paire d'haltères et les jalons de pratique ne nomment aucun mouvement.
    // Leur donner un sujet ferait afficher un nom d'exercice là où la phrase
    // n'en attend pas, et la clé serait cherchée pour rien.
    const generic = MILESTONES.filter((definition) => definition.slugs === undefined);
    expect(generic.every((definition) => definition.subjectKey === undefined)).toBe(true);
  });

  it('classe chaque seuil dans l’ordre croissant à l’intérieur d’une famille', () => {
    // Deux paliers inversés ne cassent rien au moteur mais retournent l'écran
    // des jalons, où l'on lit une progression et non une liste.
    const families = new Map<string, number[]>();
    for (const definition of MILESTONES) {
      const family = `${definition.kind}:${(definition.slugs ?? []).join(',')}`;
      families.set(family, [...(families.get(family) ?? []), definition.threshold]);
    }

    for (const [family, thresholds] of families) {
      expect(thresholds, family).toEqual([...thresholds].sort((left, right) => left - right));
    }
  });

  it('reste court — la rareté est la fonctionnalité', () => {
    // Un plafond volontairement bas. Le jour où quelqu'un veut le franchir, il
    // devra retirer un jalon avant d'en ajouter un, ce qui est exactement la
    // conversation qu'on veut forcer.
    expect(MILESTONES.length).toBeLessThanOrEqual(60);
  });

  it('retrouve un jalon par son identifiant, et rend rien pour un retiré', () => {
    expect(milestoneById('bench-100')?.threshold).toBe(100);
    expect(milestoneById('jalon-qui-n-existe-plus')).toBeUndefined();
  });
});
