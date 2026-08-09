import { useState } from 'react';
import { formatNumber, INTEGER, NUMERIC, parseNumber } from '@/ui/numberField';

type Props = {
  value: number | undefined;
  /** Recordable fallback shown when the user has not typed a value. */
  ghost: string;
  /** Non-recordable guidance such as a rep range. */
  target?: string;
  onChange: (value: number | undefined) => void;
  width: string;
  /** Restricts duration fields to whole seconds. */
  integer?: boolean;
  'aria-label': string;
};

/** Compact live-workout value input with a distinct, recordable fallback. */
export function SetValueCell({ value, ghost, target, onChange, width, integer, ...aria }: Props) {
  const pattern = integer ? INTEGER : NUMERIC;
  // The field keeps its own input string: without it "102," is reparsed to 102
  // and the comma vanishes under the fingers — a decimal impossible to type.
  const [draft, setDraft] = useState(() => formatNumber(value));
  const [lastValue, setLastValue] = useState(value);

  // Render-time synchronization avoids a stale frame and satisfies React lint.
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
        // The input label announces this once; keep the visual hint out of the flow.
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
        inputMode={integer ? 'numeric' : 'decimal'}
        enterKeyHint="done"
        value={draft}
        placeholder={ghost}
        onChange={(event) => {
          const raw = event.target.value;
          if (!pattern.test(raw)) return;
          setDraft(raw);
          onChange(parseNumber(raw));
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        onFocus={(event) => event.target.select()}
        className="metric min-h-12 w-full rounded-lg bg-transparent text-center text-lg
          font-semibold text-[var(--text-1)] outline-none placeholder:font-normal
          placeholder:text-[var(--text-2)]"
        {...aria}
      />
    </label>
  );
}
