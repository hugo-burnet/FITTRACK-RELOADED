import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

type Props = {
  label: string;
  hint?: string;
  /** Hides the label visually but keeps it for screen readers. */
  labelHidden?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>;

export function Input({
  label,
  hint,
  labelHidden = false,
  className = '',
  onKeyDown,
  ...rest
}: Props) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className={labelHidden ? 'sr-only' : 'label-xs font-semibold text-[var(--text-2)]'}
      >
        {label}
      </label>
      {/* --text-2 on the placeholder, not --text-3: measured at 2,02:1 on the
          light theme, and a placeholder is read, not glanced at. --text-3 stays
          for values that really are echoes — Lot 5's previous set. */}
      <input
        id={id}
        aria-describedby={hint ? hintId : undefined}
        onKeyDown={(event) => {
          // The phone keyboard's "done" key. Left alone it does nothing at all:
          // an input outside a <form> has no default action for Enter, so the
          // keyboard just stays up covering half the screen. Blurring is what
          // dismisses it.
          if (event.key === 'Enter') {
            event.preventDefault();
            event.currentTarget.blur();
          }
          onKeyDown?.(event);
        }}
        className={`min-h-12 w-full rounded-lg bg-[var(--surface-2)] px-4 text-base
          text-[var(--text-1)] outline-none placeholder:text-[var(--text-2)]
          focus:ring-2 focus:ring-[var(--accent-ink)] disabled:opacity-40 ${className}`}
        {...rest}
      />
      {hint && (
        <p id={hintId} className="text-sm text-[var(--text-2)]">
          {hint}
        </p>
      )}
    </div>
  );
}
