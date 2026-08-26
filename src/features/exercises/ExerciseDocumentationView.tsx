import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { t } from '@/i18n/fr';
import { muscleLabel } from '@/i18n/labels';
import { ArticleBody } from '@/features/knowledge/ArticleBody';
import { articleHref, filterArticles, findArticle } from '@/features/knowledge/articleCatalogue';
import {
  getDocumentationForExercise,
  type DocumentationExercise,
  type ExerciseDocumentationLimit,
} from '@/features/knowledge/exerciseDocumentation';
import type { WikiArticle } from '@/features/knowledge/articleTypes';
import { Button } from '@/ui';

const LIMIT_KEYS = {
  primary_article_missing: 'exerciseDoc.limitPrimaryMissing',
  movement_pattern_missing: 'exerciseDoc.limitPatternMissing',
  movement_article_missing: 'exerciseDoc.limitMovementArticleMissing',
} as const satisfies Record<ExerciseDocumentationLimit, string>;

function ArticleCard({ article }: { article: WikiArticle }) {
  return (
    <article className="rounded-2xl bg-[var(--surface-1)] p-5">
      <h3 className="text-base font-semibold leading-6 text-[var(--text-1)]">{article.title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">{article.summary}</p>
      {/* min-h-12 = 48 px : une cible tactile pour une main en sueur. */}
      <Link
        to={articleHref(article)}
        className="mt-3 flex min-h-12 items-center gap-2 text-sm font-semibold text-[var(--accent-ink)]"
      >
        {t('exerciseDoc.readArticle')}
        <span aria-hidden="true">→</span>
      </Link>
    </article>
  );
}

/**
 * La projection Documentation d'un exercice.
 *
 * Elle ne recopie pas les fiches musculaires complètes : le muscle principal et
 * les secondaires mènent à leur article, et ce qui est **propre à cet exercice**
 * — l'article de portée, et le rôle documenté de chaque secondaire dans cette
 * famille de mouvement — s'affiche ici, en entier.
 *
 * Le champ de recherche filtre uniquement les articles déjà rattachés. Il ne
 * décide jamais lesquels charger : une absence de résultat veut dire « ce texte
 * ne contient pas ces mots », pas « le corpus ne sait pas ».
 */
export function ExerciseDocumentationView({ exercise }: { exercise: DocumentationExercise }) {
  const [query, setQuery] = useState('');

  const documentation = useMemo(() => getDocumentationForExercise(exercise), [exercise]);

  const projected = useMemo(
    () =>
      documentation.articleIds.flatMap((articleId) => {
        const article = findArticle(articleId);
        return article === undefined ? [] : [article];
      }),
    [documentation],
  );

  const visible = useMemo(() => filterArticles(projected, query), [projected, query]);
  const visibleIds = new Set(visible.map((article) => article.articleId));
  const keep = (article: WikiArticle | null): boolean =>
    article !== null && visibleIds.has(article.articleId);

  const filtering = query.trim() !== '';

  return (
    <div className="flex flex-col gap-7">
      <section aria-labelledby="exercise-doc-summary" className="rounded-2xl bg-[var(--surface-1)] p-5">
        <h2 id="exercise-doc-summary" className="label-xs font-semibold text-[var(--text-2)]">
          {t('exerciseDoc.summaryTitle')}
        </h2>
        {projected.length === 0 ? (
          <p className="mt-3 text-sm leading-6 text-[var(--text-2)]">
            {t('exerciseDoc.emptyBody')}
          </p>
        ) : (
          <ul className="mt-3 space-y-1">
            {projected.map((article) => (
              <li key={article.articleId} className="text-sm leading-6 text-[var(--text-1)]">
                {article.title}
              </li>
            ))}
          </ul>
        )}
        <Link
          to="/knowledge"
          className="mt-3 flex min-h-12 items-center gap-2 text-sm font-semibold text-[var(--accent-ink)]"
        >
          {t('exerciseDoc.toSummary')}
          <span aria-hidden="true">→</span>
        </Link>
      </section>

      <div className="space-y-3">
        <label htmlFor="exercise-doc-filter" className="label-xs font-semibold text-[var(--text-2)]">
          {t('exerciseDoc.filterLabel')}
        </label>
        <input
          id="exercise-doc-filter"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          placeholder={t('exerciseDoc.filterPlaceholder')}
          autoComplete="off"
          className="min-h-14 w-full rounded-xl bg-[var(--surface-2)] px-4 text-base
            text-[var(--text-1)] outline-none placeholder:text-[var(--text-2)]
            focus:ring-2 focus:ring-[var(--accent-ink)]"
        />
        {/* Le bouton d'effacement survit à une recherche sans résultat : sans
            lui, un filtre trop précis laisse un écran vide et sans issue. */}
        {filtering && (
          <Button variant="ghost" size="md" onClick={() => setQuery('')}>
            {t('exerciseDoc.filterClear')}
          </Button>
        )}
        {filtering && visible.length === 0 && (
          <p role="status" className="text-sm leading-6 text-[var(--text-2)]">
            {t('exerciseDoc.filterEmpty')}
          </p>
        )}
      </div>

      {keep(documentation.primary) && <ArticleCard article={documentation.primary!} />}

      {keep(documentation.relationship) && <ArticleCard article={documentation.relationship!} />}

      {documentation.specific.filter(keep).map((article) => (
        <section key={article.articleId} aria-labelledby={`specific-${article.articleId}`}>
          <h3
            id={`specific-${article.articleId}`}
            className="px-1 text-lg font-semibold text-[var(--text-1)]"
          >
            {article.title}
          </h3>
          <div className="mt-4">
            <ArticleBody article={article} />
          </div>
        </section>
      ))}

      {documentation.clinical.filter(keep).length > 0 && (
        <section aria-labelledby="exercise-doc-clinical" className="space-y-3">
          <h2 id="exercise-doc-clinical" className="px-1 text-lg font-semibold text-[var(--text-1)]">
            {t('exerciseDoc.clinicalTitle')}
          </h2>
          {/* Ce bloc ne diagnostique rien et ne se déclenche sur rien : il évite
              seulement d'avoir à chercher « genou » dans un wiki le jour où le
              genou fait mal pendant un squat. */}
          <p className="px-1 text-sm leading-6 text-[var(--text-2)]">
            {t('exerciseDoc.clinicalHint')}
          </p>
          {documentation.clinical.filter(keep).map((article) => (
            <ArticleCard key={article.articleId} article={article} />
          ))}
        </section>
      )}

      {documentation.secondary.length > 0 && (
        <section aria-labelledby="exercise-doc-secondary" className="space-y-3">
          <h2 id="exercise-doc-secondary" className="px-1 text-lg font-semibold text-[var(--text-1)]">
            {t('exerciseDoc.secondaryTitle')}
          </h2>
          {documentation.secondary.map((item) => (
            <article key={item.muscle} className="rounded-2xl bg-[var(--surface-1)] p-5">
              <h3 className="text-base font-semibold leading-6 text-[var(--text-1)]">
                {muscleLabel(item.muscle)}
              </h3>
              {/* Sans rôle balisé dans l'article de mouvement, on ne dit rien de
                  la coopération : le corpus ne l'a pas documentée, et la déduire
                  de la seule présence d'un muscle secondaire serait l'inventer. */}
              <p className="mt-2 text-sm leading-6 text-[var(--text-2)]">
                {item.roleText ?? t('exerciseDoc.secondaryNoRole')}
              </p>
              {item.article !== null && (
                <Link
                  to={articleHref(item.article)}
                  className="mt-3 flex min-h-12 items-center gap-2 text-sm font-semibold
                    text-[var(--accent-ink)]"
                >
                  {t('exerciseDoc.readArticle')}
                  <span aria-hidden="true">→</span>
                </Link>
              )}
            </article>
          ))}
        </section>
      )}

      {documentation.limitations.length > 0 && (
        <section
          aria-labelledby="exercise-doc-limits"
          className="border-t border-[var(--border)] px-1 pt-5"
        >
          <h2 id="exercise-doc-limits" className="label-xs font-semibold text-[var(--text-2)]">
            {t('exerciseDoc.limitsTitle')}
          </h2>
          <ul className="mt-3 space-y-2">
            {documentation.limitations.map((limit) => (
              <li key={limit} className="text-sm leading-6 text-[var(--text-2)]">
                {t(LIMIT_KEYS[limit])}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
