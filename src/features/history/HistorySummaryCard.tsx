import type { WeeklyRegularity } from '@/lib/history';
import { t } from '@/i18n/fr';
import { Card } from '@/ui';

interface Props {
  regularity: WeeklyRegularity;
  onEditGoal: () => void;
}

export function HistorySummaryCard({ regularity, onEditGoal }: Props) {
  const { currentCompleted, currentGoal, streak } = regularity;
  const progress =
    currentGoal === null ? 0 : Math.min(currentCompleted / currentGoal, 1);

  return (
    <section aria-labelledby="history-regularity-title">
      <h2
        id="history-regularity-title"
        className="label-xs mb-3 px-1 font-semibold text-[var(--text-2)]"
      >
        {t('history.regularity')}
      </h2>

      <Card>
        <div className="grid grid-cols-2">
          <div className="flex min-h-28 flex-col justify-between p-4">
            <p className="metric text-4xl leading-none font-semibold text-[var(--text-1)]">
              {streak}
            </p>
            <p className="mt-3 text-sm font-medium text-[var(--text-2)]">
              {t(streak === 1 ? 'history.streakOne' : 'history.streak')}
            </p>
          </div>

          <button
            type="button"
            onClick={onEditGoal}
            className="flex min-h-28 flex-col justify-between border-l border-[var(--border)]
              p-4 text-left active:bg-[var(--surface-2)]"
          >
            <span className="metric text-2xl leading-none font-semibold text-[var(--text-1)]">
              {currentGoal === null
                ? t('history.defineGoal')
                : `${currentCompleted} / ${currentGoal}`}
            </span>
            <span className="mt-3 text-sm font-medium text-[var(--text-2)]">
              {t('history.weeklyGoal')}
            </span>

            {currentGoal !== null && (
              <span
                aria-hidden="true"
                className="mt-3 block h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]"
              >
                <span
                  className="block h-full origin-left rounded-full bg-[var(--color-accent)]"
                  style={{ transform: `scaleX(${progress})` }}
                />
              </span>
            )}
          </button>
        </div>

        {currentGoal === null && (
          <p className="border-t border-[var(--border)] px-4 py-3 text-sm leading-relaxed text-[var(--text-2)]">
            {t('history.goalPrompt')}
          </p>
        )}
      </Card>
    </section>
  );
}
