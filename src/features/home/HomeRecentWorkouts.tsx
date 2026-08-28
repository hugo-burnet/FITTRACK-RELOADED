import { Link } from 'react-router-dom';
import type { HistoryWorkoutSummary } from '@/data/repositories/history';
import { HistoryWorkoutSummaryList } from '@/features/history/HistoryJournal';
import { t } from '@/i18n/fr';
import { Card } from '@/ui';

/**
 * Les trois dernières séances — la même ligne exactement que dans le journal de
 * l'Historique, composant compris. Deux dessins de la même chose finiraient par
 * diverger sur le format de durée ou la casse du jour, et le clic mène de toute
 * façon au même détail.
 *
 * Le titre porte son « Tout voir » sur la même ligne, ce que `SectionTitle` ne
 * sait pas faire : c'est la seule section de l'accueil qui a une suite.
 */
export function HomeRecentWorkouts({ items }: { items: readonly HistoryWorkoutSummary[] }) {
  return (
    <section aria-labelledby="home-recent-title">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          id="home-recent-title"
          className="label-xs px-1 font-semibold text-[var(--text-2)]"
        >
          {t('home.recentSection')}
        </h2>
        <Link
          viewTransition
          to="/history"
          className="-my-2 flex min-h-12 items-center px-1 text-sm font-semibold
            text-[var(--accent-ink)] transition-opacity duration-[var(--dur-1)] active:opacity-70"
        >
          {t('home.seeAll')}
        </Link>
      </div>

      {items.length === 0 ? (
        <Card padded>
          <p className="text-sm leading-relaxed text-[var(--text-2)]">{t('home.recentEmpty')}</p>
        </Card>
      ) : (
        <HistoryWorkoutSummaryList items={items} />
      )}
    </section>
  );
}
