import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { listExercises } from '@/data/repositories/exercises';
import { t } from '@/i18n/fr';
import { exerciseSubtitle } from '@/i18n/labels';
import { Input, Sheet } from '@/ui';
import {
  newHistoryExerciseDraft,
  type HistoryExerciseDraft,
} from './historyDraft';

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (exercise: HistoryExerciseDraft) => void;
};

export function HistoryExercisePickerSheet({ open, onClose, onSelect }: Props) {
  const [search, setSearch] = useState('');
  const exercises = useLiveQuery(
    () => listExercises({ search }),
    [search],
  );

  return (
    <Sheet open={open} onClose={onClose} title={t('history.editExercisePicker')}>
      <div className="flex flex-col gap-4">
        <Input
          label={t('history.editExerciseSearch')}
          labelHidden
          type="search"
          inputMode="search"
          enterKeyHint="search"
          value={search}
          placeholder={t('history.editExerciseSearchPlaceholder')}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="-mx-5 border-t border-[var(--border)]">
          {exercises === undefined ? (
            <div aria-hidden="true" className="space-y-px">
              {[0, 1, 2, 3].map((row) => (
                <div
                  key={row}
                  className="h-14 animate-pulse border-b border-[var(--border)]
                    bg-[var(--surface-2)]"
                />
              ))}
            </div>
          ) : exercises.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[var(--text-2)]">
              {t('history.editNoExercise')}
            </p>
          ) : (
            exercises.map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                onClick={() => {
                  onSelect(newHistoryExerciseDraft(exercise));
                  setSearch('');
                  onClose();
                }}
                className="flex min-h-14 w-full flex-col justify-center border-b
                  border-[var(--border)] px-5 py-2 text-left last:border-b-0
                  active:bg-[var(--surface-2)]"
              >
                <span className="text-base text-[var(--text-1)]">{exercise.name}</span>
                <span className="mt-0.5 text-sm text-[var(--text-2)]">
                  {exerciseSubtitle(exercise)}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </Sheet>
  );
}
