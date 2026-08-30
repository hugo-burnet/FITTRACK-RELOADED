import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { getWeeklyTrainingGoalHistory } from '@/data/repositories/settings';
import { useTutorialControls } from '@/features/tutorial/tutorialContext';
import { t } from '@/i18n/fr';
import { periodLabel, weeklySessionsReading } from '@/i18n/labels';
import { PERIOD_KEYS, type PeriodKey } from '@/lib/analytics/periods';
import { weeklySessionCounts } from '@/lib/analytics/weeks';
import { Card, FilterChip, ListRow, OptionSheet, SectionTitle } from '@/ui';
import { ChartExportAction } from './ChartExportAction';
import { WeeklyCard } from './WeeklyCard';
import { useHistoricalPeriod } from './useHistoricalPeriod';

/**
 * RF-34, en graphique — le rythme d'entraînement, semaine par semaine.
 * Cf. `docs/design/specs/2026-07-28-analytics-weekly-sessions-design.md`.
 *
 * No metric picker, and that is a decision rather than an omission: tonnage and
 * duration per week are milestone G4. A count of small integers and a sum of
 * four-figure kilos do not read the same way, and mixing them would demand
 * exactly the abstraction this milestone exists not to invent too early.
 *
 * `useHistoricalPeriod` keeps the historical projection and the earlier-history
 * signal in one coherent snapshot. A session's week still comes from the offset
 * recorded with that session, never from a bare current timestamp.
 */

const longDate = (at: number): string =>
  new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export function WeeklySessionsScreen() {
  const navigate = useAppNavigate();
  const tutorial = useTutorialControls();
  const [periodOpen, setPeriodOpen] = useState(false);
  /** Read once: the bounds must not slide under the reader at midnight. */
  const [openedAt] = useState(() => Date.now());
  const [period, setPeriod] = useState<PeriodKey>('12w');
  const [selectedIndex, setSelectedIndex] = useState<number>();
  const chartRef = useRef<HTMLDivElement>(null);

  const goals = useLiveQuery(getWeeklyTrainingGoalHistory, []);
  const historicalPeriod = useHistoricalPeriod(period, openedAt);
  const data = historicalPeriod.data;
  const buckets =
    data === undefined
      ? []
      : weeklySessionCounts(
          data.workouts.map((workout) => ({
            startedAt: workout.startedAt,
            ...(workout.timezoneOffsetMinutes === undefined
              ? {}
              : {
                  timezoneOffsetMinutes:
                    workout.timezoneOffsetMinutes,
                }),
          })),
          data.bounds,
          goals ?? [],
          data.hasEarlierHistory,
        );
  const stale = historicalPeriod.stale || goals === undefined;

  const selected = Math.min(selectedIndex ?? buckets.length - 1, buckets.length - 1);
  // The selection belongs to a week that may not exist in the new slice.
  const changePeriod = (next: PeriodKey) => {
    setPeriod(next);
    setSelectedIndex(undefined);
    // Rechoisir la période courante ne change rien à l'écran : l'annoncer
    // ferait avancer une étape qui demande justement de voir le graphique
    // bouger. « Voir tout l'historique » passe aussi par ici, et lui change
    // bien quelque chose.
    if (next !== period) {
      tutorial?.report({ type: 'analytics-period-changed', view: 'weekly', period: next });
    }
  };

  const openHistory = () => void navigate('/history');

  return (
    <Screen title={t('weekly.title')} onBack={() => void navigate(-1)}>
      <div className="space-y-7">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterChip
            label={periodLabel(period)}
            active={false}
            tutorialId="analytics-period"
            onClick={() => setPeriodOpen(true)}
          />
        </div>

        {data === undefined ? null : buckets.length === 0 ? (
          <Card padded>
            <p className="text-sm leading-relaxed text-[var(--text-2)]">
              {t('weekly.emptyPeriod')}
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
              <WeeklyCard
                buckets={buckets}
                selectedIndex={selected}
                onSelect={setSelectedIndex}
                onOpenHistory={openHistory}
                stale={stale}
              />
            </div>
            <ChartExportAction
              chartRef={chartRef}
              slug="seances"
              title={t('weekly.title')}
              subtitle={periodLabel(period)}
            />
          </div>
        )}

        {/* The accessible table. It carries **every** week, the empty ones
            included, so nothing is reachable through the drawing alone. */}
        {buckets.length > 0 && (
          <section>
            <SectionTitle>{t('weekly.weeksSection')}</SectionTitle>
            <Card>
              {[...buckets].reverse().map((bucket) => {
                const index = buckets.indexOf(bucket);
                const reached = bucket.goal !== null && bucket.sessions >= bucket.goal;

                return (
                  <ListRow
                    key={bucket.weekStart}
                    title={t('weekly.weekOf', { date: longDate(bucket.weekStart) })}
                    onClick={() => setSelectedIndex(index)}
                    trailing={
                      <span
                        className={`metric text-base font-semibold ${
                          reached
                            ? 'text-[var(--accent-ink)]'
                            : index === selected
                              ? 'text-[var(--text-1)]'
                              : 'text-[var(--text-2)]'
                        }`}
                      >
                        {weeklySessionsReading(bucket.sessions)}
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
    </Screen>
  );
}
