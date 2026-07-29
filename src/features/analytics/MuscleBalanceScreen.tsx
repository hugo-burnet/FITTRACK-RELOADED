import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { Screen } from '@/app/Screen';
import { listHistoricalWorkouts } from '@/data/repositories/historicalWorkouts';
import { listCompletedWorkoutTimestamps } from '@/data/repositories/history';
import { t } from '@/i18n/fr';
import { muscleLabel, muscleSetsReading, periodLabel } from '@/i18n/labels';
import { muscleBalance, toMuscleRows } from '@/lib/analytics/muscles';
import { PERIOD_KEYS, periodBounds, type PeriodKey } from '@/lib/analytics/periods';
import { weeklySessionCounts } from '@/lib/analytics/weeks';
import { Card, FilterChip, ListRow, OptionSheet, SectionTitle } from '@/ui';
import { MuscleBalanceCard } from './MuscleBalanceCard';

/**
 * RF-42 — how the working sets of a period are shared out between muscles.
 * Cf. `docs/superpowers/specs/2026-07-28-analytics-muscle-group-series-design.md`.
 *
 * No metric picker: one quantity, the working set. Tonnage per muscle is another
 * reading — a set of calf raises and a set of squats do not weigh the same — and
 * it belongs to milestone G4, like tonnage per week.
 *
 * The read is `listHistoricalWorkouts({ kind: 'period' })`, third milestone through
 * the same door. A third query file would be a third definition of "a session
 * that counts", which is the fault 08B spent a session repairing.
 */
export function MuscleBalanceScreen() {
  const navigate = useNavigate();
  const [periodOpen, setPeriodOpen] = useState(false);
  /** Read once: the bounds must not slide under the reader at midnight. */
  const [openedAt] = useState(() => Date.now());
  const [period, setPeriod] = useState<PeriodKey>('12w');

  const { from, to } = periodBounds(period, openedAt);
  const sources = useLiveQuery(
    () =>
      listHistoricalWorkouts(
        from === undefined
          ? { kind: 'all-history' }
          : { kind: 'period', from, to },
      ),
    [from, to],
  );

  /**
   * Bare timestamps, for one question only: did anything happen **before** this
   * window? The distribution itself does not care — a muscle does not begin to
   * exist on a date — but the **per-week rate** does, and it inherits milestone
   * G2's lesson exactly: three weeks of history divided by a twelve-week window
   * reports a third of the real rhythm.
   */
  const allStarts = useLiveQuery(() => listCompletedWorkoutTimestamps(), []);
  const hasEarlierHistory =
    from !== undefined && (allStarts ?? []).some((startedAt) => startedAt < from);

  /**
   * The week count comes from G2's own engine rather than from `WEEKS[period]`,
   * so this screen's rate and the weekly screen's average can never divide by
   * two different numbers — including the case they were both written for, a
   * window wider than the history behind it.
   */
  const weeks = weeklySessionCounts(
    (sources ?? []).map((source) => ({
      startedAt: source.startedAt,
      ...(source.timezoneOffsetMinutes === undefined
        ? {}
        : { timezoneOffsetMinutes: source.timezoneOffsetMinutes }),
    })),
    { from, to },
    [],
    hasEarlierHistory,
  ).length;

  const balance = muscleBalance(toMuscleRows(sources ?? []));
  const rankedTotal = balance.ranked.reduce((sum, entry) => sum + entry.sets, 0);
  const stale = sources === undefined || allStarts === undefined;

  return (
    <Screen title={t('muscles.title')} onBack={() => void navigate(-1)}>
      <div className="space-y-7">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <FilterChip
            label={periodLabel(period)}
            active={false}
            onClick={() => setPeriodOpen(true)}
          />
        </div>

        {balance.total === 0 ? (
          <Card padded>
            <p className="text-sm leading-relaxed text-[var(--text-2)]">
              {t('muscles.emptyPeriod')}
            </p>
            {period !== 'all' && (
              <button
                type="button"
                onClick={() => setPeriod('all')}
                className="mt-3 min-h-12 text-base font-semibold text-[var(--accent-ink)]"
              >
                {t('analytics.emptyPeriodAction')}
              </button>
            )}
          </Card>
        ) : rankedTotal === 0 ? (
          /* Sets exist, but none of them on a region. Fifteen zeros would be a
             false reading of a true fact, so the fact is said in words and the
             work itself is listed below. */
          <Card padded>
            <p className="text-sm leading-relaxed text-[var(--text-2)]">{t('muscles.noRegion')}</p>
          </Card>
        ) : (
          <MuscleBalanceCard balance={balance} weeks={weeks} stale={stale} />
        )}

        {/* The three groups with no anatomical region, and the rows whose muscle
            could not be resolved — shown only when they carry something. Hiding
            forty sets of cardio would be the other fault: real work vanishing
            from a screen titled "sets per muscle". */}
        {balance.unscoped.length > 0 && (
          <section>
            <SectionTitle>{t('muscles.unscopedSection')}</SectionTitle>
            <Card>
              {balance.unscoped.map((entry) => (
                <ListRow
                  key={entry.muscle ?? 'unknown'}
                  title={
                    entry.muscle === undefined
                      ? t('muscles.unknownMuscle')
                      : muscleLabel(entry.muscle)
                  }
                  trailing={
                    <span className="metric text-base font-semibold text-[var(--text-2)]">
                      {muscleSetsReading(entry.sets)}
                    </span>
                  }
                />
              ))}
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
        onSelect={setPeriod}
      />
    </Screen>
  );
}
