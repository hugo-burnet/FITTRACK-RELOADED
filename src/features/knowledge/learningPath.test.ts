import { beforeEach, describe, expect, it } from 'vitest';
import { findArticle } from './articleCatalogue';
import {
  LEARNING_PATH,
  LEARNING_PATH_STORAGE_KEY,
  loadReadSteps,
  resolveLearningPath,
  saveReadSteps,
} from './learningPath';

describe('learningPath', () => {
  beforeEach(() => localStorage.clear());

  it('ne pointe que vers des articles qui existent', () => {
    // Une étape qui mène nulle part est pire qu'une étape absente : elle promet
    // une lecture et rend un écran « article introuvable ».
    const missing = LEARNING_PATH.filter((step) => findArticle(step.articleId) === undefined);
    expect(missing).toEqual([]);
    expect(resolveLearningPath()).toHaveLength(LEARNING_PATH.length);
  });

  it('commence par la progression et finit par les limites', () => {
    // L'ordre est la seule chose que ce module apporte. S'il se met à suivre
    // l'ordre du document source, le parcours n'a plus de raison d'être.
    expect(LEARNING_PATH[0]?.articleId).toBe('programming-progression');
    expect(LEARNING_PATH.at(-1)?.articleId).toBe('method-limits-governance');
  });

  it('fait lire les signaux d’alerte avant les contradictions', () => {
    const ids = LEARNING_PATH.map((step) => step.articleId);
    expect(ids.indexOf('clinical-red-flags')).toBeLessThan(
      ids.indexOf('programming-contradictions'),
    );
  });

  it('ne répète aucune étape et justifie chacune', () => {
    const ids = LEARNING_PATH.map((step) => step.articleId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(LEARNING_PATH.every((step) => step.reason.trim().length > 20)).toBe(true);
  });

  it('mémorise les étapes lues et les relit', () => {
    saveReadSteps(new Set(['programming-volume']));

    expect([...loadReadSteps()]).toEqual(['programming-volume']);
    expect(localStorage.getItem(LEARNING_PATH_STORAGE_KEY)).toBe('["programming-volume"]');
  });

  it('survit à un stockage illisible plutôt que de faire échouer l’écran', () => {
    localStorage.setItem(LEARNING_PATH_STORAGE_KEY, '{pas du json');

    expect(loadReadSteps().size).toBe(0);
  });

  it('ignore une entrée mémorisée qui n’est pas une liste de chaînes', () => {
    localStorage.setItem(LEARNING_PATH_STORAGE_KEY, '{"volume":true}');

    expect(loadReadSteps().size).toBe(0);
  });
});
