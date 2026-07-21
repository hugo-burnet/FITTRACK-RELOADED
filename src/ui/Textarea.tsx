import { useId } from 'react';
import type { TextareaHTMLAttributes } from 'react';

type Props = {
  label: string;
  hint?: string;
  labelHidden?: boolean;
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>;

/** `Input`'s longer sibling. Same shell, same focus ring, room for a paragraph. */
export function Textarea({ label, hint, labelHidden = false, className = '', ...rest }: Props) {
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
      <textarea
        id={id}
        rows={4}
        aria-describedby={hint ? hintId : undefined}
        className={`w-full resize-y rounded-lg bg-[var(--surface-2)] px-4 py-3 text-base
          leading-relaxed text-[var(--text-1)] outline-none placeholder:text-[var(--text-2)]
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
