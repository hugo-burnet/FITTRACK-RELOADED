import { Sheet } from './Sheet';
import { CheckIcon } from './icons';

export type Option<T extends string> = {
  value: T;
  label: string;
  /** One example. Shown only where the label alone is unguessable. */
  hint?: string;
};

type Props<T extends string> = {
  open: boolean;
  onClose: () => void;
  title: string;
  options: Option<T>[];
  value: T;
  onSelect: (value: T) => void;
};

/**
 * Single-choice picker inside the Lot 1 sheet. One component serves all five
 * choices of this lot — the two library filters and the three form fields —
 * because they differ only in their list.
 *
 * Choosing closes the sheet: a picker with a separate "Done" button asks for a
 * second tap to confirm something already visible.
 */
export function OptionSheet<T extends string>({
  open,
  onClose,
  title,
  options,
  value,
  onSelect,
}: Props<T>) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div role="radiogroup" aria-label={title} className="-mx-5">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                // Closed before the choice is applied, for the reason spelled
                // out in ActionSheet: the two land in one batch, so whichever
                // runs last owns the sheet state.
                onClose();
                onSelect(option.value);
              }}
              className="flex min-h-14 w-full items-center gap-3 border-b border-[var(--border)]
                px-5 py-3 text-left transition-colors duration-[var(--dur-1)] last:border-b-0
                active:bg-[var(--surface-2)]"
            >
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-base ${
                    selected ? 'font-semibold text-[var(--accent-ink)]' : 'text-[var(--text-1)]'
                  }`}
                >
                  {option.label}
                </span>
                {option.hint && (
                  <span className="mt-0.5 block text-sm text-[var(--text-2)]">{option.hint}</span>
                )}
              </span>
              {selected && <CheckIcon className="shrink-0 text-[var(--accent-ink)]" />}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
