import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/app/Screen';
import { t } from '@/i18n/fr';
import {
  periodLabel,
  weeklyVolumeMetricLabel,
  weeklyVolumeReading,
} from '@/i18n/labels';
import { PERIOD_KEYS, type PeriodKey } from '@/lib/analytics/periods';
import {
  weeklyVolumeBuckets,
  type WeeklyVolumeMetric,
} from '@/lib/analytics/volume';
import { Card, FilterChip, ListRow, OptionSheet, SectionTitle } from '@/ui';
import { ChartExportAction } from './ChartExportAction';
import { WeeklyVolumeCard } from './WeeklyVolumeCard';
import { useHistoricalPeriod } from './useHistoricalPeriod';

const longDate = (at: number): string =>
  new Date(at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

/**
 * G4 — the load carried by each observed week, as external tonnage or complete
 * session duration. Both metrics use the same buckets; switching the dial never
 * moves a week under the reader's finger.
 */
export function WeeklyVolumeScreen() {
  const navigate = useNavigate();
  const [periodOpen, setPeriodOpen] = useState(false);
  const [metricOpen, setMetricOpen] = useState(false);
  const [openedAt] = useState(() => Date.now());
  const [period, setPeriod] = useState<PeriodKey>('12w');
  const [metric, setMetric] = useState<WeeklyVolumeMetric>('tonnage');
  const [selectedIndex, setSelectedIndex] = useState<number>();
  const chartRef = useRef<HTMLDivElement>(null);
  const historicalPeriod = useHistoricalPeriod(period, openedAt);
  const data = historicalPeriod.data;
  const buckets =
    data === undefined
      ? []
      : weeklyVolumeBuckets(
          data.workouts,
          data.bounds,
          data.hasEarlierHistory,
        );
  const hasSessions = (data?.workouts.length ?? 0) > 0;
  const selected = Math.min(selectedIndex ?? buckets.length - 1, buckets.length - 1);

  const changePeriod = (next: PeriodKey) => {
    setPeriod(next);
    setSelectedIndex(undefined);
  };

  return (
    <Screen title={t('volume.title')} onBack={() => void navigate(-1)}>
      <div className="space-y-7" aria-busy={historicalPeriod.stale}>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterChip
            label={periodLabel(period)}
            active={false}
            onClick={() => setPeriodOpen(true)}
          />
          <FilterChip
            label={weeklyVolumeMetricLabel(metric)}
            active={false}
            onClick={() => setMetricOpen(true)}
          />
        </div>

        {data === undefined ? null : !hasSessions ? (
          <Card padded>
            <p className="text-sm leading-relaxed text-[var(--text-2)]">
              {t('volume.emptyPeriod')}
            </p>
            {period !== 'all' && (
              <button
                type="button"
                onClick={() => changePeriod('all')}
                className="mt-3 min-h-12 text-base font-semibold text-[var(--accent-ink)]"
              >
                {t('analytics.emptyPeriodAction')}
              </button>
            )}
          </Card>
        ) : (
          <div>
            <div ref={chartRef}>
              <WeeklyVolumeCard
                buckets={buckets}
                metric={metric}
                selectedIndex={selected}
                onSelect={setSelectedIndex}
                stale={historicalPeriod.stale}
              />
            </div>
            <ChartExportAction
              chartRef={chartRef}
              slug="volume"
              title={t('volume.title')}
              subtitle={`${periodLabel(period)} · ${weeklyVolumeMetricLabel(metric)}`}
            />
          </div>
        )}

        {hasSessions && buckets.length > 0 && (
          <section>
            <SectionTitle>{t('volume.weeksSection')}</SectionTitle>
            <Card>
              {[...buckets].reverse().map((bucket) => {
                const index = buckets.indexOf(bucket);
                const value =
                  metric === 'tonnage' ? bucket.tonnage : bucket.durationSeconds;

                return (
                  <ListRow
                    key={bucket.weekStart}
                    title={t('volume.weekOf', { date: longDate(bucket.weekStart) })}
                    onClick={() => setSelectedIndex(index)}
                    trailing={
                      <span
                        className={`metric text-base font-semibold ${
                          index === selected
                            ? 'text-[var(--text-1)]'
                            : 'text-[var(--text-2)]'
                        }`}
                      >
                        {weeklyVolumeReading(value, metric)}
                      </span>
                    }
                  />
                );
              })}
            </Card>
          </section>
        )}
      </div>

      <OptionSheet
        open={periodOpen}
        onClose={() => setPeriodOpen(false)}
        title={t('analytics.periodSheetTitle')}
        value={period}
        options={PERIOD_KEYS.map((key) => ({ value: key, label: periodLabel(key) }))}
        onSelect={changePeriod}
      />

      <OptionSheet
        open={metricOpen}
        onClose={() => setMetricOpen(false)}
        title={t('volume.metricSheetTitle')}
        value={metric}
        options={[
          { value: 'tonnage', label: weeklyVolumeMetricLabel('tonnage') },
          { value: 'duration', label: weeklyVolumeMetricLabel('duration') },
        ]}
        onSelect={setMetric}
      />
    </Screen>
  );
}
