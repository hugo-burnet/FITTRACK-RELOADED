import { t } from '@/i18n/fr';
import type { WikiArticle, WikiArticleBlock } from './articleTypes';
import { stripEmphasis } from './markdownText';

/** Le bandeau qui dit que la matière n'a pas été relue. Il ne se ferme pas. */
export function UnreviewedNotice({ article }: { article: WikiArticle }) {
  if (article.reviewState !== 'pending_human_review') return null;
  return (
    <section className="rounded-2xl border border-[var(--border)] p-5">
      <p className="label-xs font-semibold text-[var(--text-2)]">
        {t('knowledge.article.unreviewedLabel')}
      </p>
      <p className="mt-3 text-sm leading-6 text-[var(--text-2)]">
        {t('knowledge.article.unreviewedBody')}
      </p>
    </section>
  );
}

function Block({ block }: { block: WikiArticleBlock }) {
  // Un bloc éditorial n'affirme rien : il n'a donc pas le rail du témoin, qui
  // sur tous les autres écrans veut dire « ce texte vient d'une source ». Lui
  // en donner un ferait mentir un signe visuel déjà installé.
  if (block.editorial) {
    return <p className="px-1 text-base leading-7 text-[var(--text-2)]">{block.text}</p>;
  }

  const sources = [...block.claimIds, ...block.rowIds];
  return (
    <article className="relative overflow-hidden rounded-2xl bg-[var(--surface-1)] pl-1">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[var(--accent-ink)]" />
      <div className="p-5">
        <p className="text-base leading-7 text-[var(--text-1)]">{stripEmphasis(block.text)}</p>
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <p className="label-xs font-semibold text-[var(--text-2)]">
            {t('knowledge.article.sourcesLabel')}
          </p>
          <p className="record-figure mt-2 break-words text-xs leading-5 text-[var(--text-2)]">
            {sources.join(' · ')}
          </p>
        </div>
      </div>
    </article>
  );
}

/**
 * Le corps d'un article, partagé par la page de lecture et par la projection
 * Documentation d'un exercice. Les deux affichent la même chose : c'est le
 * chemin qui y mène qui diffère, pas le contenu.
 */
export function ArticleBody({ article }: { article: WikiArticle }) {
  return (
    <div className="space-y-7">
      <UnreviewedNotice article={article} />

      {article.sections.map((section) => (
        <section key={section.sectionId} aria-labelledby={section.sectionId} className="space-y-4">
          <h2
            id={section.sectionId}
            className="px-1 text-lg font-semibold text-[var(--text-1)]"
          >
            {section.title}
          </h2>
          {section.blocks.map((block) => (
            <Block key={block.blockId} block={block} />
          ))}
        </section>
      ))}
    </div>
  );
}
