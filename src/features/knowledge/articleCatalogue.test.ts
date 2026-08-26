import { describe, expect, it } from 'vitest';
import {
  articleHref,
  articlesForScope,
  filterArticles,
  findArticle,
  listArticleFamilies,
} from './articleCatalogue';

describe('articleCatalogue', () => {
  it('expose les six familles dans l’ordre du sommaire', () => {
    expect(listArticleFamilies().map((family) => family.id)).toEqual([
      'muscles',
      'movements',
      'exercise-choice',
      'programming',
      'clinical',
      'method',
    ]);
  });

  it('retrouve un article par identifiant, et rien pour un identifiant absent', () => {
    expect(findArticle('muscle-triceps')?.title).toBe('Triceps');
    expect(findArticle('missing')).toBeUndefined();
  });

  it('rattache un article par muscle, par mouvement et par slug', () => {
    expect(
      articlesForScope({ muscleGroups: ['triceps'] }).some(
        (article) => article.articleId === 'muscle-triceps',
      ),
    ).toBe(true);
    expect(
      articlesForScope({ movementPatterns: ['isolation_coude'] }).some(
        (article) => article.articleId === 'movement-elbow-isolation',
      ),
    ).toBe(true);
    expect(
      articlesForScope({ exerciseSlugs: ['skull-crusher'] }).some(
        (article) => article.articleId === 'exercise-triceps-extensions',
      ),
    ).toBe(true);
  });

  it('ne retourne rien pour une portée vide', () => {
    expect(articlesForScope({})).toEqual([]);
  });

  it('déduplique un article rattaché par deux portées à la fois', () => {
    const both = articlesForScope({
      muscleGroups: ['triceps'],
      movementPatterns: ['isolation_coude'],
    });
    const ids = both.map((article) => article.articleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('filtre à l’intérieur d’un ensemble déjà choisi, sans jamais l’élargir', () => {
    const triceps = findArticle('muscle-triceps');
    expect(triceps).toBeDefined();
    expect(filterArticles([triceps!], 'chef long')).toHaveLength(1);
    expect(filterArticles([triceps!], 'zirconium')).toEqual([]);
  });

  it('ignore les accents et la casse dans le filtre', () => {
    const triceps = findArticle('muscle-triceps');
    expect(filterArticles([triceps!], 'EPAULE')).toHaveLength(1);
  });

  it('envoie le Guide sous Planifier et les autres familles sous le wiki', () => {
    expect(articleHref(findArticle('programming-volume')!)).toBe(
      '/knowledge/programmation/programming-volume',
    );
    expect(articleHref(findArticle('muscle-triceps')!)).toBe('/knowledge/a/muscle-triceps');
  });

  it('conserve l’état non relu des articles de programmation', () => {
    const guide = listArticleFamilies().find((family) => family.id === 'programming');
    expect(guide?.articles.length).toBe(19);
    expect(guide?.articles.every((article) => article.reviewState === 'pending_human_review')).toBe(
      true,
    );
  });
});
