import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WikiArticle, WikiArticleBlock } from './articleTypes';
import { ArticleBody } from './ArticleBody';

function block(
  blockId: string,
  text: string,
  options: Partial<Pick<WikiArticleBlock, 'claimIds' | 'rowIds' | 'editorial'>> = {},
): WikiArticleBlock {
  return {
    blockId,
    text,
    claimIds: options.claimIds ?? [],
    rowIds: options.rowIds ?? [],
    editorial: options.editorial ?? false,
    muscleRoles: [],
  };
}

const article: WikiArticle = {
  articleId: 'article-test',
  title: 'Article test',
  summary: 'Résumé test',
  family: 'programming',
  order: 1,
  muscleGroups: [],
  movementPatterns: [],
  exerciseSlugs: [],
  reviewState: 'pending_human_review',
  sections: [
    {
      sectionId: 'section-test',
      title: 'Résumé',
      blocks: [
        block('fact-a', 'Première affirmation.', { claimIds: ['claim.test.a'] }),
        block('fact-b', 'Deuxième affirmation.', { claimIds: ['claim.test.b'] }),
        block('editorial', 'Transition éditoriale.', { editorial: true }),
        block('row-head', '**Affirmation principale** : Ligne de test.', {
          rowIds: ['row.test'],
        }),
        block('row-confidence', '**Confiance** : Élevée.', { rowIds: ['row.test'] }),
      ],
    },
  ],
};

describe('ArticleBody', () => {
  it('garde chaque provenance dans un disclosure fermé par défaut', () => {
    render(<ArticleBody article={article} />);

    const sourceLabels = screen.getAllByText('Sources');
    expect(sourceLabels).toHaveLength(3);
    for (const label of sourceLabels) {
      expect(label.closest('details')).not.toHaveAttribute('open');
    }
    expect(screen.getByText('claim.test.a')).toBeInTheDocument();
    expect(screen.getByText('claim.test.b')).toBeInTheDocument();
    expect(screen.getByText('row.test')).toBeInTheDocument();
  });

  it('regroupe les contenus factuels consécutifs sans avaler la prose éditoriale', () => {
    const { container } = render(<ArticleBody article={article} />);

    expect(container.querySelectorAll('[data-article-evidence-group]')).toHaveLength(2);
    expect(
      screen.getByText('Transition éditoriale.').closest('[data-article-evidence-group]'),
    ).toBeNull();
  });
});
