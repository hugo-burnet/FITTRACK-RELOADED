import { t } from '@/i18n/fr';
import { weeklySessionsReading } from '@/i18n/labels';
import { goalWeeksReached, weeklyAverage, type WeekBucket } from '@/lib/analytics/weeks';
import { Card } from '@/ui';
import { WeeklyChart } from './WeeklyChart';

/**
 * The reading, the histogram, and what the window really says — one card, in the
 * order they are read.
 *
 * Same shape as `ProgressCard`, and for the same reason: the number is the
 * interface (Lot 1) and the chart is its dial. What differs is the scale
 * underneath, and it differs on purpose — cf. the spec of G2, §6.
 */

const shortDate = (at: number): string =>
  new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

const longDate = (at: number): string =>
  new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

const decimal = (value: number): string =>
  (Math.round(value * 10) / 10).toLocaleString('fr-FR');

interface Props {
  buckets: readonly WeekBucket[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onOpenHistory: () => void;
  /** Held at reduced opacity while a new period loads — never a skeleton. */
  stale?: boolean;
}

export function WeeklyCard({ buckets, selectedIndex, onSelect, onOpenHistory, stale }: Props) {
  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  if (first === undefined || last === undefined) return null;

  const counts = buckets.map((bucket) => bucket.sessions);
  const average = weeklyAverage(buckets);
  const { reached, judged } = goalWeeksReached(buckets);

  /**
   * The top of the scale takes the goal in, not just the data.
   *
   * A target of 5 against weeks of 2 has to leave the bars at two fifths of the
   * box: that is what makes the shortfall visible, and it is what replaces a
   * dashed reference line — which would be a staircase anyway, since the goal
   * changes over time.
   */
  const ceiling = Math.max(
    ...counts,
    ...buckets.map((bucket) => bucket.goal ?? 0),
    1,
  );

  const selected = buckets[selectedIndex] ?? last;
  const missing = selected.goal === null ? 0 : selected.goal - selected.sessions;

  const summary =
    buckets.length === 1
      ? t('weekly.chartSummaryOne', {
          first: longDate(first.weekStart),
          current: weeklySessionsReading(first.sessions),
        })
      : t('weekly.chartSummary', {
          count: buckets.length,
          first: longDate(first.weekStart),
          last: longDate(last.weekStart),
          min: Math.min(...counts),
          max: Math.max(...counts),
          average: decimal(average),
        });

  return (
    <Card padded>
      <div className={`transition-opacity duration-[var(--dur-1)] ${stale ? 'opacity-50' : ''}`}>
        <div className="flex items-baseline justify-between gap-4">
          <span className="label-xs font-semibold text-[var(--text-2)]">
            {t('weekly.weekOf', { date: longDate(selected.weekStart) })}
          </span>
          <span className="metric text-3xl leading-none font-semibold text-[var(--text-1)]">
            {weeklySessionsReading(selected.sessions)}
          </span>
        </div>

        {selected.goal !== null && (
          <p className="mt-1 text-right text-sm text-[var(--text-2)]">
            {missing <= 0 ? (
              <span className="font-semibold text-[var(--accent-ink)]">
                {t('weekly.goalReached', { goal: selected.goal })}
              </span>
            ) : (
              t(missing === 1 ? 'weekly.goalMissedOne' : 'weekly.goalMissed', {
                goal: selected.goal,
                missing,
              })
            )}
          </p>
        )}

        <div className="mt-5 flex gap-3">
          {/* The scale, engraved rather than drawn — and unlike the curve's, its
              bottom is not arbitrary: it is zero, so it is shown rather than
              assumed. */}
          <div className="label-xs flex shrink-0 flex-col justify-between py-1 text-right font-semibold text-[var(--text-2)]">
            <span>{ceiling}</span>
            <span>{t('weekly.scaleZero')}</span>
          </div>

          <div className="min-w-0 flex-1">
            <WeeklyChart
              buckets={buckets}
              ceiling={ceiling}
              selectedIndex={selectedIndex}
              onSelect={onSelect}
              summary={summary}
            />
            {buckets.length > 1 && (
              <div className="mt-1 flex justify-between text-xs text-[var(--text-2)]">
                <span>{shortDate(first.weekStart)}</span>
                <span>{shortDate(last.weekStart)}</span>
              </div>
            )}
          </div>
        </div>

        {buckets.length === 1 && (
          <p className="mt-4 text-sm leading-relaxed text-[var(--text-2)]">
            {t('weekly.singleWeek')}
          </p>
        )}

        {/* What the window really says. A chart that cannot name its figure is a
            chart taken on trust. */}
        <div className="mt-4 border-t border-[var(--border)] pt-3 text-sm leading-relaxed text-[var(--text-2)]">
          <p>{t('weekly.average', { average: decimal(average) })}</p>
          {judged === 0 ? (
            <>
              <p className="mt-2">{t('weekly.noGoal')}</p>
              <button
                type="button"
                onClick={onOpenHistory}
                className="mt-2 min-h-12 text-base font-semibold text-[var(--accent-ink)]"
              >
                {t('weekly.noGoalAction')}
              </button>
            </>
          ) : (
            <>
              <p className="mt-1">
                {t(reached === 1 ? 'weekly.tallyOne' : 'weekly.tally', { reached, judged })}
              </p>
              {/* La légende des deux intensités. Sous le compte, pas au-dessus :
                  on lit d'abord ce que la fenêtre dit, ensuite comment elle le
                  dessine. Et seulement ici — sans objectif jamais défini, aucune
                  colonne n'est pleine et la phrase désignerait un repère absent. */}
              <p className="mt-1">{t('weekly.chartLegend')}</p>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
