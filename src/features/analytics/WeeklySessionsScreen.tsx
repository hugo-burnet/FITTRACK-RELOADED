import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/app/Screen';
import { listHistoricalWorkouts } from '@/data/repositories/historicalWorkouts';
import { listCompletedWorkoutTimestamps } from '@/data/repositories/history';
import { getWeeklyTrainingGoalHistory } from '@/data/repositories/settings';
import { t } from '@/i18n/fr';
import { periodLabel, weeklySessionsReading } from '@/i18n/labels';
import { PERIOD_KEYS, periodBounds, type PeriodKey } from '@/lib/analytics/periods';
import { weeklySessionCounts } from '@/lib/analytics/weeks';
import { Card, FilterChip, ListRow, OptionSheet, SectionTitle } from '@/ui';
import { WeeklyCard } from './WeeklyCard';

/**
 * RF-34, en graphique — le rythme d'entraînement, semaine par semaine.
 * Cf. `docs/superpowers/specs/2026-07-28-analytics-weekly-sessions-design.md`.
 *
 * No metric picker, and that is a decision rather than an omission: tonnage and
 * duration per week are milestone G4. A count of small integers and a sum of
 * four-figure kilos do not read the same way, and mixing them would demand
 * exactly the abstraction this milestone exists not to invent too early.
 *
 * The read is `listHistoricalWorkouts({ kind: 'period' })` — no new query, cf. §2 of
 * the spec. `listCompletedWorkoutTimestamps` would be lighter but returns bare
 * numbers, and a session's week cannot be judged without the offset it was
 * recorded under.
 */

const longDate = (at: number): string =>
  new Date(at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

export function WeeklySessionsScreen() {
  const navigate = useNavigate();
  const [periodOpen, setPeriodOpen] = useState(false);
  /** Read once: the bounds must not slide under the reader at midnight. */
  const [openedAt] = useState(() => Date.now());
  const [period, setPeriod] = useState<PeriodKey>('12w');
  const [selectedIndex, setSelectedIndex] = useState<number>();

  const goals = useLiveQuery(getWeeklyTrainingGoalHistory, []);
  /**
   * Bare timestamps, only to answer one question: did anything happen **before**
   * this window? Without it the chart draws empty weeks in front of a history
   * that had not started yet — a zero the app invents, not one it observed.
   *
   * It cannot come from `sources`: that read returns the window's contents, and
   * from the inside "nothing before" and "nothing during" look the same.
   */
  const allStarts = useLiveQuery(() => listCompletedWorkoutTimestamps(), []);

  const { from, to } = periodBounds(period, openedAt);
  const sources = useLiveQuery(
    () =>
      // `'all'` has no lower bound, and `HistoricalScope` already has the door for
      // that case — same rules, same reads. Inventing `from: 0` would work and
      // would also be the app quietly deciding when it was born.
      listHistoricalWorkouts(
        from === undefined
          ? { kind: 'all-history' }
          : { kind: 'period', from, to },
      ),
    [from, to],
  );

  const hasEarlierHistory =
    from !== undefined && (allStarts ?? []).some((startedAt) => startedAt < from);

  const buckets = weeklySessionCounts(
    (sources ?? []).map((source) => ({
      startedAt: source.startedAt,
      ...(source.timezoneOffsetMinutes === undefined
        ? {}
        : { timezoneOffsetMinutes: source.timezoneOffsetMinutes }),
    })),
    { from, to },
    goals ?? [],
    hasEarlierHistory,
  );

  const selected = Math.min(selectedIndex ?? buckets.length - 1, buckets.length - 1);
  // The selection belongs to a week that may not exist in the new slice.
  const changePeriod = (next: PeriodKey) => {
    setPeriod(next);
    setSelectedIndex(undefined);
  };

  const openHistory = () => void navigate('/history');

  return (
    <Screen title={t('weekly.title')} onBack={() => void navigate(-1)}>
      <div className="space-y-7">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterChip
            label={periodLabel(period)}
            active={false}
            onClick={() => setPeriodOpen(true)}
          />
        </div>

        {buckets.length === 0 ? (
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
          <WeeklyCard
            buckets={buckets}
            selectedIndex={selected}
            onSelect={setSelectedIndex}
            onOpenHistory={openHistory}
            stale={sources === undefined || goals === undefined || allStarts === undefined}
          />
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
