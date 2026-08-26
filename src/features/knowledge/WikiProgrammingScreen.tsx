import { Link, useNavigate } from 'react-router-dom';
import { Screen } from '@/app/Screen';
import { t } from '@/i18n/fr';
import { PlanningTabs } from '@/features/planning/PlanningTabs';
import { articleHref, listArticleFamilies } from './articleCatalogue';
import { ProgrammingGuideEntry } from './ProgrammingGuideEntry';

/**
 * Le Guide : la famille « Programmer l'entraînement » du wiki, en lecture seule.
 *
 * Il ne lit plus `f1-programming.json` directement. Les 102 fiches n'ont pas
 * disparu — elles sont citées champ par champ dans les 19 articles, et chaque
 * bloc porte encore l'identifiant de la ligne dont il vient. Ce qui change, c'est
 * qu'on entre par un sujet et non par un tableau.
 *
 * Le bandeau « non relu » reste tant qu'un seul article du Guide n'a pas été
 * vérifié par un humain. Aucune transformation de format ne retire ce statut.
 */
export function WikiProgrammingScreen() {
  const navigate = useNavigate();
  const guide = listArticleFamilies().find((family) => family.id === 'programming');
  const articles = guide?.articles ?? [];
  const unreviewed = articles.some((article) => article.reviewState === 'pending_human_review');

  return (
    <Screen
      title={t('knowledge.programming.title')}
      onBack={() => void navigate('/knowledge')}
      action={
        <span className="record-figure text-sm text-[var(--text-2)]">
          {t(
            articles.length === 1
              ? 'knowledge.article.articleCountOne'
              : 'knowledge.article.articleCountMany',
            { count: articles.length },
          )}
        </span>
      }
    >
      <div className="space-y-5">
        <PlanningTabs />

        <section className="rounded-2xl bg-[var(--accent-soft)] p-5">
          <p className="text-sm leading-6 text-[var(--text-1)]">
            {t('knowledge.programming.intro')}
          </p>
        </section>

        {unreviewed && (
          <section className="rounded-2xl border border-[var(--border)] p-5">
            <p className="label-xs font-semibold text-[var(--text-2)]">
              {t('knowledge.programming.unreviewedLabel')}
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--text-2)]">
              {t('knowledge.programming.unreviewedBody')}
            </p>
          </section>
        )}

        {/* Le Guide est complet et dans l'ordre du document source. Pour qui
            construit son premier programme, cet ordre n'est pas le bon. */}
        <Link
          to="/knowledge/apprendre"
          className="flex min-h-12 items-center justify-between gap-4 rounded-2xl
            bg-[var(--accent-soft)] px-5 py-4"
        >
          <span className="min-w-0">
            <span className="block font-semibold text-[var(--accent-ink)]">{t('learn.entry')}</span>
            <span className="mt-1 block text-sm leading-6 text-[var(--text-2)]">
              {t('learn.entryHint')}
            </span>
          </span>
          <span aria-hidden="true" className="shrink-0 text-[var(--accent-ink)]">
            →
          </span>
        </Link>

        <ProgrammingGuideEntry />

        <ul className="space-y-1">
          {articles.map((article) => (
            <li key={article.articleId}>
              {/* min-h-12 = 48 px : une cible tactile pour une main en sueur. */}
              <Link
                to={articleHref(article)}
                className="flex min-h-12 items-center justify-between gap-4 rounded-xl
                  bg-[var(--surface-1)] px-4 py-2 text-sm leading-6 text-[var(--text-1)]"
              >
                <span>{article.title}</span>
                <span aria-hidden="true" className="shrink-0 text-[var(--text-2)]">
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Screen>
  );
}
