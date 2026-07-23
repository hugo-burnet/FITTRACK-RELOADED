import { useState } from 'react';
import { formatNumber, INTEGER, NUMERIC, parseNumber } from '@/ui/numberField';

type Props = {
  value: number | undefined;
  /**
   * What ✓ records if you type nothing: today's prescription, or failing that
   * what you lifted last time. Shown greyed, in the very place the typed value
   * will take.
   *
   * Always a number, or empty. It used to carry "8 – 12" as well, and that was
   * the bug: cf. `target`.
   */
  ghost: string;
  /**
   * The prescription **when it is not a value ✓ could record** — in practice, a
   * rep range. It reads on its own line, above the field.
   *
   * It lived in `ghost` until it was reported truncated on a phone, and the
   * width was only the symptom. A range is not a number: "12 – 20" is seven
   * characters in a box sized for two, so a system font a hair wider than the
   * one it was measured against clipped it at **both** ends — "12 – 20" reading
   * as "2 – 2", which is not a truncation but a different range. Widening the
   * column would have bought a few pixels and left the real fault standing:
   * grey-in-the-field means *"✓ takes this"* everywhere else in the grid, and on
   * a range ✓ took nothing at all and logged a set with no reps.
   *
   * So the two are separated. The field keeps one meaning, the range gets a
   * register that fits it, and 11 px on --text-2 is the same engraved annotation
   * the column heads above use — one level down, where the prescription varies
   * set by set.
   */
  target?: string;
  onChange: (value: number | undefined) => void;
  width: string;
  /**
   * The duration column only. A load needs its decimal — "102,5" for a half-plate
   * — but on a hold that same freedom is the bug: "1:30" typed as "1,3" stores 1.3
   * seconds. The separator is refused here, and a duration is entered in whole
   * seconds (cf. `measurement` ENTRY_UNIT), which is all it ever needed.
   */
  integer?: boolean;
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
 * | nothing | neither prescription nor history | nothing, and ✓ is shut |
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
 *
 * The surface and the focus ring sit on the wrapper rather than the input, so
 * the target line is inside the same box as the figure it prescribes. The
 * wrapper is a `<label>`: the line is not a separate target, it focuses the
 * field like the rest of the cell, and the 48 px stays one tap.
 */
export function SetValueCell({ value, ghost, target, onChange, width, integer, ...aria }: Props) {
  // The load takes a decimal, a duration only whole seconds — see `integer`.
  const pattern = integer ? INTEGER : NUMERIC;
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
    <label
      style={{ width }}
      className="relative flex min-h-12 shrink-0 rounded-lg bg-[var(--surface-2)]
        focus-within:ring-2 focus-within:ring-[var(--accent-ink)]"
    >
      {target !== undefined && (
        // Out of the flow on purpose: the figure below keeps the optical centre
        // of the box, so a row where one cell is prescribed and the other is not
        // still reads as one line. Announced through the field's own label
        // instead, so it is said once.
        <span
          aria-hidden="true"
          className="tabular pointer-events-none absolute inset-x-0 top-1 truncate px-1 text-center
            text-[0.6875rem] leading-none text-[var(--text-2)]"
        >
          {target}
        </span>
      )}

      <input
        type="text"
        // A load needs the separator ("102,5"), so its keypad carries one; a
        // duration is whole seconds, and a keypad with no separator is one fewer
        // key to hit the wrong one of, one-handed and in a hurry.
        inputMode={integer ? 'numeric' : 'decimal'}
        // The phone keyboard's "OK" key. Without it Enter does nothing at all
        // outside a <form>, and the keyboard stays over the grid.
        enterKeyHint="done"
        value={draft}
        placeholder={ghost}
        onChange={(event) => {
          const raw = event.target.value;
          if (!pattern.test(raw)) return; // refuse letters, and the separator on a duration
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
        className="metric min-h-12 w-full rounded-lg bg-transparent text-center text-lg
          font-semibold text-[var(--text-1)] outline-none placeholder:font-normal
          placeholder:text-[var(--text-2)]"
        {...aria}
      />
    </label>
  );
}
