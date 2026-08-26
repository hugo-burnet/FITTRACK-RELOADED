import { Link } from 'react-router-dom';
import { t } from '@/i18n/fr';
import { articleHref, listArticleFamilies } from './articleCatalogue';
import type { ArticleFamilyGroup } from './articleCatalogue';

function countLabel(count: number): string {
  return t(
    count === 1 ? 'knowledge.article.articleCountOne' : 'knowledge.article.articleCountMany',
    { count },
  );
}

function FamilyCard({ family }: { family: ArticleFamilyGroup }) {
  return (
    <article className="rounded-2xl bg-[var(--surface-1)] p-5">
      <h3 className="text-base font-semibold leading-6 text-[var(--text-1)]">{family.label}</h3>
      <p className="label-xs mt-2 font-semibold text-[var(--text-2)]">
        {countLabel(family.articles.length)}
      </p>

      <ul className="mt-4 space-y-1">
        {family.articles.map((article) => (
          <li key={article.articleId}>
            {/* min-h-12 = 48 px : une cible tactile pour une main en sueur. */}
            <Link
              to={articleHref(article)}
              className="flex min-h-12 items-center justify-between gap-4 rounded-xl px-3 py-2
                text-sm leading-6 text-[var(--text-1)]"
            >
              <span>{article.title}</span>
              <span aria-hidden="true" className="shrink-0 text-[var(--text-2)]">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </article>
  );
}

/**
 * Le sommaire. Il entre par les familles du wiki rédigé, dans l'ordre écrit à la
 * main dans le contrat éditorial — pas dans un ordre de pertinence, qui ferait
 * bouger le sommaire d'une visite à l'autre.
 *
 * La méthode est mise à part en bas : elle est nécessaire pour lire le reste,
 * mais la rattacher aux muscles ou aux mouvements l'aurait fait remonter sur des
 * écrans où elle n'a rien à faire.
 */
export function WikiBrowse() {
  const families = listArticleFamilies();
  const content = families.filter((family) => family.id !== 'method');
  const method = families.find((family) => family.id === 'method');

  return (
    <section aria-labelledby="wiki-browse" className="space-y-4">
      <div className="px-1">
        <h2 id="wiki-browse" className="text-lg font-semibold text-[var(--text-1)]">
          {t('knowledge.article.browseTitle')}
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
          {t('knowledge.article.browseIntro')}
        </p>
      </div>

      <Link
        to="/knowledge/questions"
        className="flex min-h-12 items-center justify-between gap-4 rounded-2xl
          bg-[var(--accent-soft)] px-5 py-4"
      >
        <span className="font-semibold text-[var(--accent-ink)]">
          {t('knowledge.wiki.questionsEntry')}
        </span>
        <span aria-hidden="true" className="text-[var(--accent-ink)]">
          →
        </span>
      </Link>

      {content.map((family) => (
        <FamilyCard key={family.id} family={family} />
      ))}

      {method !== undefined && (
        <div className="border-t border-[var(--border)] pt-4">
          <FamilyCard family={method} />
        </div>
      )}
    </section>
  );
}
