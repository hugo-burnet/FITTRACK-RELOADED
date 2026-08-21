import { Button } from './Button';
import { Sheet } from './Sheet';
import type { Option } from './OptionSheet';
import { CheckIcon } from './icons';

type Props<T extends string> = {
  open: boolean;
  onClose: () => void;
  title: string;
  options: Option<T>[];
  values: readonly T[];
  onToggle: (value: T) => void;
  /** Verb of the footer button. The sheet has one way out and it is this. */
  doneLabel: string;
  /** Sits above the list, when the list alone does not say what it is for. */
  hint?: string;
};

/**
 * Multi-choice picker, the twin of `OptionSheet` — same rows, same sheet, one
 * difference that changes everything: **choosing does not close it.**
 *
 * `OptionSheet` closes on the tap because a single choice is finished the moment
 * it is made. Here it is not: "dos" is an answer that is still waiting for
 * "biceps", and a sheet that shut after the first one made the second choice
 * cost a full reopen. That is exactly the shape of the bug this replaces — a
 * pull-up with a neutral grip could be filed under the back **or** the biceps
 * and never both. So the rows stay put, and a full-width verb in the thumb zone
 * ends the conversation.
 *
 * Checkboxes, not radios: the role has to say that several answers are allowed
 * before the first tap, not after.
 */
export function MultiOptionSheet<T extends string>({
  open,
  onClose,
  title,
  options,
  values,
  onToggle,
  doneLabel,
  hint,
}: Props<T>) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {hint !== undefined && (
        <p className="mb-3 text-sm leading-relaxed text-[var(--text-2)]">{hint}</p>
      )}

      <div className="-mx-5">
        {options.map((option) => {
          const selected = values.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              role="checkbox"
              aria-checked={selected}
              onClick={() => onToggle(option.value)}
              className="flex min-h-14 w-full items-center gap-3 border-b border-[var(--border)]
                px-5 py-3 text-left transition-colors duration-[var(--dur-1)] last:border-b-0
                active:bg-[var(--surface-2)]"
            >
              {/* The box carries the state on its own, so the row reads as
                  "several of these" before anything is ticked — a trailing check
                  that only appears once selected does not. */}
              <span
                aria-hidden="true"
                className={`flex size-6 shrink-0 items-center justify-center rounded-md border
                  transition-[background-color,border-color,transform] duration-[var(--dur-1)]
                  ease-[var(--ease-mech)]
                  ${
                    selected
                      ? `scale-105 border-[var(--color-accent)] bg-[var(--color-accent)]
                        text-[var(--color-accent-fg)]`
                      : 'border-[var(--border)] bg-[var(--surface-2)] text-transparent'
                  }`}
              >
                <CheckIcon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate text-base ${
                    selected ? 'font-semibold text-[var(--text-1)]' : 'text-[var(--text-1)]'
                  }`}
                >
                  {option.label}
                </span>
                {option.hint && (
                  <span className="mt-0.5 block text-sm text-[var(--text-2)]">{option.hint}</span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Collé au bas du panneau qui défile : dix-huit muscles ne tiennent pas
          dans une feuille, et un « Terminé » qu'il faut aller chercher au bout
          d'un défilement n'est pas dans la zone du pouce. Le fond opaque et la
          marge négative le posent d'un bord à l'autre, au-dessus des lignes qui
          passent dessous. */}
      <div
        className="sticky bottom-0 -mx-5 bg-[var(--surface-1)] px-5 pt-3
          pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]"
      >
        <Button variant="primary" size="lg" fullWidth onClick={onClose}>
          {doneLabel}
        </Button>
      </div>
    </Sheet>
  );
}
