import { t } from '@/i18n/fr';
import { metricHint, metricLabel, metricReading } from '@/i18n/labels';
import type { MetricDefinition, MetricPoint } from '@/lib/analytics/metrics';
import { bestPointIndex } from '@/lib/analytics/metrics';
import { plotBounds } from '@/lib/analytics/plot';
import { Card } from '@/ui';
import { ProgressChart } from './ProgressChart';
import { CardHeadline } from './CardHeadline';

/**
 * The readout, the curve, and the scale — one card, in the order they are read.
 *
 * The number is the interface (Lot 1) and the curve is its dial: the big figure
 * on top says what the selected session was worth, the plot underneath says
 * where it sits among the others. Not the reverse — a 2px polyline is not
 * legible at arm's length, and a session's value is.
 */

const shortDate = (at: number): string =>
  new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

const longDate = (at: number): string =>
  new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

interface Props {
  metric: MetricDefinition;
  points: readonly MetricPoint[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Held at reduced opacity while a new period loads — never a skeleton. */
  stale?: boolean;
}

export function ProgressCard({ metric, points, selectedIndex, onSelect, stale }: Props) {
  const first = points[0];
  const last = points[points.length - 1];
  // Never rendered empty — the screen shows its own state for that — but the
  // guard is what lets everything below read a point without asking again.
  if (first === undefined || last === undefined) return null;

  const values = points.map((point) => point.value);
  const { min, max } = plotBounds(values);
  const best = bestPointIndex(points, metric.betterWhen);
  const selected = points[selectedIndex] ?? last;
  const reading = (value: number) => metricReading(value, metric.unit, metric.key);

  const summary =
    points.length === 1
      ? t('analytics.chartSummaryOne', {
          metric: metricLabel(metric.key),
          first: longDate(first.timestamp),
          current: reading(first.value),
        })
      : t('analytics.chartSummary', {
          metric: metricLabel(metric.key),
          count: points.length,
          first: longDate(first.timestamp),
          last: longDate(last.timestamp),
          min: reading(Math.min(...values)),
          max: reading(Math.max(...values)),
          current: reading(last.value),
        });

  return (
    <Card padded>
      <div
        className={`transition-opacity duration-[var(--dur-1)] ${stale ? 'opacity-50' : ''}`}
      >
        {/* Value first, label second — the reader already knows which metric
            they picked and wants the number. */}
        <CardHeadline label={metricLabel(metric.key)} value={reading(selected.value)} />
        <p className="mt-1 text-right text-sm text-[var(--text-2)]">
          {longDate(selected.timestamp)}
          {selectedIndex === best && (
            <span className="ml-2 font-semibold text-[var(--accent-ink)]">
              {t('analytics.record')}
            </span>
          )}
        </p>

        <div className="mt-5 flex gap-3">
          {/* The vertical scale, engraved rather than drawn. This is what buys
              the right to a baseline that is not zero: nothing has to be
              assumed about the origin, because both ends are written down. */}
          <div className="label-xs flex shrink-0 flex-col justify-between py-1 text-right font-semibold text-[var(--text-2)]">
            <span>{reading(max)}</span>
            <span>{reading(min)}</span>
          </div>

          <div className="min-w-0 flex-1">
            <ProgressChart
              points={points}
              bestIndex={best}
              selectedIndex={selectedIndex}
              onSelect={onSelect}
              summary={summary}
            />
            {points.length > 1 && (
              <div className="mt-1 flex justify-between text-xs text-[var(--text-2)]">
                <span>{shortDate(first.timestamp)}</span>
                <span>{shortDate(last.timestamp)}</span>
              </div>
            )}
          </div>
        </div>

        {points.length === 1 && (
          <p className="mt-4 text-sm leading-relaxed text-[var(--text-2)]">
            {t('analytics.singleSession')}
          </p>
        )}

        {/* What the number counts, and what it leaves out. A curve that cannot
            name its figure is a curve taken on trust. */}
        <div className="mt-4 border-t border-[var(--border)] pt-3 text-sm leading-relaxed text-[var(--text-2)]">
          <p>{metricHint(metric.key)}</p>
          {/* La légende du point plein. À partir de deux points seulement : avec
              une seule séance le record est la seule valeur qu'il y ait. */}
          {points.length > 1 && <p className="mt-1">{t('analytics.chartLegend')}</p>}
        </div>
      </div>
    </Card>
  );
}
