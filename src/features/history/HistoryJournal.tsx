import type { HistoryPage, HistoryWorkoutSummary } from '@/data/repositories/history';
import { useTutorialControls } from '@/features/tutorial/tutorialContext';
import { t } from '@/i18n/fr';
import { Button, Card, EmptyState } from '@/ui';
import { ChevronRightIcon } from '@/ui/icons';
import { Link } from 'react-router-dom';

interface Props {
  page: HistoryPage | undefined;
  filterExerciseName?: string;
  onClearExercise: () => void;
  onShowMore: () => void;
}

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function formatDuration(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} ${t('units.minutes')}`;

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0
    ? `${hours} h`
    : `${hours} h ${String(remainder).padStart(2, '0')}`;
}

function countLabel(
  count: number,
  singular: 'history.exerciseCountOne' | 'history.setCountOne',
  plural: 'history.exerciseCount' | 'history.setCount',
): string {
  return count === 1 ? t(singular) : t(plural, { count });
}

function WorkoutRow({
  summary,
  first = false,
}: {
  summary: HistoryWorkoutSummary;
  first?: boolean;
}) {
  const tutorial = useTutorialControls();
  return (
    <article className="border-b border-[var(--border)] last:border-b-0">
      <Link
        viewTransition
        to={`/history/${summary.workoutId}`}
        /* La première ligne seulement : une consigne qui dit « ouvre la
           séance » doit en désigner une, pas la liste entière. */
        data-tutorial-id={first ? 'history-first-workout' : undefined}
        onClick={() =>
          tutorial?.report({ type: 'history-workout-opened', workoutId: summary.workoutId })
        }
        className="flex min-h-12 w-full items-center gap-3 px-4 py-4 text-left
          transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-[var(--text-1)]">
                {summary.name}
              </h3>
              <p className="mt-1 text-sm capitalize text-[var(--text-2)]">
                {dateFormatter.format(summary.startedAt)}
              </p>
            </div>
            <p className="metric shrink-0 text-sm font-semibold text-[var(--text-2)]">
              {formatDuration(summary.durationSeconds)}
            </p>
          </div>
          <p className="mt-3 text-sm text-[var(--text-2)]">
            {countLabel(
              summary.exerciseCount,
              'history.exerciseCountOne',
              'history.exerciseCount',
            )}
            <span aria-hidden="true"> · </span>
            {countLabel(
              summary.completedSetCount,
              'history.setCountOne',
              'history.setCount',
            )}
          </p>
        </div>
        <span className="shrink-0 text-[var(--text-2)]">
          <ChevronRightIcon />
        </span>
      </Link>
    </article>
  );
}

export function HistoryWorkoutSummaryList({
  items,
}: {
  items: readonly HistoryWorkoutSummary[];
}) {
  return (
    <Card>
      {items.map((summary, index) => (
        <WorkoutRow key={summary.workoutId} summary={summary} first={index === 0} />
      ))}
    </Card>
  );
}

export function HistoryJournal({
  page,
  filterExerciseName,
  onClearExercise,
  onShowMore,
}: Props) {
  if (page === undefined) {
    return (
      <div aria-hidden="true" className="space-y-3">
        <div className="h-28 animate-pulse rounded-2xl bg-[var(--surface-1)]" />
        <div className="h-28 animate-pulse rounded-2xl bg-[var(--surface-1)]" />
      </div>
    );
  }

  if (page.items.length === 0) {
    const filtered = filterExerciseName !== undefined;

    return (
      <div className="flex min-h-80 flex-1 justify-center">
        <EmptyState
          reading="0"
          unit={t('units.workouts')}
          body={
            filtered
              ? t('history.filteredEmptyBody', {
                  exercise: filterExerciseName,
                })
              : t('history.emptyBody')
          }
          action={
            filtered ? (
              <Button variant="secondary" fullWidth onClick={onClearExercise}>
                {t('history.showAllExercises')}
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <HistoryWorkoutSummaryList items={page.items} />

      {page.hasMore && (
        <Button variant="secondary" fullWidth onClick={onShowMore}>
          {t('history.showMore')}
        </Button>
      )}
    </div>
  );
}
