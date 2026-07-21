import type { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  /** Right-hand slot: a reading, a chevron, a switch. */
  trailing?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
};

/**
 * A single row. Deliberately unrounded and self-dividing: rows are meant to be
 * stacked inside a `overflow-hidden rounded-2xl` container so a list reads as one
 * block rather than a stack of floating cards.
 */
export function ListRow({ title, subtitle, leading, trailing, onClick, disabled }: Props) {
  const Element = onClick ? 'button' : 'div';

  return (
    <Element
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      className={`flex min-h-14 w-full items-center gap-3 border-b border-[var(--border)]
        bg-[var(--surface-1)] px-4 py-3 text-left last:border-b-0 disabled:opacity-40
        ${onClick ? 'transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]' : ''}`}
    >
      {leading && <span className="shrink-0 text-[var(--text-2)]">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base text-[var(--text-1)]">{title}</span>
        {subtitle && <span className="mt-0.5 block text-sm text-[var(--text-2)]">{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0 text-[var(--text-2)]">{trailing}</span>}
    </Element>
  );
}
