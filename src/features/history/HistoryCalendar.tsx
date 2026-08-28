import type { HistoryWorkoutSummary } from '@/data/repositories/history';
import { t } from '@/i18n/fr';
import { buildMonthGrid } from '@/lib/history';
import { Card } from '@/ui';
import { ArrowLeftIcon } from '@/ui/icons';
import { HistoryWorkoutSummaryList } from './HistoryJournal';

interface Props {
  visibleMonth: number;
  completedWorkoutTimestamps: readonly number[] | undefined;
  selectedDay: number | undefined;
  selectedDayWorkouts: readonly HistoryWorkoutSummary[] | undefined;
  onChangeMonth: (amount: number) => void;
  onSelectDay: (timestamp: number) => void;
}

const WEEKDAY_KEYS = [
  'history.weekdayMonday',
  'history.weekdayTuesday',
  'history.weekdayWednesday',
  'history.weekdayThursday',
  'history.weekdayFriday',
  'history.weekdaySaturday',
  'history.weekdaySunday',
] as const;

const monthFormatter = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  year: 'numeric',
});

const dayFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function HistoryCalendar({
  visibleMonth,
  completedWorkoutTimestamps,
  selectedDay,
  selectedDayWorkouts,
  onChangeMonth,
  onSelectDay,
}: Props) {
  const monthLabel = monthFormatter.format(visibleMonth);
  const days = buildMonthGrid(
    visibleMonth,
    completedWorkoutTimestamps ?? [],
  );

  return (
    <div className="space-y-5">
      <section aria-labelledby="history-calendar-title">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label={t('history.previousMonth')}
            onClick={() => onChangeMonth(-1)}
            className="flex size-12 shrink-0 items-center justify-center rounded-xl
              text-[var(--text-1)] active:bg-[var(--surface-1)]"
          >
            <ArrowLeftIcon />
          </button>

          <h2
            id="history-calendar-title"
            className="min-w-0 flex-1 text-center text-lg font-semibold capitalize
              text-[var(--text-1)]"
          >
            {monthLabel}
          </h2>

          <button
            type="button"
            aria-label={t('history.nextMonth')}
            onClick={() => onChangeMonth(1)}
            className="flex size-12 shrink-0 items-center justify-center rounded-xl
              text-[var(--text-1)] active:bg-[var(--surface-1)]"
          >
            <ArrowLeftIcon className="rotate-180" />
          </button>
        </div>

        <div
          aria-label={t('history.calendarGrid', { month: monthLabel })}
          data-tutorial-id="history-calendar-grid"
          aria-busy={completedWorkoutTimestamps === undefined}
          className="overflow-x-auto rounded-2xl"
        >
          <div
            className="grid min-w-[21rem] grid-cols-7 overflow-hidden rounded-2xl
              border border-[var(--border)]"
          >
            {WEEKDAY_KEYS.map((key, index) => (
              <div
                key={key}
                className={`label-xs flex h-9 items-center justify-center bg-[var(--surface-1)]
                  font-semibold text-[var(--text-2)] ${
                    index < 6 ? 'border-r border-[var(--border)]' : ''
                  }`}
              >
                {t(key)}
              </div>
            ))}

            {days.map((day, index) => {
              const selected = day.timestamp === selectedDay;
              return (
                <button
                  key={day.timestamp}
                  type="button"
                  aria-label={
                    day.hasWorkout
                      ? t('history.workoutDay', {
                          date: dayFormatter.format(day.timestamp),
                        })
                      : dayFormatter.format(day.timestamp)
                  }
                  aria-pressed={selected}
                  onClick={() => onSelectDay(day.timestamp)}
                  className={`relative flex min-h-12 min-w-12 items-center justify-center
                    border-t border-r border-[var(--border)] text-sm font-semibold
                    transition-colors duration-[var(--dur-1)]
                    ease-[var(--ease-mech)] ${
                      selected
                        ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                        : day.inCurrentMonth
                          ? 'bg-[var(--surface-1)] text-[var(--text-1)] active:bg-[var(--surface-2)]'
                          : 'bg-[var(--surface-0)] text-[var(--text-2)] active:bg-[var(--surface-2)]'
                    } ${index % 7 === 6 ? 'border-r-0' : ''}`}
                >
                  <span className="tabular">{day.dayOfMonth}</span>
                  {day.hasWorkout && (
                    <span
                      aria-hidden="true"
                      className={`absolute bottom-1.5 size-1.5 rounded-full ${
                        selected
                          ? 'bg-[var(--color-accent-fg)]'
                          : 'bg-[var(--color-accent)]'
                      }`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {selectedDay !== undefined && (
        <section aria-labelledby="history-selected-day-title">
          <h2
            id="history-selected-day-title"
            className="label-xs mb-3 px-1 font-semibold capitalize text-[var(--text-2)]"
          >
            {dayFormatter.format(selectedDay)}
          </h2>

          {selectedDayWorkouts === undefined ? (
            <div
              aria-hidden="true"
              className="h-28 animate-pulse rounded-2xl bg-[var(--surface-1)]"
            />
          ) : selectedDayWorkouts.length === 0 ? (
            <Card padded>
              <p className="text-sm leading-relaxed text-[var(--text-2)]">
                {t('history.emptyDay')}
              </p>
            </Card>
          ) : (
            <HistoryWorkoutSummaryList items={selectedDayWorkouts} />
          )}
        </section>
      )}
    </div>
  );
}
