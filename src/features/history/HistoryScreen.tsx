import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation, useNavigate } from 'react-router-dom';
import { Screen } from '@/app/Screen';
import {
  listCompletedWorkoutTimestamps,
  listHistoryDay,
  listHistoryExerciseOptions,
  listHistoryPage,
} from '@/data/repositories/history';
import {
  getWeeklyTrainingGoalHistory,
  setWeeklyTrainingGoal,
} from '@/data/repositories/settings';
import { t } from '@/i18n/fr';
import { calculateWeeklyRegularity } from '@/lib/history';
import { Card, HeaderAction } from '@/ui';
import { ImportIcon, TrendIcon } from '@/ui/icons';
import { HistoryCalendar } from './HistoryCalendar';
import { HistoryExerciseFilter } from './HistoryExerciseFilter';
import { HistoryJournal } from './HistoryJournal';
import { HistorySummaryCard } from './HistorySummaryCard';
import { WeeklyGoalSheet } from './WeeklyGoalSheet';

type HistoryView = 'journal' | 'calendar';
type HistoryNotice = 'deleted' | 'missing' | 'imported';

function readHistoryNotice(state: unknown): HistoryNotice | undefined {
  if (state === null || typeof state !== 'object') return undefined;
  const notice = (state as { historyNotice?: unknown }).historyNotice;
  return notice === 'deleted' ||
    notice === 'missing' ||
    notice === 'imported'
    ? notice
    : undefined;
}

export function HistoryScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const [historyNotice] = useState(() => readHistoryNotice(location.state));
  const [openedAt] = useState(() => Date.now());
  const [view, setView] = useState<HistoryView>('journal');
  const [exerciseId, setExerciseId] = useState<string>();
  const [pageSize, setPageSize] = useState(20);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState<number | undefined>();
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1).getTime();
  });
  const [selectedDay, setSelectedDay] = useState<number>();

  useEffect(() => {
    if (historyNotice === undefined) return;
    void navigate(location.pathname, { replace: true, state: null });
  }, [historyNotice, location.pathname, navigate]);

  const timestamps = useLiveQuery(() => listCompletedWorkoutTimestamps(), []);
  const filteredTimestamps = useLiveQuery(
    () => listCompletedWorkoutTimestamps({ exerciseId }),
    [exerciseId],
  );
  const exerciseOptions = useLiveQuery(listHistoryExerciseOptions, []);
  const selectedExerciseName = exerciseOptions?.find(
    (option) => option.id === exerciseId,
  )?.name;
  const goalHistory = useLiveQuery(getWeeklyTrainingGoalHistory, []);
  const page = useLiveQuery(
    () => listHistoryPage({ exerciseId }, 0, pageSize),
    [exerciseId, pageSize],
  );
  const selectedDayWorkouts = useLiveQuery(
    () =>
      selectedDay === undefined
        ? Promise.resolve(undefined)
        : listHistoryDay({ exerciseId }, selectedDay),
    [exerciseId, selectedDay],
  );

  const regularity = calculateWeeklyRegularity(
    timestamps ?? [],
    goalHistory ?? [],
    openedAt,
  );

  const openGoal = () => {
    setGoalDraft(regularity.currentGoal ?? undefined);
    setGoalOpen(true);
  };

  const changeMonth = (amount: number) => {
    setVisibleMonth((current) => {
      const month = new Date(current);
      return new Date(
        month.getFullYear(),
        month.getMonth() + amount,
        1,
      ).getTime();
    });
    setSelectedDay(undefined);
  };

  const changeExercise = (nextExerciseId: string | undefined) => {
    setExerciseId(nextExerciseId);
    setPageSize(20);
  };

  return (
    <Screen
      title={t('history.title')}
      action={
        // Deux actions, pas un onglet de plus : la barre du bas en compte cinq
        // depuis le Lot 1, et les analyses lisent l'historique qu'on regarde.
        <div className="flex shrink-0 items-center">
          <HeaderAction
            label={t('analytics.action')}
            onClick={() => void navigate('/analytics')}
          >
            <TrendIcon />
          </HeaderAction>
          <HeaderAction
            label={t('history.importAction')}
            onClick={() => void navigate('/history/import')}
          >
            <ImportIcon />
          </HeaderAction>
        </div>
      }
    >
      <div className="space-y-7">
        {historyNotice !== undefined && (
          <div role="status">
            <Card padded>
              <p className="text-sm leading-relaxed text-[var(--text-1)]">
                {t(
                  historyNotice === 'deleted'
                    ? 'history.deletedNotice'
                    : historyNotice === 'missing'
                      ? 'history.missingNotice'
                      : 'history.importedNotice',
                )}
              </p>
            </Card>
          </div>
        )}

        <HistorySummaryCard regularity={regularity} onEditGoal={openGoal} />

        <div className="space-y-3">
          <div
            role="group"
            aria-label={t('history.viewSelector')}
            className="grid grid-cols-2"
          >
            {(['journal', 'calendar'] as const).map((option) => {
              const active = view === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setView(option)}
                  className={`relative min-h-12 px-3 text-base font-semibold
                    transition-colors duration-[var(--dur-1)] ease-[var(--ease-mech)]
                    active:opacity-70 ${
                      active
                        ? 'text-[var(--accent-ink)]'
                        : 'text-[var(--text-2)]'
                    }`}
                >
                  {t(
                    option === 'journal'
                      ? 'history.journal'
                      : 'history.calendar',
                  )}
                  <span
                    aria-hidden="true"
                    className={`absolute bottom-0 left-1/2 h-[3px] w-5 -translate-x-1/2
                      rounded-t-full bg-[var(--accent-ink)] transition-transform
                      duration-[var(--dur-1)] ease-[var(--ease-mech)]
                      ${active ? 'scale-x-100' : 'scale-x-0'}`}
                  />
                </button>
              );
            })}
          </div>

          <HistoryExerciseFilter
            options={exerciseOptions}
            value={exerciseId}
            onChange={changeExercise}
          />
        </div>

        {view === 'journal' ? (
          <section aria-labelledby="history-journal-title">
            <h2
              id="history-journal-title"
              className="label-xs mb-3 px-1 font-semibold text-[var(--text-2)]"
            >
              {t('history.journal')}
            </h2>
            <HistoryJournal
              page={page}
              filterExerciseName={selectedExerciseName}
              onClearExercise={() => changeExercise(undefined)}
              onShowMore={() => setPageSize((current) => current + 20)}
            />
          </section>
        ) : (
          <HistoryCalendar
            visibleMonth={visibleMonth}
            completedWorkoutTimestamps={filteredTimestamps}
            selectedDay={selectedDay}
            selectedDayWorkouts={selectedDayWorkouts}
            onChangeMonth={changeMonth}
            onSelectDay={setSelectedDay}
          />
        )}
      </div>

      <WeeklyGoalSheet
        open={goalOpen}
        value={goalDraft}
        onChange={setGoalDraft}
        onClose={() => setGoalOpen(false)}
        onSave={() => {
          if (goalDraft === undefined) return;
          void setWeeklyTrainingGoal(goalDraft).then(() => setGoalOpen(false));
        }}
      />
    </Screen>
  );
}
