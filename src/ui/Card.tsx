import type { ReactNode } from 'react';

type Props = {
  /** Adds the standard inset. Leave off when the card holds `ListRow`s, which pad themselves. */
  padded?: boolean;
  /** Placement only (margin, width) — never a second surface: colour and radius stay `Card`'s. */
  className?: string;
  children: ReactNode;
};

/**
 * The one raised surface of the app. `overflow-hidden` is what makes a stack of
 * `ListRow`s read as a single block instead of a pile of floating cards.
 */
export function Card({ padded = false, className = '', children }: Props) {
  return (
    <div
      className={`overflow-hidden rounded-2xl bg-[var(--surface-1)] ${padded ? 'p-4' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
