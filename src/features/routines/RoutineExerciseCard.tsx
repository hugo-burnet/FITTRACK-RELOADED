import type { RoutineExerciseDetail } from '@/data/repositories/routines';
import type { MeasurementType, RoutineSet } from '@/data/types';
import { t } from '@/i18n/fr';
import { exerciseSubtitle, unitLabel } from '@/i18n/labels';
import { targetParts } from '@/lib/measurement';
import type { TargetUnit } from '@/lib/measurement';
import { AddRow } from '@/ui';
import type { ItemState } from '@/ui';
import { GripIcon, MoreIcon } from '@/ui/icons';

/** Where this exercise sits in its superset. Absent = not in one. */
export type SupersetPlace = { index: number; size: number };

type Props = {
  line: RoutineExerciseDetail;
  superset?: SupersetPlace;
  state: ItemState;
  onMenu: () => void;
  onOpenSet: (set: RoutineSet) => void;
  onAddSet: () => void;
};

/** A, B, C — the order you alternate in, which is what a superset is. */
const alternationMark = (index: number): string => String.fromCharCode(65 + index);

/**
 * `reps` is a word and takes the engraved register; every other unit here is an
 * SI symbol, and those are case-sensitive — it is "kg", not "KG" (Lot 1 rule).
 */
function Unit({ unit }: { unit: TargetUnit }) {
  return unit === 'reps' ? (
    <span className="label-xs font-semibold text-[var(--text-2)]">{unitLabel(unit)}</span>
  ) : (
    <span className="text-[0.6875rem] font-semibold tracking-[0.08em] text-[var(--text-2)]">
      {unitLabel(unit)}
    </span>
  );
}

/**
 * One planned set, as a scannable line.
 *
 * What it shows comes from the exercise's measurement type, so a plank reads
 * "45 s" and a rower "500 m · 2:00" instead of both being asked for repetitions.
 *
 * The figures are right-aligned into columns so a rising load reads straight
 * down the card instead of set by set — the same reasoning as the history rows
 * of the exercise sheet. No chevron: five of them per exercise would be five
 * marks saying what the pressed state already says.
 */
function SetRow({
  set,
  measurementType,
  number,
  onOpen,
}: {
  set: RoutineSet;
  measurementType: MeasurementType;
  number: number;
  onOpen: () => void;
}) {
  const parts = targetParts(measurementType, set);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex min-h-12 w-full items-center gap-3 border-b border-[var(--border)] px-4 py-2
        text-left transition-colors duration-[var(--dur-1)] last:border-b-0
        active:bg-[var(--surface-2)]"
    >
      <span className="tabular w-5 shrink-0 text-sm text-[var(--text-2)]">{number}</span>

      {/* Only warm-ups are marked in Lot 4: they are the one planned type the
          schema was designed for, and the only one that already changes a
          number elsewhere (records and volume exclude them). */}
      {set.setType === 'warmup' && (
        <span className="label-xs shrink-0 font-semibold text-[var(--text-2)]">
          {t('routine.warmupShort')}
        </span>
      )}

      {parts.length === 0 ? (
        <span className="flex-1 text-right text-sm text-[var(--text-2)]">
          {t('routine.setFree')}
        </span>
      ) : (
        <>
          <span className="flex-1 text-right">
            {parts[0] !== undefined && (
              <>
                <span className="metric text-base font-semibold text-[var(--text-1)]">
                  {parts[0].prefix}
                  {parts[0].value}
                </span>{' '}
                <Unit unit={parts[0].unit} />
              </>
            )}
          </span>
          <span className="w-[5.5rem] shrink-0 text-right">
            {parts[1] !== undefined && (
              <>
                <span className="metric text-base font-semibold text-[var(--text-1)]">
                  {parts[1].prefix}
                  {parts[1].value}
                </span>{' '}
                <Unit unit={parts[1].unit} />
              </>
            )}
          </span>
        </>
      )}
    </button>
  );
}

/**
 * One exercise of a routine: its identity, its planned sets, and the way into
 * everything else about it.
 *
 * A superset is drawn as an accent rule down the left edge of every member,
 * bridged across the gap so the group reads as one bracket, plus an **A / B / C**
 * mark on each row. The letter is not decoration and not a substitute for the
 * colour: it is the order you alternate in — the one thing a reader of a
 * superset needs — and it is what keeps the group legible on a screen in
 * sunlight or to an eye that does not separate the accent from the surface.
 * An exercise outside a superset carries no letter, so the mark's absence is
 * itself the signal.
 */
export function RoutineExerciseCard({
  line,
  superset,
  state,
  onMenu,
  onOpenSet,
  onAddSet,
}: Props) {
  const { row, exercise, sets } = line;
  const name = exercise?.name ?? t('routine.deletedExercise');

  // The rest that will actually be used: this routine's override, or failing
  // that the one set on the exercise itself in the library (schema §4.2 makes 0
  // mean "use the exercise default"). Showing only the override meant a rest
  // time entered in Lot 3 looked like it had been lost.
  const effectiveRest = row.restSeconds > 0 ? row.restSeconds : (exercise?.defaultRestSeconds ?? 0);

  const subtitle = [
    exercise === undefined ? t('routine.deletedExerciseHint') : exerciseSubtitle(exercise),
    effectiveRest > 0 ? `${effectiveRest} ${t('units.seconds')}` : undefined,
  ]
    .filter((part) => part !== undefined)
    .join(' · ');

  const first = superset !== undefined && superset.index === 0;
  const last = superset !== undefined && superset.index === superset.size - 1;

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
          // continuous rather than a stack of dashes. -0.75rem is the `gap-3`
          // of the list in RoutineEditorScreen — the two have to agree.
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
            aria-label={t('routine.dragHandle', { name })}
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
            <span className="truncate text-sm text-[var(--text-2)]">{subtitle}</span>
          </span>

          <button
            type="button"
            aria-label={`${t('routine.exerciseSheetTitle')} — ${name}`}
            onClick={onMenu}
            className="flex w-12 shrink-0 items-center justify-center text-[var(--text-2)]
              transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]"
          >
            <MoreIcon />
          </button>
        </div>

        {sets.map((set, index) => (
          <SetRow
            key={set.id}
            set={set}
            // A deleted exercise still has sets to show; weight_reps is the
            // shape that lets them read at all rather than vanish.
            measurementType={exercise?.measurementType ?? 'weight_reps'}
            number={index + 1}
            onOpen={() => onOpenSet(set)}
          />
        ))}

        <AddRow label={t('routine.addSet')} onClick={onAddSet} />
      </div>

      {row.notes !== undefined && row.notes !== '' && (
        <p className="px-4 pt-2 text-sm leading-relaxed text-[var(--text-2)]">{row.notes}</p>
      )}
    </div>
  );
}
