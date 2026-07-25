import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import {
  listCompletedWorkoutTimestamps,
  listHistoryPage,
} from '@/data/repositories/history';
import {
  getWeeklyTrainingGoalHistory,
  setWeeklyTrainingGoal,
} from '@/data/repositories/settings';
import { t } from '@/i18n/fr';
import { calculateWeeklyRegularity } from '@/lib/history';
import { HistoryJournal } from './HistoryJournal';
import { HistorySummaryCard } from './HistorySummaryCard';
import { WeeklyGoalSheet } from './WeeklyGoalSheet';

export function HistoryScreen() {
  const [openedAt] = useState(() => Date.now());
  const [pageSize, setPageSize] = useState(20);
  const [goalOpen, setGoalOpen] = useState(false);
  const [goalDraft, setGoalDraft] = useState<number | undefined>();

  const timestamps = useLiveQuery(() => listCompletedWorkoutTimestamps(), []);
  const goalHistory = useLiveQuery(getWeeklyTrainingGoalHistory, []);
  const page = useLiveQuery(() => listHistoryPage({}, 0, pageSize), [pageSize]);

  const regularity = calculateWeeklyRegularity(
    timestamps ?? [],
    goalHistory ?? [],
    openedAt,
  );

  const openGoal = () => {
    setGoalDraft(regularity.currentGoal ?? undefined);
    setGoalOpen(true);
  };

  return (
    <Screen title={t('history.title')}>
      <div className="space-y-7">
        <HistorySummaryCard regularity={regularity} onEditGoal={openGoal} />

        <section aria-labelledby="history-journal-title">
          <h2
            id="history-journal-title"
            className="label-xs mb-3 px-1 font-semibold text-[var(--text-2)]"
          >
            {t('history.journal')}
          </h2>
          <HistoryJournal
            page={page}
            onShowMore={() => setPageSize((current) => current + 20)}
          />
        </section>
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
