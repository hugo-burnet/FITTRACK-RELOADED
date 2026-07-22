import type { ReactNode } from 'react';
import { Sheet } from './Sheet';

export type SheetAction = {
  label: string;
  /** One line under the label, for an action whose consequence is not obvious. */
  hint?: string;
  danger?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  actions: SheetAction[];
  /** Anything the actions need above them — a field, a reading. */
  children?: ReactNode;
};

/**
 * A menu of actions inside the Lot 1 sheet, in thumb reach at the bottom of the
 * screen rather than in a popover anchored to the "⋯" that opened it — which on
 * a phone lands wherever the row happens to be, often under the finger.
 *
 * Choosing runs the action and closes: an action sheet with a separate confirm
 * button asks twice for one decision. Destructive actions are the exception and
 * arm themselves elsewhere (`ConfirmAction`).
 */
export function ActionSheet({ open, onClose, title, actions, children }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      {children}
      <div className="-mx-5">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={action.disabled}
            onClick={() => {
              // Close FIRST, then act. Both calls land in one React batch, so
              // the last write wins: an action that opens another sheet must
              // run after the close, or it would set the state the close then
              // clears and the second sheet would never appear.
              onClose();
              action.onSelect();
            }}
            className="flex min-h-14 w-full flex-col justify-center gap-0.5 border-b
              border-[var(--border)] px-5 py-3 text-left transition-colors
              duration-[var(--dur-1)] last:border-b-0 active:bg-[var(--surface-2)]
              disabled:pointer-events-none disabled:opacity-40"
          >
            <span
              className={`text-base font-semibold ${
                action.danger ? 'text-[var(--color-danger)]' : 'text-[var(--text-1)]'
              }`}
            >
              {action.label}
            </span>
            {action.hint && (
              <span className="text-sm leading-snug text-[var(--text-2)]">{action.hint}</span>
            )}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
