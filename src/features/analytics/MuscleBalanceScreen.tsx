import { useState } from 'react';
import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { t } from '@/i18n/fr';
import { muscleLabel, muscleSetsReading, periodLabel } from '@/i18n/labels';
import { muscleInvolvement } from '@/lib/analytics/involvement';
import { muscleBalance, toMuscleRows } from '@/lib/analytics/muscles';
import { PERIOD_KEYS, type PeriodKey } from '@/lib/analytics/periods';
import { weeklySessionCounts } from '@/lib/analytics/weeks';
import { Card, FilterChip, ListRow, OptionSheet, SectionTitle } from '@/ui';
import { MuscleMap, balanceHighlight } from '@/ui/muscleMap';
import { MuscleBalanceCard } from './MuscleBalanceCard';
import { useHistoricalPeriod } from './useHistoricalPeriod';

/**
 * RF-42 — how the working sets of a period are shared out between muscles.
 * Cf. `docs/superpowers/specs/2026-07-28-analytics-muscle-group-series-design.md`.
 *
 * No metric picker: one quantity, the working set. Tonnage per muscle is another
 * reading — a set of calf raises and a set of squats do not weigh the same — and
 * it belongs to milestone G4, like tonnage per week.
 *
 * `useHistoricalPeriod` keeps this screen on the same historical seam and
 * returns the window and its earlier-history signal as one coherent snapshot.
 */
export function MuscleBalanceScreen() {
  const navigate = useAppNavigate();
  const [periodOpen, setPeriodOpen] = useState(false);
  /** Read once: the bounds must not slide under the reader at midnight. */
  const [openedAt] = useState(() => Date.now());
  const [period, setPeriod] = useState<PeriodKey>('12w');

  const historicalPeriod = useHistoricalPeriod(period, openedAt);
  const data = historicalPeriod.data;
  const workouts = data?.workouts ?? [];

  /**
   * The week count comes from G2's own engine rather than from `WEEKS[period]`,
   * so this screen's rate and the weekly screen's average can never divide by
   * two different numbers — including the case they were both written for, a
   * window wider than the history behind it.
   */
  const weeks =
    data === undefined
      ? 0
      : weeklySessionCounts(
          workouts.map((workout) => ({
            startedAt: workout.startedAt,
            ...(workout.timezoneOffsetMinutes === undefined
              ? {}
              : {
                  timezoneOffsetMinutes: workout.timezoneOffsetMinutes,
                }),
          })),
          data.bounds,
          [],
          data.hasEarlierHistory,
        ).length;

  const rows = toMuscleRows(workouts);
  const balance = muscleBalance(rows);
  const rankedTotal = balance.ranked.reduce((sum, entry) => sum + entry.sets, 0);

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

        {data === undefined ? null : balance.total === 0 ? (
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
          <>
            {/* Above the list, not instead of it. The drawing answers "where are
                the holes" in one look; the rows answer "how many sets exactly",
                which no silhouette can. Neither replaces the other. */}
            <Card padded>
              {/* Weighted from the same rows the list counts, not from the
                  counts themselves: the drawing credits a share to the muscles
                  each exercise merely involves, exactly as the two session
                  recaps do. The rows below stay a count of working sets — one
                  body, one rule, and a number that can still be recounted. */}
              <MuscleMap highlight={balanceHighlight(muscleInvolvement(rows))} />
            </Card>
            <MuscleBalanceCard balance={balance} weeks={weeks} stale={historicalPeriod.stale} />
          </>
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
