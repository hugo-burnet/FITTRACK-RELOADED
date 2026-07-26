import { t } from '@/i18n/fr';
import { moveItem } from '@/lib/routineOrder';
import { AddRow, ReorderableList, Textarea, type ItemState } from '@/ui';
import { CloseIcon, GripIcon } from '@/ui/icons';
import {
  newHistorySetDraft,
  type HistoryExerciseDraft,
} from './historyDraft';
import { HistorySetEditor } from './HistorySetEditor';

type Props = {
  exercise: HistoryExerciseDraft;
  state: ItemState;
  onChange: (exercise: HistoryExerciseDraft) => void;
  onRemove: () => void;
};

export function HistoryExerciseEditor({
  exercise,
  state,
  onChange,
  onRemove,
}: Props) {
  return (
    <article
      className={`overflow-hidden rounded-2xl transition-colors duration-[var(--dur-1)]
        ${
          state.dragging
            ? 'bg-[var(--surface-2)] ring-2 ring-[var(--accent-ink)]'
            : 'bg-[var(--surface-1)]'
        }`}
    >
      <header className="flex min-h-14 items-stretch border-b border-[var(--border)]">
        <button
          type="button"
          aria-label={t('history.editDragExercise', { name: exercise.exerciseName })}
          className="flex w-12 shrink-0 cursor-grab items-center justify-center
            text-[var(--text-2)] active:cursor-grabbing"
          {...state.handleProps}
        >
          <GripIcon />
        </button>

        <div className="flex min-w-0 flex-1 items-center py-3">
          <h2 className="truncate text-base font-semibold text-[var(--text-1)]">
            {exercise.exerciseName}
          </h2>
        </div>

        <button
          type="button"
          aria-label={t('history.editRemoveExercise')}
          onClick={onRemove}
          className="flex w-12 shrink-0 items-center justify-center text-[var(--danger-ink)]
            active:bg-[var(--surface-2)]"
        >
          <CloseIcon />
        </button>
      </header>

      <div className="border-b border-[var(--border)] p-4">
        <Textarea
          label={t('history.editExerciseNotes')}
          rows={2}
          value={exercise.notes ?? ''}
          onChange={(event) =>
            onChange({
              ...exercise,
              notes: event.target.value === '' ? undefined : event.target.value,
            })
          }
        />
      </div>

      {exercise.sets.length > 0 && (
        <ReorderableList
          className="flex flex-col gap-2 p-3"
          items={exercise.sets}
          keyOf={(set) => set.draftId}
          onReorder={(from, to) =>
            onChange({ ...exercise, sets: moveItem(exercise.sets, from, to) })
          }
          renderItem={(set, index, setState) => (
            <HistorySetEditor
              set={set}
              number={index + 1}
              measurementType={exercise.measurementType}
              state={setState}
              onChange={(nextSet) =>
                onChange({
                  ...exercise,
                  sets: exercise.sets.map((candidate) =>
                    candidate.draftId === nextSet.draftId ? nextSet : candidate,
                  ),
                })
              }
              onRemove={() =>
                onChange({
                  ...exercise,
                  sets: exercise.sets.filter(
                    (candidate) => candidate.draftId !== set.draftId,
                  ),
                })
              }
            />
          )}
        />
      )}

      <div className="border-t border-[var(--border)]">
        <AddRow
          label={t('history.editAddSet')}
          onClick={() =>
            onChange({
              ...exercise,
              sets: [...exercise.sets, newHistorySetDraft()],
            })
          }
        />
      </div>
    </article>
  );
}
