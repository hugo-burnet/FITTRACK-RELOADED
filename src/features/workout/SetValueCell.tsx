import { useState } from 'react';
import { formatNumber, NUMERIC, parseNumber } from '@/ui/numberField';

type Props = {
  value: number | undefined;
  /**
   * What the field proposes: today's prescription, or failing that what you
   * lifted last time. Shown greyed, in the very place the typed value will take.
   *
   * A string and not a number, because one prescription is not a number: "8 – 12"
   * is a range, and it has to be readable in the same place as everything else.
   */
  ghost: string;
  onChange: (value: number | undefined) => void;
  width: string;
  'aria-label': string;
};

/**
 * One editable figure of the live grid.
 *
 * Not `NumberInput`: that component carries two 48 px ± steppers, which is 96 px
 * of chrome per cell and two cells per row, on a 375 px screen. It shares the
 * decimal handling instead (`ui/numberField`), which is the part that matters —
 * a field that reparses "102," into 102 makes a half-plate impossible to type.
 *
 * Three states, one gesture:
 *
 * | Shown | Where it comes from | What ✓ records |
 * |---|---|---|
 * | semibold ink | **you typed it** — nothing else ever lands here | that figure |
 * | regular grey | today's prescription, or failing that last time | **that figure** |
 * | nothing | neither prescription nor history | nothing |
 *
 * The two states differ by **weight**, not by how faint they are. Lot 1 filed
 * this value under `--text-3` on the assumption it would be decorative — an
 * echo you may reuse. It is not: it is what the tick records. Measured on the
 * real screen, `--text-3` came out at 3,44:1 in the dark theme and **2,02:1 in
 * the light one**, so a tap wrote down a number nobody could read. Grey stays
 * `--text-2`, and `font-normal` against `font-semibold` carries the difference
 * — which is the pairing `NumberInput` has applied to its own placeholders
 * since Lot 1.
 *
 * Touching the field does **not** copy the ghost in: a value you did not type
 * must never be indistinguishable from one you did.
 */
export function SetValueCell({ value, ghost, onChange, width, ...aria }: Props) {
  // The field keeps its own input string: without it "102," is reparsed to 102
  // and the comma vanishes under the fingers — a decimal impossible to type.
  const [draft, setDraft] = useState(() => formatNumber(value));
  const [lastValue, setLastValue] = useState(value);

  // Resynchronised during render, not in an effect: an effect would paint one
  // frame carrying the old string, which is visible on a pre-fill. `react-hooks`
  // v7 rejects the effect form outright (`set-state-in-effect`).
  if (value !== lastValue) {
    setLastValue(value);
    if (parseNumber(draft) !== value) setDraft(formatNumber(value));
  }

  return (
    <input
      type="text"
      inputMode="decimal"
      // The phone keyboard's "OK" key. Without it Enter does nothing at all
      // outside a <form>, and the keyboard stays over the grid.
      enterKeyHint="done"
      value={draft}
      placeholder={ghost}
      onChange={(event) => {
        const raw = event.target.value;
        if (!NUMERIC.test(raw)) return; // refuse letters and a second separator
        setDraft(raw);
        onChange(parseNumber(raw));
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      onFocus={(event) => event.target.select()} // replace in one gesture, not correct
      style={{ width }}
      className="metric min-h-12 shrink-0 rounded-lg bg-[var(--surface-2)] text-center text-lg
        font-semibold text-[var(--text-1)] outline-none placeholder:font-normal
        placeholder:text-[var(--text-2)] focus:ring-2 focus:ring-[var(--accent-ink)]"
      {...aria}
    />
  );
}
