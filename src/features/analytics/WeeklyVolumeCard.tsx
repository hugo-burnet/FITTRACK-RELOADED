import { t } from '@/i18n/fr';
import {
  weeklyVolumeMetricLabel,
  weeklyVolumeReading,
  weeklyVolumeScaleReading,
} from '@/i18n/labels';
import {
  weeklyVolumeAverage,
  weeklyVolumeTotal,
  weeklyVolumeValues,
  type WeeklyVolumeBucket,
  type WeeklyVolumeMetric,
} from '@/lib/analytics/volume';
import { Card } from '@/ui';
import { WeeklyVolumeChart } from './WeeklyVolumeChart';

const shortDate = (at: number): string =>
  new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

const longDate = (at: number): string =>
  new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });

interface Props {
  buckets: readonly WeeklyVolumeBucket[];
  metric: WeeklyVolumeMetric;
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Held at reduced opacity while a new period loads — never a skeleton. */
  stale?: boolean;
}

export function WeeklyVolumeCard({
  buckets,
  metric,
  selectedIndex,
  onSelect,
  stale,
}: Props) {
  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  if (first === undefined || last === undefined) return null;

  const values = weeklyVolumeValues(buckets, metric);
  const ceiling = Math.max(...values, 1);
  const selected = buckets[selectedIndex] ?? last;
  const selectedValue =
    metric === 'tonnage' ? selected.tonnage : selected.durationSeconds;
  const total = weeklyVolumeTotal(buckets, metric);
  const average = weeklyVolumeAverage(buckets, metric);
  const reading = (value: number) => weeklyVolumeReading(value, metric);
  const metricName = weeklyVolumeMetricLabel(metric);

  const summary =
    buckets.length === 1
      ? t('volume.chartSummaryOne', {
          metric: metricName,
          first: longDate(first.weekStart),
          current: reading(values[0]!),
        })
      : t('volume.chartSummary', {
          metric: metricName,
          count: buckets.length,
          first: longDate(first.weekStart),
          last: longDate(last.weekStart),
          min: reading(Math.min(...values)),
          max: reading(Math.max(...values)),
          average: reading(average),
        });

  return (
    <Card padded>
      <div className={`transition-opacity duration-[var(--dur-1)] ${stale ? 'opacity-50' : ''}`}>
        <div className="flex items-baseline justify-between gap-4">
          <span className="label-xs font-semibold text-[var(--text-2)]">
            {t('volume.weekOf', { date: longDate(selected.weekStart) })}
          </span>
          <span className="metric text-right text-3xl leading-none font-semibold text-[var(--text-1)]">
            {reading(selectedValue)}
          </span>
        </div>

        <div className="mt-5 flex gap-3">
          <div className="metric flex shrink-0 flex-col justify-between py-1 text-right text-xs font-semibold text-[var(--text-2)]">
            <span>{weeklyVolumeScaleReading(ceiling, metric)}</span>
            <span>{t('volume.scaleZero')}</span>
          </div>

          <div className="min-w-0 flex-1">
            <WeeklyVolumeChart
              values={values}
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
            {t('volume.singleWeek')}
          </p>
        )}

        <div className="mt-4 border-t border-[var(--border)] pt-3 text-sm leading-relaxed text-[var(--text-2)]">
          <p>{t('volume.total', { value: reading(total) })}</p>
          <p className="mt-1">{t('volume.average', { value: reading(average) })}</p>
          <p className="mt-3">
            {t(metric === 'tonnage' ? 'volume.tonnageHint' : 'volume.durationHint')}
          </p>
          {metric === 'tonnage' && total === 0 && (
            <p className="mt-2">{t('volume.zeroTonnage')}</p>
          )}
        </div>
      </div>
    </Card>
  );
}
