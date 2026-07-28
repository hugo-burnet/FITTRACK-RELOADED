import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/app/Screen';
import { listExportSources } from '@/data/repositories/exportQueries';
import { listCompletedWorkoutTimestamps } from '@/data/repositories/history';
import type { ExportSource } from '@/lib/export/types';
import { t } from '@/i18n/fr';
import {
  periodLabel,
  weeklyVolumeMetricLabel,
  weeklyVolumeReading,
} from '@/i18n/labels';
import { PERIOD_KEYS, periodBounds, type PeriodKey } from '@/lib/analytics/periods';
import {
  weeklyVolumeBuckets,
  type WeeklyVolumeMetric,
} from '@/lib/analytics/volume';
import { Card, FilterChip, ListRow, OptionSheet, SectionTitle } from '@/ui';
import { WeeklyVolumeCard } from './WeeklyVolumeCard';

const longDate = (at: number): string =>
  new Date(at).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

interface ResolvedVolumeQuery {
  from: number | undefined;
  to: number;
  sources: ExportSource[];
  allStarts: number[];
}

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
  const [resolvedQuery, setResolvedQuery] = useState<ResolvedVolumeQuery>();

  const { from, to } = periodBounds(period, openedAt);
  const sources = useLiveQuery(
    () =>
      listExportSources(
        from === undefined ? { kind: 'all-history' } : { kind: 'period', from, to },
      ),
    [from, to],
  );
  const allStarts = useLiveQuery(() => listCompletedWorkoutTimestamps(), []);
  const currentQuery =
    sources === undefined || allStarts === undefined
      ? undefined
      : { from, to, sources, allStarts };

  if (
    currentQuery !== undefined &&
    (resolvedQuery === undefined ||
      resolvedQuery.from !== currentQuery.from ||
      resolvedQuery.to !== currentQuery.to ||
      resolvedQuery.sources !== currentQuery.sources ||
      resolvedQuery.allStarts !== currentQuery.allStarts)
  ) {
    setResolvedQuery(currentQuery);
  }

  const presentedQuery = currentQuery ?? resolvedQuery;
  const stale = currentQuery === undefined;
  const hasEarlierHistory =
    presentedQuery?.from !== undefined &&
    presentedQuery.allStarts.some((startedAt) => startedAt < presentedQuery.from!);
  const buckets =
    presentedQuery === undefined
      ? []
      : weeklyVolumeBuckets(
          presentedQuery.sources,
          { from: presentedQuery.from, to: presentedQuery.to },
          hasEarlierHistory,
        );
  const hasSessions = (presentedQuery?.sources.length ?? 0) > 0;
  const selected = Math.min(selectedIndex ?? buckets.length - 1, buckets.length - 1);

  const changePeriod = (next: PeriodKey) => {
    setPeriod(next);
    setSelectedIndex(undefined);
  };

  return (
    <Screen title={t('volume.title')} onBack={() => void navigate(-1)}>
      <div className="space-y-7" aria-busy={stale}>
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

        {presentedQuery === undefined ? null : !hasSessions ? (
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
          <WeeklyVolumeCard
            buckets={buckets}
            metric={metric}
            selectedIndex={selected}
            onSelect={setSelectedIndex}
            stale={stale}
          />
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
