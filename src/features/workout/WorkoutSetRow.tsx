import type { ComponentType, SVGProps } from 'react';
import type { SetValues } from '@/data/repositories/workouts';
import type { SetType, WorkoutSet } from '@/data/types';
import { t } from '@/i18n/fr';
import { setTypeLabel, unitLabel } from '@/i18n/labels';
import { isRepRange, isSetRecordable, repsReading } from '@/lib/measurement';
import type { EntryColumn, ResolvedValues, TargetField } from '@/lib/measurement';
import { formatNumber } from '@/ui/numberField';
import { BoltIcon, CheckIcon, DropsetIcon, FlameIcon } from '@/ui/icons';
import { SetValueCell } from './SetValueCell';
import { setReading } from './summary';

/**
 * RF-20 — what a set that is not a plain working set shows in place of its rank.
 *
 * A mark, not a word: "ÉCH." (échauffement) and "ÉCHEC" do not separate at arm's
 * length, one-handed, out of breath — and that is the only distance this screen
 * is ever read at. The shape carries it; the accent is a second channel, never
 * the only one (Lot 4 rule: sunlight, colour blindness).
 *
 * `normal` is absent on purpose: a normal set keeps its number, which is the
 * reading that says where you are in the exercise.
 */
const TYPE_MARK: Partial<Record<SetType, ComponentType<SVGProps<SVGSVGElement>>>> = {
  warmup: FlameIcon,
  dropset: DropsetIcon,
  failure: BoltIcon,
};

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
 *
 * And it goes dim when there is nothing to record — a set prescribed as a range
 * that you have never done before. `isSetRecordable` holds that rule; the row
 * only asks. The dim tick is the honest state: the figure is missing, and the
 * empty field under its own target line is where it goes.
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
  const Mark = TYPE_MARK[set.setType];

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
   * The one prescription that is **not** a value: a rep range. It reads on its
   * own line above the field rather than inside it — cf. `SetValueCell.target`.
   */
  const targetOf = (field: TargetField): string | undefined =>
    field === 'reps' && isRepRange(set) ? repsReading(set)?.value : undefined;

  /**
   * What the field proposes, which is always a figure ✓ can record.
   *
   * On a ranged set the range is skipped and **last session's count takes the
   * slot**. It used to leave the slot empty, which threw away the one number the
   * tick could legitimately have recorded: you were shown "8 – 12", the 10 you
   * did last week was hidden, and ✓ validated a set with no reps at all.
   */
  const ghostNumberOf = (field: TargetField): number | undefined =>
    targetOf(field) === undefined ? ghostOf(field) : previousValue(field);

  /** Every column's figure as ✓ would write it: what was typed, or what is proposed. */
  const resolved: ResolvedValues = {};
  for (const column of columns) {
    const value = valueOf(column.field) ?? ghostNumberOf(column.field);
    if (value !== undefined) resolved[column.field] = value;
  }

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

  const previousReading = previous === undefined ? '' : setReading(previous, columns);

  return (
    <div
      // 60 px and a bottom padding, kept from Lot 5 when the rest bar still lived
      // in this row's lower channel. The bar has since moved to the exercise
      // card's own bottom edge (`RestRail`), where it stays in view even once the
      // finished exercise folds; the row keeps its rhythm rather than being
      // re-tuned to reclaim the four pixels.
      className={`relative flex min-h-[3.75rem] items-center gap-1.5 px-2 pb-2
        transition-colors duration-[var(--dur-1)]
        ${done ? 'bg-[var(--surface-2)]' : ''}`}
    >
      {/* The rank, and the way to anything else about this set — including the
          set type (RF-20), which is what this button was kept for since Lot 5.
          The mark replaces the number rather than crowding beside it: 48 px does
          not hold two glyphs that both have to read without looking. */}
      <button
        type="button"
        // The type is said, never left to the drawing: the mark is aria-hidden
        // like every other icon here, so a screen reader gets the word.
        aria-label={
          Mark === undefined
            ? t('workout.setNumber', { number })
            : `${t('workout.setNumber', { number })} — ${setTypeLabel(set.setType)}`
        }
        onClick={onMenu}
        className="flex size-12 shrink-0 items-center justify-center rounded-lg text-sm
          text-[var(--text-2)] active:bg-[var(--surface-2)]"
      >
        {Mark === undefined ? (
          <span className="tabular">{number}</span>
        ) : (
          <Mark className="text-[var(--accent-ink)]" />
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

      {columns.map((column, index) => {
        const target = targetOf(column.field);
        return (
          <SetValueCell
            key={column.field}
            value={valueOf(column.field)}
            ghost={formatNumber(ghostNumberOf(column.field))}
            target={target}
            // A hold is entered in whole seconds, never a decimal: "1:30" typed
            // as "1,3" must not slip through as 1.3 s (cf. the rest timer, Lot 6).
            integer={column.field === 'duration'}
            onChange={(next) => onWrite(single(column.field, next))}
            width={index === 0 ? WIDTH.first : WIDTH.second}
            // The target line is drawn aria-hidden and said here instead, so a
            // screen reader gets the prescription once, with the field it belongs to.
            aria-label={[
              t('workout.setNumber', { number }),
              unitLabel(column.unit),
              target === undefined ? undefined : t('workout.target', { value: target }),
            ]
              .filter((part) => part !== undefined)
              .join(' — ')}
          />
        );
      })}

      <button
        type="button"
        aria-pressed={done}
        disabled={!done && !isSetRecordable(columns, resolved)}
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
        // La **zone de touche** reste à 48 px : c'est la cible tactile non
        // négociable de la charte, et cet écran se lit une main en sueur.
        // Seule la pastille rétrécit, à l'intérieur.
        className="flex size-12 shrink-0 items-center justify-center
          transition-transform duration-[var(--dur-1)] ease-[var(--ease-mech)]
          active:scale-[0.92] disabled:pointer-events-none disabled:opacity-40"
      >
        {/* 34 px, soit 30 % de moins que la zone qui la porte. La coche suit la
            même réduction (20 → 14 px) pour garder sa respiration dedans. */}
        <span
          className={`flex size-[2.125rem] items-center justify-center rounded-lg
            transition-colors duration-[var(--dur-1)]
            ${
              done
                ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                : 'bg-[var(--surface-2)] text-[var(--text-2)]'
            }`}
        >
          <CheckIcon width={14} height={14} />
        </span>
      </button>
    </div>
  );
}
