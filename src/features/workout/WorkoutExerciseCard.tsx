import type { WorkoutExerciseDetail, SetValues } from '@/data/repositories/workouts';
import type { WorkoutSet } from '@/data/types';
import { t } from '@/i18n/fr';
import { exerciseSubtitle, unitLabel } from '@/i18n/labels';
import { entryColumns } from '@/lib/measurement';
import type { ItemState } from '@/ui';
import { GripIcon, MoreIcon, PlusIcon } from '@/ui/icons';
import { WorkoutSetRow } from './WorkoutSetRow';

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
  onAddSet,
}: Props) {
  const { row, exercise, sets, previous } = line;
  const name = exercise?.name ?? t('workout.deletedExercise');
  // A deleted exercise still has sets to show; weight_reps is the shape that
  // lets them read at all rather than vanish.
  const columns = entryColumns(exercise?.measurementType ?? 'weight_reps');

  const first = superset !== undefined && superset.index === 0;
  const last = superset !== undefined && superset.index === superset.size - 1;

  return (
    <div className={`relative ${superset === undefined ? '' : 'pl-3'}`}>
      {superset !== undefined && (
        <span
          aria-hidden="true"
          className={`absolute top-0 left-0 w-[3px] bg-[var(--color-accent)]
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
          <WorkoutSetRow
            key={set.id}
            set={set}
            number={index + 1}
            columns={columns}
            previous={previous[index]}
            onWrite={(values) => onWrite(set.id, values)}
            onComplete={(values) => onComplete(set.id, values)}
            onUncomplete={() => onUncomplete(set.id)}
            onMenu={() => onSetMenu(set, index + 1)}
          />
        ))}

        <button
          type="button"
          onClick={onAddSet}
          className="flex min-h-12 w-full items-center gap-2 px-4 text-left text-base
            font-semibold text-[var(--accent-ink)] transition-colors duration-[var(--dur-1)]
            active:bg-[var(--surface-2)]"
        >
          <PlusIcon width="18" height="18" />
          {t('workout.addSet')}
        </button>
      </div>
    </div>
  );
}
