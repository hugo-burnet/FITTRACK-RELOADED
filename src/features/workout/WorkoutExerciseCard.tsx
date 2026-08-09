import { Fragment, useState } from 'react';
import {
  workoutExerciseIdentityOf,
  type WorkoutExerciseDetail,
  type SetValues,
} from '@/data/repositories/workouts';
import type { WorkoutSet } from '@/data/types';
import { t } from '@/i18n/fr';
import { exerciseSubtitle, unitLabel } from '@/i18n/labels';
import { entryColumns } from '@/lib/measurement';
import type { RecordKind } from '@/lib/records';
import type { SupersetPlace } from '@/lib/routineOrder';
import { AddRow, SwipeToDelete, UndoRow } from '@/ui';
import type { ItemState } from '@/ui';
import { CheckIcon, ChevronDownIcon, GripIcon, MoreIcon, PlateIcon, StarIcon } from '@/ui/icons';
import { RecordNote } from './RecordNote';
import { RestRail, RestStatus } from './RestRail';
import { WorkoutSetRow } from './WorkoutSetRow';
import type { WorkoutFoldCommand } from './workoutFold';
import { setReading } from './summary';

type DeletedSet = { setId: string; rank: number; reading: string };

export type CardRest = { setId: string; startedAt: number; endsAt: number; onDone: () => void };

type Props = {
  line: WorkoutExerciseDetail;
  superset?: SupersetPlace;
  rest: CardRest | null;
  /** Records are derived, never persisted. */
  records: Map<string, RecordKind>;
  state: ItemState;
  foldCommand: WorkoutFoldCommand;
  onMenu: () => void;
  onPlates?: () => void;
  onSetMenu: (set: WorkoutSet, number: number) => void;
  onWrite: (setId: string, values: Partial<SetValues>) => void;
  onComplete: (setId: string, values: Partial<SetValues>, set: WorkoutSet) => void;
  onUncomplete: (setId: string) => void;
  onDeleteSet: (setId: string) => void;
  onRestoreSet: (setId: string) => void;
  onAddSet: () => void;
};

const alternationMark = (index: number): string => String.fromCharCode(65 + index);

const WIDTH = { first: '4.75rem', second: '3.5rem' } as const;

/** Live-workout exercise card with set entry, records, rest, and supersets. */
export function WorkoutExerciseCard({
  line,
  superset,
  rest,
  records,
  state,
  foldCommand,
  onMenu,
  onPlates,
  onSetMenu,
  onWrite,
  onComplete,
  onUncomplete,
  onDeleteSet,
  onRestoreSet,
  onAddSet,
}: Props) {
  const { row, exercise, sets, previous } = line;
  const identity = workoutExerciseIdentityOf(line);
  const name = identity.name ?? t('workout.deletedExercise');
  const columns = entryColumns(identity.measurementType);

  const first = superset !== undefined && superset.index === 0;
  const last = superset !== undefined && superset.index === superset.size - 1;

  const allDone = sets.length > 0 && sets.every((set) => set.isCompleted === 1);

  // Convergent render-time adjustment prevents one stale expanded frame.
  const [expanded, setExpanded] = useState(!allDone);
  const [wasAllDone, setWasAllDone] = useState(allDone);
  const [seenFoldVersion, setSeenFoldVersion] = useState(
    foldCommand.version,
  );
  if (foldCommand.version !== seenFoldVersion) {
    setSeenFoldVersion(foldCommand.version);
    setWasAllDone(allDone);
    setExpanded(foldCommand.expanded);
  } else if (allDone !== wasAllDone) {
    setWasAllDone(allDone);
    setExpanded(!allDone);
  }

  const lastSet = sets.length > 0 ? sets[sets.length - 1] : undefined;
  const doneReading = lastSet !== undefined ? setReading(lastSet, columns) : '';

  // Preserve record feedback when completing a set folds the card.
  const hasRecord = sets.some((set) => records.has(set.id));

  const [deleted, setDeleted] = useState<DeletedSet | null>(null);

  const undoRow = deleted === null ? null : (
    <UndoRow
      reading={deleted.reading}
      onUndo={() => {
        setDeleted(null);
        onRestoreSet(deleted.setId);
      }}
      onExpire={() => setDeleted(null)}
    />
  );

  return (
    <div className={`relative ${superset === undefined ? '' : 'pl-3'}`}>
      {superset !== undefined && (
        <span
          aria-hidden="true"
          className={`absolute top-0 left-0 w-[3px] bg-[var(--accent-ink)]
            ${first ? 'rounded-t-full' : ''} ${last ? 'rounded-b-full' : ''}`}
          // Extend through the list gap to keep the superset bracket continuous.
          style={{ bottom: last ? 0 : '-0.75rem' }}
        />
      )}

      <div
        className={`relative overflow-hidden rounded-2xl transition-colors duration-[var(--dur-1)]
          ${
            state.dragging
              ? 'bg-[var(--accent-soft)] ring-2 ring-[var(--accent-ink)]'
              : expanded
                ? 'bg-[var(--surface-1)]'
                : 'bg-[var(--surface-2)]'
          }`}
      >
        <div
          className={`relative flex items-stretch
            ${expanded ? 'border-b border-[var(--border)]' : ''}`}
        >
          <button
            type="button"
            aria-label={t('routines.dragHandle', { name })}
            className="flex w-11 shrink-0 cursor-grab items-center justify-center
              text-[var(--text-2)] active:cursor-grabbing"
            {...state.handleProps}
          >
            <GripIcon />
          </button>

          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((open) => !open)}
            className="flex min-w-0 flex-1 items-center gap-2 py-3 pr-1 text-left"
          >
            {!expanded && allDone && <CheckIcon className="shrink-0 text-[var(--accent-ink)]" />}
            <span className="flex min-w-0 flex-1 flex-col justify-center gap-1">
              <span className="flex min-w-0 items-baseline gap-2">
                {superset !== undefined && (
                  <span className="label-xs shrink-0 font-semibold text-[var(--accent-ink)]">
                    {alternationMark(superset.index)}
                  </span>
                )}
                <span
                  className={`min-w-0 truncate text-base ${
                    expanded ? 'text-[var(--text-1)]' : 'text-[var(--text-2)]'
                  }`}
                >
                  {name}
                </span>
                {!expanded && hasRecord && (
                  <StarIcon
                    width={16}
                    height={16}
                    role="img"
                    aria-hidden={false}
                    aria-label={t('workout.recordFolded')}
                    className="shrink-0 text-[var(--accent-ink)]"
                  />
                )}
              </span>
              {rest !== null ? (
                <RestStatus endsAt={rest.endsAt} />
              ) : expanded ? (
                exercise !== undefined && (
                  <span className="truncate text-sm text-[var(--text-2)]">
                    {exerciseSubtitle(exercise)}
                  </span>
                )
              ) : (
                doneReading !== '' && (
                  <span className="metric truncate text-sm text-[var(--text-2)]">
                    {doneReading}
                  </span>
                )
              )}
            </span>
            <ChevronDownIcon
              className={`shrink-0 text-[var(--text-2)] transition-transform
                duration-[var(--dur-1)] ${expanded ? '' : '-rotate-90'}`}
            />
          </button>

          {onPlates !== undefined && (
            <button
              type="button"
              aria-label={t('workout.plates')}
              onClick={onPlates}
              className="flex w-11 shrink-0 items-center justify-center text-[var(--text-2)]
                transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]"
            >
              <PlateIcon width={20} height={20} />
            </button>
          )}

          <button
            type="button"
            aria-label={t('workout.exerciseMenu', { name })}
            onClick={onMenu}
            className="flex w-12 shrink-0 items-center justify-center text-[var(--text-2)]
              transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]"
          >
            <MoreIcon />
          </button>

          {rest !== null && (
            <RestRail
              key={rest.setId}
              startedAt={rest.startedAt}
              endsAt={rest.endsAt}
              onDone={rest.onDone}
            />
          )}
        </div>

        {expanded && (
          <>
            {row.notes !== undefined && row.notes !== '' && (
              <p className="border-b border-[var(--border)] px-4 py-2 text-sm leading-relaxed
                text-[var(--text-2)]">
                {row.notes}
              </p>
            )}

            <div className="flex items-center gap-1.5 px-2 pt-2 pb-1">
              <span className="w-12 shrink-0" />
              <span className="label-xs min-w-0 flex-1 text-center font-semibold text-[var(--text-2)]">
                {t('workout.previous')}
              </span>
              {columns.map((column, index) => (
                <span
                  key={column.field}
                  style={{ width: index === 0 ? WIDTH.first : WIDTH.second }}
                  className={`shrink-0 text-center font-semibold text-[var(--text-2)] ${
                    column.unit === 'reps' ? 'label-xs' : 'text-[0.6875rem] tracking-[0.08em]'
                  }`}
                >
                  {column.prefix}
                  {unitLabel(column.unit)}
                </span>
              ))}
              <span className="w-12 shrink-0" />
            </div>

            {sets.map((set, index) => {
              const record = records.get(set.id);
              return (
              <Fragment key={set.id}>
                {deleted?.rank === index && undoRow}
                <SwipeToDelete
                  label={t('workout.swipeDelete')}
                  onDelete={() => {
                    setDeleted({
                      setId: set.id,
                      rank: index,
                      reading:
                        setReading(set, columns) ||
                        t('workout.emptySetReading', { number: index + 1 }),
                    });
                    onDeleteSet(set.id);
                  }}
                >
                  <WorkoutSetRow
                    set={set}
                    number={index + 1}
                    columns={columns}
                    previous={previous[index]}
                    onWrite={(values) => onWrite(set.id, values)}
                    onComplete={(values) => onComplete(set.id, values, set)}
                    onUncomplete={() => onUncomplete(set.id)}
                    onMenu={() => onSetMenu(set, index + 1)}
                  />
                  {record !== undefined && <RecordNote kind={record} />}
                </SwipeToDelete>
              </Fragment>
              );
            })}

            {deleted !== null && deleted.rank >= sets.length && undoRow}

            <AddRow label={t('workout.addSet')} onClick={onAddSet} />
          </>
        )}
      </div>
    </div>
  );
}
