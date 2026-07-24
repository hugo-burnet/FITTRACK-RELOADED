import { formatRest } from '@/lib/rest';
import { t } from '@/i18n/fr';

type Props = {
  /** Seconds. `undefined` is the empty state — inherit, or "no default". */
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  /** What the ± steps from when nothing explicit is set yet. */
  baseWhenEmpty: number;
  /**
   * The muted reading shown while empty: the inherited rest as `m:ss` where
   * there is one to inherit, or a word ("Aucun") where there is not.
   */
  emptyReading: string;
  /** The chip that returns to the empty state — "Repos de l'exercice" / "Aucun". */
  clearLabel: string;
  'aria-label': string;
};

/**
 * The rests a lifter actually reaches for. The ± handles everything between and
 * around them, so five chips cover the common case in one tap without becoming a
 * wall of buttons.
 */
const PRESETS = [60, 90, 120, 150, 180] as const;

/** The grid the steppers move on, and the floor an explicit rest sits above. */
const STEP = 15;
const MIN = 15;
const MAX = 900;

/**
 * How long to rest after a set, as a clock rather than a number in a box.
 *
 * This replaces a seconds `NumberInput` that read the whole app's `m:ss`
 * durations back as raw seconds. Someone reaching for "2:30" typed "2,3" — the
 * shape of a duration — and the field, happy to take a decimal, stored 2.3
 * seconds, which the timer then rounded to a two-second rest. There is no text
 * field here at all: a value can only be a preset or a ±15 s step, so a rest is
 * always a whole, sane number, and the mismatch that caused the bug is gone
 * rather than guarded against.
 *
 * `undefined` is the empty state, and it means "inherit" — the exercise's own
 * rest inside a routine, the schema's `0` (§4.2). It is reached only through the
 * clear chip, never by stepping down to zero: a rest of `0:00` has no meaning a
 * lifter would want, and letting the steppers land on it was half of what made
 * `0` ambiguous in the first place.
 */
export function RestPicker({
  value,
  onChange,
  baseWhenEmpty,
  emptyReading,
  clearLabel,
  ...aria
}: Props) {
  const isSet = value !== undefined;

  const bump = (delta: number) => {
    // Stepping while empty starts from the value you were about to inherit, so
    // the first nudge lands next to it rather than at the floor.
    const base = value ?? baseWhenEmpty;
    onChange(Math.min(MAX, Math.max(MIN, base + delta)));
  };

  const stepper =
    'min-h-14 w-14 shrink-0 rounded-lg bg-[var(--surface-2)] text-2xl text-[var(--text-1)] ' +
    'transition-transform duration-[var(--dur-1)] ease-[var(--ease-mech)] active:scale-[0.94]';

  return (
    <div role="group" {...aria}>
      <div className="flex items-stretch gap-1">
        <button type="button" aria-label={t('rest.decrease')} onClick={() => bump(-STEP)} className={stepper}>
          −
        </button>

        {/* The well. The reading is inked and carries its unit once it is an
            explicit choice; while inheriting it sits muted and unlabelled, so
            the lit clear chip below is what says where the number comes from.
            The pair is centred vertically (`items-center`) — baseline alignment
            let the tall digits ride ~10 px high in the well — while the number
            and its unit keep their own baseline relationship in the inner span. */}
        <div
          className="flex min-h-14 flex-1 items-center justify-center rounded-lg
            bg-[var(--surface-2)]"
        >
          <span className="flex items-baseline gap-1.5">
            <span
              className={`metric text-3xl font-semibold ${
                isSet ? 'text-[var(--text-1)]' : 'text-[var(--text-2)]'
              }`}
            >
              {isSet ? formatRest(value) : emptyReading}
            </span>
            {isSet && (
              <span
                aria-hidden="true"
                className="text-[0.6875rem] font-semibold tracking-[0.08em] text-[var(--text-2)]"
              >
                {t('units.minutes')}
              </span>
            )}
          </span>
        </div>

        <button type="button" aria-label={t('rest.increase')} onClick={() => bump(STEP)} className={stepper}>
          +
        </button>
      </div>

      {/* A 5-column grid, not a wrapping flex row: at 375 px the five chips
          overran and "3:00" dropped alone onto a second line. The grid keeps
          them on one row and equal-width whatever the system font measures. */}
      <div className="mt-3 grid grid-cols-5 gap-2">
        {PRESETS.map((seconds) => (
          <Chip
            key={seconds}
            numeric
            fill
            label={formatRest(seconds)}
            active={value === seconds}
            onClick={() => onChange(seconds)}
          />
        ))}
      </div>

      {/* On its own line: it is a mode ("inherit"), not another duration, and the
          gap keeps it from reading as a sixth value chip. */}
      <div className="mt-2 flex">
        <Chip label={clearLabel} active={!isSet} onClick={() => onChange(undefined)} />
      </div>
    </div>
  );
}

/**
 * The same fill/ink split as `FilterChip`, without its chevron: this chip *is*
 * the choice, it does not open a further picker. Durations take the tabular face
 * so "2:30" lines up with the reading in the well; the inherit chip is a word
 * and takes the plain one.
 */
function Chip({
  label,
  active,
  numeric = false,
  fill = false,
  onClick,
}: {
  label: string;
  active: boolean;
  numeric?: boolean;
  /** Stretch to the grid cell (presets) rather than hug the label (clear chip). */
  fill?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-12 rounded-xl text-base font-semibold transition-colors
        duration-[var(--dur-1)] ease-[var(--ease-mech)] ${fill ? 'w-full px-1' : 'px-4'} ${
          numeric ? 'metric' : ''
        } ${
          active
            ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
            : 'bg-[var(--surface-2)] text-[var(--text-1)]'
        }`}
    >
      {label}
    </button>
  );
}
