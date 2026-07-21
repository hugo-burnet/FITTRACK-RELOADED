import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

type Props = {
  label: string;
  hint?: string;
  /** Hides the label visually but keeps it for screen readers. */
  labelHidden?: boolean;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>;

export function Input({ label, hint, labelHidden = false, className = '', ...rest }: Props) {
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
      <input
        id={id}
        aria-describedby={hint ? hintId : undefined}
        className={`min-h-12 w-full rounded-lg bg-[var(--surface-2)] px-4 text-base
          text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)]
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
