import type { SetValues } from '@/data/repositories/workouts';
import type { WorkoutSet } from '@/data/types';
import { t } from '@/i18n/fr';
import { unitLabel } from '@/i18n/labels';
import { isRepRange, repsReading } from '@/lib/measurement';
import type { EntryColumn, TargetField } from '@/lib/measurement';
import { formatNumber } from '@/ui/numberField';
import { CheckIcon } from '@/ui/icons';
import { SetValueCell } from './SetValueCell';

/** Which field of a stored set each entry column writes into. */
const FIELD_KEY = {
  weight: 'weight',
  reps: 'reps',
  duration: 'durationSeconds',
  distance: 'distanceMeters',
} as const satisfies Record<TargetField, keyof SetValues>;

/** And where the session keeps what it was asked to do. */
const TARGET_KEY = {
  weight: 'targetWeight',
  reps: 'targetReps',
  duration: 'targetDurationSeconds',
  distance: 'targetDistanceMeters',
} as const satisfies Record<TargetField, keyof WorkoutSet>;

/**
 * Column widths, fixed in pixels rather than proportions.
 *
 * The grid has to hold at 375 px with a 48 px tick, and a proportional layout
 * would shrink the load field — the one that has to fit "102,5" — first.
 * "Précédent" takes what is left, because it is the only cell that may truncate
 * without losing anything you cannot read one row up.
 */
const WIDTH = { first: '4.75rem', second: '3.5rem' } as const;

type Props = {
  set: WorkoutSet;
  /** Position in the exercise, 1-based. */
  number: number;
  columns: EntryColumn[];
  /** The same rank, last session. Strictly by index — cf. `previousValue`. */
  previous: WorkoutSet | undefined;
  onWrite: (values: Partial<SetValues>) => void;
  onComplete: (values: Partial<SetValues>) => void;
  onUncomplete: () => void;
  onMenu: () => void;
};

/**
 * One set: what you did last time, what you are doing now, and the tick.
 *
 * The tick is the whole screen. Pressed on an untouched row it records the grey
 * figures, so a set identical to last time costs **one tap** — the shape the
 * roadmap puts a number on. Pressed again it un-ticks: a mis-tap is the most
 * likely error here, and it must cost as little as the tap did.
 *
 * A validated row changes surface and its tick fills with the accent: the state
 * of a set has to read at arm's length, without glasses.
 */
export function WorkoutSetRow({
  set,
  number,
  columns,
  previous,
  onWrite,
  onComplete,
  onUncomplete,
  onMenu,
}: Props) {
  const done = set.isCompleted === 1;

  /**
   * Strictly the set of the same rank, never a fallback onto the last one of the
   * block. The grey figure is not decoration — the tick records it — so
   * borrowing set 4's load for set 5 would write a number nobody performed.
   */
  const previousValue = (field: TargetField): number | undefined =>
    previous?.[FIELD_KEY[field]];

  const valueOf = (field: TargetField): number | undefined => set[FIELD_KEY[field]];

  /**
   * What the tick records when nothing was typed: **today's prescription
   * first**, and failing that what you lifted last time.
   *
   * That order is the point. The routine is the plan for today; last week is
   * beside it in the "précédent" column, where you can compare without either
   * one overwriting the other.
   */
  const ghostOf = (field: TargetField): number | undefined =>
    set[TARGET_KEY[field]] ?? previousValue(field);

  /**
   * What the ghost *reads as* — which is not always a number. A prescription of
   * 8 – 12 is a range, so it shows in full and the tick records nothing from
   * it: you always know your own rep count, and you type it.
   */
  const ghostTextOf = (field: TargetField): string | undefined =>
    field === 'reps' && isRepRange(set) ? repsReading(set)?.value : undefined;

  const ghostNumberOf = (field: TargetField): number | undefined =>
    ghostTextOf(field) === undefined ? ghostOf(field) : undefined;

  /** One value per column of this exercise, and no key it does not measure. */
  const collect = (pick: (field: TargetField) => number | undefined): Partial<SetValues> => {
    const values: Partial<SetValues> = {};
    for (const column of columns) values[FIELD_KEY[column.field]] = pick(column.field);
    return values;
  };

  const single = (field: TargetField, value: number | undefined): Partial<SetValues> => {
    const values: Partial<SetValues> = {};
    values[FIELD_KEY[field]] = value;
    return values;
  };

  const previousReading = columns
    .map((column) => {
      const value = previousValue(column.field);
      return value === undefined ? undefined : `${column.prefix ?? ''}${formatNumber(value)}`;
    })
    .filter((part) => part !== undefined)
    .join(' × ');

  return (
    <div
      className={`flex min-h-14 items-center gap-1.5 px-2 transition-colors duration-[var(--dur-1)]
        ${done ? 'bg-[var(--surface-2)]' : ''}`}
    >
      {/* The rank, and the way to anything else about this set. Lot 6 hangs the
          set type here, which is why it is a button already. */}
      <button
        type="button"
        aria-label={t('workout.setNumber', { number })}
        onClick={onMenu}
        className="flex size-12 shrink-0 items-center justify-center rounded-lg text-sm
          text-[var(--text-2)] active:bg-[var(--surface-2)]"
      >
        {set.setType === 'warmup' ? (
          <span className="label-xs font-semibold text-[var(--accent-ink)]">
            {t('workout.warmupShort')}
          </span>
        ) : (
          <span className="tabular">{number}</span>
        )}
      </button>

      {/* RF-19. Tapping it writes last session's figures into the fields — the
          gesture that matters when a routine prescribes one thing and last week
          says another. */}
      <button
        type="button"
        disabled={previousReading === ''}
        aria-label={t('workout.previous')}
        onClick={() => onWrite(collect(previousValue))}
        className="metric min-h-12 min-w-0 flex-1 truncate rounded-lg px-1 text-center text-sm
          text-[var(--text-2)] active:bg-[var(--surface-2)] disabled:active:bg-transparent"
      >
        {previousReading === '' ? t('workout.noPrevious') : previousReading}
      </button>

      {columns.map((column, index) => (
        <SetValueCell
          key={column.field}
          value={valueOf(column.field)}
          ghost={ghostTextOf(column.field) ?? formatNumber(ghostNumberOf(column.field))}
          onChange={(next) => onWrite(single(column.field, next))}
          width={index === 0 ? WIDTH.first : WIDTH.second}
          aria-label={`${t('workout.setNumber', { number })} — ${unitLabel(column.unit)}`}
        />
      ))}

      <button
        type="button"
        aria-pressed={done}
        aria-label={
          done
            ? t('workout.uncomplete', { number })
            : t('workout.complete', { number })
        }
        // What is typed, and failing that what is greyed: an untouched row
        // identical to what is proposed costs one tap, which is the whole point.
        onClick={() =>
          done ? onUncomplete() : onComplete(collect((f) => valueOf(f) ?? ghostNumberOf(f)))
        }
        className={`flex size-12 shrink-0 items-center justify-center rounded-lg
          transition-[background-color,transform] duration-[var(--dur-1)] ease-[var(--ease-mech)]
          active:scale-[0.92]
          ${
            done
              ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
              : 'bg-[var(--surface-2)] text-[var(--text-2)]'
          }`}
      >
        <CheckIcon />
      </button>
    </div>
  );
}
