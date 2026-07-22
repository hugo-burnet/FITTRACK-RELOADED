import { Fragment, useState } from 'react';
import type { WorkoutExerciseDetail, SetValues } from '@/data/repositories/workouts';
import type { WorkoutSet } from '@/data/types';
import { t } from '@/i18n/fr';
import { exerciseSubtitle, unitLabel } from '@/i18n/labels';
import { entryColumns } from '@/lib/measurement';
import { AddRow, SwipeToDelete, UndoRow } from '@/ui';
import type { ItemState } from '@/ui';
import { GripIcon, MoreIcon } from '@/ui/icons';
import { WorkoutSetRow } from './WorkoutSetRow';
import { setReading } from './summary';

/** A set that has just gone, and the slot it is still allowed to come back to. */
type DeletedSet = { setId: string; rank: number; reading: string };

/** Where this exercise sits in its superset. Absent = not in one. */
export type SupersetPlace = { index: number; size: number };

type Props = {
  line: WorkoutExerciseDetail;
  superset?: SupersetPlace;
  state: ItemState;
  onMenu: () => void;
  onSetMenu: (set: WorkoutSet, number: number) => void;
  onWrite: (setId: string, values: Partial<SetValues>) => void;
  onComplete: (setId: string, values: Partial<SetValues>) => void;
  onUncomplete: (setId: string) => void;
  onDeleteSet: (setId: string) => void;
  onRestoreSet: (setId: string) => void;
  onAddSet: () => void;
};

/** A, B, C — the order you alternate in, which is what a superset is. */
const alternationMark = (index: number): string => String.fromCharCode(65 + index);

/** Same widths as the row, so the headings sit over the fields they name. */
const WIDTH = { first: '4.75rem', second: '3.5rem' } as const;

/**
 * One exercise of the session in progress: its identity, its grid, and the way
 * into everything else about it.
 *
 * The headings row is what lets the "précédent" cell drop its units: the figures
 * below it sit in the same columns as the fields, so "102,5 × 5" reads against
 * "kg" and "reps" once, at the top, instead of on every line. On 375 px that is
 * the difference between a grid and a wall of text.
 *
 * The superset rule and marks are the Lot 4 ones, unchanged — the accent rule
 * bridged across the gap plus an A / B / C on each member, because an accent
 * alone cannot carry meaning in sunlight or to an eye that does not separate it
 * from the surface.
 */
export function WorkoutExerciseCard({
  line,
  superset,
  state,
  onMenu,
  onSetMenu,
  onWrite,
  onComplete,
  onUncomplete,
  onDeleteSet,
  onRestoreSet,
  onAddSet,
}: Props) {
  const { row, exercise, sets, previous } = line;
  const name = exercise?.name ?? t('workout.deletedExercise');
  // A deleted exercise still has sets to show; weight_reps is the shape that
  // lets them read at all rather than vanish.
  const columns = entryColumns(exercise?.measurementType ?? 'weight_reps');

  const first = superset !== undefined && superset.index === 0;
  const last = superset !== undefined && superset.index === superset.size - 1;

  /**
   * One slot at a time. Swiping a second row closes the first offer — the
   * deletion is written either way, so what expires is the shortcut back, not
   * the data.
   */
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
          // INK, not fill: this rule has to be legible against the surface, it does
          // not carry --color-accent-fg on top of it. The raw accent measured 1,29:1
          // on the light page — invisible — against 5,23:1 here. cf. index.css.
          className={`absolute top-0 left-0 w-[3px] bg-[var(--accent-ink)]
            ${first ? 'rounded-t-full' : ''} ${last ? 'rounded-b-full' : ''}`}
          // Runs into the gap on every member but the last, so the bracket is
          // continuous rather than a stack of dashes. -0.75rem is the `gap-3` of
          // the list in WorkoutScreen — the two have to agree.
          style={{ bottom: last ? 0 : '-0.75rem' }}
        />
      )}

      <div
        className={`overflow-hidden rounded-2xl transition-colors duration-[var(--dur-1)]
          ${
            state.dragging
              ? 'bg-[var(--surface-2)] ring-2 ring-[var(--accent-ink)]'
              : 'bg-[var(--surface-1)]'
          }`}
      >
        <div className="flex items-stretch border-b border-[var(--border)]">
          <button
            type="button"
            aria-label={t('routines.dragHandle', { name })}
            className="flex w-11 shrink-0 cursor-grab items-center justify-center
              text-[var(--text-2)] active:cursor-grabbing"
            {...state.handleProps}
          >
            <GripIcon />
          </button>

          <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-3">
            <span className="flex min-w-0 items-baseline gap-2">
              {superset !== undefined && (
                <span className="label-xs shrink-0 font-semibold text-[var(--accent-ink)]">
                  {alternationMark(superset.index)}
                </span>
              )}
              <span className="min-w-0 truncate text-base text-[var(--text-1)]">{name}</span>
            </span>
            {exercise !== undefined && (
              <span className="truncate text-sm text-[var(--text-2)]">
                {exerciseSubtitle(exercise)}
              </span>
            )}
          </span>

          <button
            type="button"
            aria-label={t('workout.exerciseMenu', { name })}
            onClick={onMenu}
            className="flex w-12 shrink-0 items-center justify-center text-[var(--text-2)]
              transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]"
          >
            <MoreIcon />
          </button>
        </div>

        {row.notes !== undefined && row.notes !== '' && (
          <p className="border-b border-[var(--border)] px-4 py-2 text-sm leading-relaxed
            text-[var(--text-2)]">
            {row.notes}
          </p>
        )}

        {/* The headings. Engraved register, except on SI symbols: it is "kg",
            never "KG" (Lot 1 rule). */}
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
                column.unit === 'reps'
                  ? 'label-xs'
                  : 'text-[0.6875rem] tracking-[0.08em]'
              }`}
            >
              {column.prefix}
              {unitLabel(column.unit)}
            </span>
          ))}
          <span className="w-12 shrink-0" />
        </div>

        {sets.map((set, index) => (
          <Fragment key={set.id}>
            {/* Le bandeau reprend le rang de la disparue : celle qui occupait
                cette place est maintenant ici, donc le bandeau passe devant. */}
            {deleted?.rank === index && undoRow}
            <SwipeToDelete
              label={t('workout.swipeDelete')}
              onDelete={() => {
                setDeleted({
                  setId: set.id,
                  rank: index,
                  reading:
                    setReading(set, columns) || t('workout.emptySetReading', { number: index + 1 }),
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
                onComplete={(values) => onComplete(set.id, values)}
                onUncomplete={() => onUncomplete(set.id)}
                onMenu={() => onSetMenu(set, index + 1)}
              />
            </SwipeToDelete>
          </Fragment>
        ))}

        {/* La dernière série n'a personne derrière qui la remplace : son bandeau
            tombe en pied de grille, qui est bien la place qu'elle occupait. */}
        {deleted !== null && deleted.rank >= sets.length && undoRow}

        <AddRow label={t('workout.addSet')} onClick={onAddSet} />
      </div>
    </div>
  );
}
