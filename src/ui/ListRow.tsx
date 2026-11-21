import type { ReactNode } from 'react';
import { ChevronRightIcon } from './icons';

type Props = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  /** Right-hand slot: a reading, a chevron, a switch. */
  trailing?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /**
   * Spoken name when the visible columns read well to the eye but poorly to the
   * ear — a row split into number / phase / level says more as one sentence.
   */
  ariaLabel?: string;
  /**
   * Turns the row into a checkbox. Left undefined it stays a plain button — a
   * row that is not selectable must not announce a checked state.
   */
  checked?: boolean;
  /**
   * Le chevron « cette ligne ouvre un écran ». Par défaut il est posé dès que la
   * ligne est cliquable et n'a ni `trailing` ni `checked` : une ligne-lien sans
   * chevron ne dit pas qu'elle en est une (Rythme, Volume, Muscles, Rapport
   * mensuel l'avaient oublié, quand 39 appels le passaient à la main). `false` pour
   * une ligne qui agit au lieu d'ouvrir — exporter, installer, ouvrir une feuille.
   */
  chevron?: boolean;
};

/**
 * A single row. Deliberately unrounded and self-dividing: rows are meant to be
 * stacked inside a `overflow-hidden rounded-2xl` container so a list reads as one
 * block rather than a stack of floating cards.
 */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onClick,
  disabled,
  checked,
  ariaLabel,
  chevron,
}: Props) {
  const Element = onClick ? 'button' : 'div';
  const showChevron =
    chevron ?? (onClick !== undefined && trailing === undefined && checked === undefined);

  return (
    <Element
      type={onClick ? 'button' : undefined}
      data-part="row"
      role={checked === undefined ? undefined : 'checkbox'}
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={onClick ? disabled : undefined}
      className={`flex min-h-14 w-full items-center gap-3 border-b border-[var(--border)]
        bg-[var(--surface-1)] px-4 py-3 text-left last:border-b-0 disabled:opacity-40
        ${onClick ? 'transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-2)]' : ''}`}
    >
      {leading && <span className="shrink-0 text-[var(--text-2)]">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 [overflow-wrap:anywhere] text-base text-[var(--text-1)]">{title}</span>
        {subtitle && <span className="mt-0.5 block text-sm text-[var(--text-2)]">{subtitle}</span>}
      </span>
      {trailing ? (
        <span className="shrink-0 text-[var(--text-2)]">{trailing}</span>
      ) : (
        showChevron && (
          <span className="shrink-0 text-[var(--text-2)]">
            <ChevronRightIcon />
          </span>
        )
      )}
    </Element>
  );
}
