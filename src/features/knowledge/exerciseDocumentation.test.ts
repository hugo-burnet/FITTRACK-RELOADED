import { describe, expect, it } from 'vitest';
import {
  getDocumentationForExercise,
  type DocumentationExercise,
} from './exerciseDocumentation';

const pushdown: DocumentationExercise = {
  primaryMuscle: 'triceps',
  secondaryMuscles: ['shoulders'],
  movementPattern: 'isolation_coude',
  slug: 'cable-triceps-pushdown-rope',
};

describe('getDocumentationForExercise', () => {
  it('ordonne muscle principal, mouvement, article propre à l’exercice, puis secondaires', () => {
    expect(getDocumentationForExercise(pushdown).articleIds).toEqual([
      'muscle-triceps',
      'movement-elbow-isolation',
      'exercise-triceps-extensions',
      'muscle-shoulders',
    ]);
  });

  it('n’invente aucune relation quand l’exercice personnel n’a pas de famille', () => {
    const custom: DocumentationExercise = {
      primaryMuscle: 'triceps',
      secondaryMuscles: ['shoulders'],
    };
    const documentation = getDocumentationForExercise(custom);

    expect(documentation.relationship).toBeNull();
    expect(documentation.articleIds).toEqual(['muscle-triceps', 'muscle-shoulders']);
    expect(documentation.limitations).toContain('movement_pattern_missing');
  });

  it('ajoute l’article relationnel dès qu’une famille est déclarée', () => {
    const custom: DocumentationExercise = {
      primaryMuscle: 'triceps',
      secondaryMuscles: ['shoulders'],
      movementPattern: 'isolation_coude',
    };
    const documentation = getDocumentationForExercise(custom);

    expect(documentation.relationship?.articleId).toBe('movement-elbow-isolation');
    expect(documentation.limitations).not.toContain('movement_pattern_missing');
  });

  it('ne dépend pas du nom : un renommage ne change rien', () => {
    const renamed = { ...pushdown, name: 'Extension triceps de ma salle' };

    expect(getDocumentationForExercise(renamed)).toEqual(getDocumentationForExercise(pushdown));
  });

  it('n’explique un secondaire que si un bloc sourcé porte son rôle', () => {
    // Le triceps est balisé dans l'article d'isolation du coude ; le mollet ne
    // l'est nulle part. Sans balise, on donne le lien vers la fiche et on
    // n'invente aucune relation mécanique.
    const documented = getDocumentationForExercise({
      primaryMuscle: 'biceps',
      secondaryMuscles: ['forearms'],
      movementPattern: 'isolation_coude',
    });
    const forearms = documented.secondary.find((item) => item.muscle === 'forearms');
    expect(forearms?.roleText).toBeTruthy();

    const undocumented = getDocumentationForExercise({
      primaryMuscle: 'biceps',
      secondaryMuscles: ['calves'],
      movementPattern: 'isolation_coude',
    });
    const calves = undocumented.secondary.find((item) => item.muscle === 'calves');
    expect(calves?.roleText).toBeNull();
    expect(calves?.article?.articleId).toBe('muscle-calves');
  });

  it('déduplique un article rattaché deux fois, sans jamais dédupliquer par titre', () => {
    // Le muscle principal et un secondaire peuvent mener au même article : le
    // corpus traite les rhomboïdes à l'intérieur du dos.
    const documentation = getDocumentationForExercise({
      primaryMuscle: 'triceps',
      secondaryMuscles: ['triceps', 'shoulders'],
      movementPattern: 'isolation_coude',
    });

    expect(documentation.articleIds).toEqual([
      'muscle-triceps',
      'movement-elbow-isolation',
      'muscle-shoulders',
    ]);
    expect(new Set(documentation.articleIds).size).toBe(documentation.articleIds.length);
  });

  it('ne rattache aucun article propre à un exercice sans slug', () => {
    const custom: DocumentationExercise = {
      primaryMuscle: 'triceps',
      secondaryMuscles: [],
      movementPattern: 'isolation_coude',
    };

    expect(getDocumentationForExercise(custom).specific).toEqual([]);
  });

  it('signale une famille déclarée qu’aucun article ne documente', () => {
    // `autre` est du vocabulaire contrôlé, et aucun article ne le porte : la
    // lacune s'affiche au lieu de se transformer en silence.
    const documentation = getDocumentationForExercise({
      primaryMuscle: 'abs',
      secondaryMuscles: [],
      movementPattern: 'autre',
    });

    expect(documentation.relationship).toBeNull();
    expect(documentation.limitations).toContain('movement_article_missing');
  });
});
