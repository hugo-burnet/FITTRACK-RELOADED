import { useState } from 'react';
import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { t } from '@/i18n/fr';
import {
  monthLabel,
  monthlyDeltaReading,
  monthlyReading,
  muscleSetsReading,
  type MonthlyUnit,
} from '@/i18n/labels';
import {
  monthlyDelta,
  monthlyReports,
  type MonthlyReport,
} from '@/lib/analytics/monthlyReport';
import { Card, FilterChip, ListRow, OptionSheet, SectionTitle } from '@/ui';
import { useHistoricalPeriod } from './useHistoricalPeriod';

/** How many exercises the month names. Beyond three it is a list, not a report. */
const TOP_EXERCISES = 3;

type Line = {
  labelKey:
    | 'monthly.sessions'
    | 'monthly.activeDays'
    | 'monthly.sets'
    | 'monthly.reps'
    | 'monthly.tonnage'
    | 'monthly.duration';
  unit: MonthlyUnit;
  read: (report: MonthlyReport) => number;
};

/**
 * The six figures, in the order a month is read: how often, then how much, then
 * how long. Always the same six, always in the same place — a report you have
 * to re-read the layout of each month is not a report.
 */
const LINES: Line[] = [
  { labelKey: 'monthly.sessions', unit: 'count', read: (report) => report.sessions },
  { labelKey: 'monthly.activeDays', unit: 'count', read: (report) => report.activeDays },
  { labelKey: 'monthly.sets', unit: 'count', read: (report) => report.workingSets },
  { labelKey: 'monthly.reps', unit: 'count', read: (report) => report.totalReps },
  { labelKey: 'monthly.tonnage', unit: 'tonnage', read: (report) => report.tonnage },
  { labelKey: 'monthly.duration', unit: 'duration', read: (report) => report.durationSeconds },
];

const deltaOf = (line: Line, delta: ReturnType<typeof monthlyDelta>): number | undefined => {
  if (delta === undefined) return undefined;
  switch (line.labelKey) {
    case 'monthly.sessions':
      return delta.sessions;
    case 'monthly.sets':
      return delta.workingSets;
    case 'monthly.tonnage':
      return delta.tonnage;
    case 'monthly.duration':
      return delta.durationSeconds;
    // Jours d'entraînement et répétitions n'ont pas d'écart affiché : le mois
    // les compare déjà par ses séances et son tonnage, et six écarts sur six
    // lignes transforment un rapport en tableau de bord.
    default:
      return undefined;
  }
};

/**
 * RF-44 — the monthly report, one month at a time.
 *
 * Not a chart: a month is a number, not a curve, and the curves already exist
 * one screen away. What a report adds is the **comparison** — the same six
 * figures, next to what the month before did — which is the only reading that
 * turns "1 200 kg" into information.
 */
export function MonthlyReportScreen() {
  const navigate = useAppNavigate();
  const [openedAt] = useState(() => Date.now());
  const [monthOpen, setMonthOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<number>();
  // Le rapport parcourt tous les mois connus : sa fenêtre est l'historique
  // entier, comme celle de l'export. Les bornes de `periods.ts` sont en
  // semaines, et un mois n'en fait jamais un nombre entier.
  const historicalPeriod = useHistoricalPeriod('all', openedAt);
  const data = historicalPeriod.data;
  const reports = data === undefined ? [] : monthlyReports(data.workouts, openedAt);
  const current = reports.find((report) => report.monthStart === selectedMonth) ?? reports[0];
  const previous =
    current === undefined
      ? undefined
      : reports[reports.findIndex((report) => report.monthStart === current.monthStart) + 1];
  const delta = current === undefined ? undefined : monthlyDelta(current, previous);

  return (
    <Screen title={t('monthly.title')} onBack={() => void navigate(-1)}>
      <div className="space-y-7" aria-busy={historicalPeriod.stale}>
        {data === undefined ? null : current === undefined ? (
          <Card padded>
            <p className="text-sm leading-relaxed text-[var(--text-2)]">{t('monthly.empty')}</p>
          </Card>
        ) : (
          <>
            <div className="flex gap-2 overflow-x-auto pb-1">
              <FilterChip
                label={monthLabel(current.monthStart)}
                active={false}
                onClick={() => setMonthOpen(true)}
              />
            </div>

            <section>
              <SectionTitle>{t('monthly.summarySection')}</SectionTitle>
              <div className="overflow-hidden rounded-2xl bg-[var(--surface-1)]">
                {LINES.map((line) => {
                  const value = line.read(current);
                  const change = deltaOf(line, delta);

                  return (
                    <ListRow
                      key={line.labelKey}
                      title={t(line.labelKey)}
                      trailing={
                        <span className="flex items-baseline gap-2">
                          <span className="metric text-base font-semibold text-[var(--text-1)]">
                            {monthlyReading(value, line.unit)}
                          </span>
                          {change !== undefined && (
                            <span className="metric label-xs font-semibold text-[var(--text-2)]">
                              {monthlyDeltaReading(change, line.unit)}
                            </span>
                          )}
                        </span>
                      }
                    />
                  );
                })}
              </div>
              <p className="mt-3 px-1 text-sm leading-relaxed text-[var(--text-2)]">
                {previous === undefined
                  ? t('monthly.noPrevious')
                  : t('monthly.comparedTo', { month: monthLabel(previous.monthStart) })}
              </p>
            </section>

            {current.sessions === 0 ? (
              <Card padded>
                <p className="text-sm leading-relaxed text-[var(--text-2)]">
                  {t('monthly.emptyMonth')}
                </p>
              </Card>
            ) : (
              <section>
                <SectionTitle>{t('monthly.exercisesSection')}</SectionTitle>
                <Card>
                  {current.exercises.slice(0, TOP_EXERCISES).map((exercise) => (
                    <ListRow
                      key={exercise.exerciseId}
                      title={exercise.name ?? t('workout.deletedExercise')}
                      subtitle={t(
                        exercise.sessions === 1
                          ? 'monthly.exerciseSession'
                          : 'monthly.exerciseSessions',
                        { count: exercise.sessions },
                      )}
                      trailing={
                        <span className="metric text-base font-semibold text-[var(--text-1)]">
                          {t('monthly.exerciseReading', {
                            tonnage: monthlyReading(exercise.tonnage, 'tonnage'),
                            sets: muscleSetsReading(exercise.workingSets),
                          })}
                        </span>
                      }
                    />
                  ))}
                </Card>
              </section>
            )}
          </>
        )}
      </div>

      <OptionSheet
        open={monthOpen}
        onClose={() => setMonthOpen(false)}
        title={t('monthly.monthSheetTitle')}
        // `OptionSheet` choisit parmi des chaînes : un mois voyage donc en
        // texte le temps de la feuille, et redevient un instant à l'arrivée.
        value={String(current?.monthStart ?? '')}
        options={reports.map((report) => ({
          value: String(report.monthStart),
          label: monthLabel(report.monthStart),
        }))}
        onSelect={(month) => setSelectedMonth(Number(month))}
      />
    </Screen>
  );
}
