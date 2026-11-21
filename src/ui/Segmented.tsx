import { useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

export type SegmentedOption<V extends string | number> = {
  value: V;
  label: string;
  /**
   * Option visible mais pas encore choisissable. Elle reste focalisable
   * (`aria-disabled`, pas `disabled`) : sa raison, lue par `aria-describedby`,
   * n'est dite qu'à qui la touche, et un `disabled` la tairait.
   */
  locked?: { describedBy: string; icon?: ReactNode };
};

/** Deux options ou quatre sur deux colonnes, trois sur trois : jamais quatre sur une ligne. */
const COLUMNS: Record<number, string> = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-2',
};

/**
 * Choisir une valeur parmi deux à quatre, à plat (DESIGN.md, écart 6).
 *
 * Modifier une donnée, et non changer de vue : c'est le seul endroit où l'aplat
 * d'accent marque « la valeur choisie ». Au-delà de quatre options, c'est un
 * `OptionSheet` ; quatre sur une seule ligne débordent à 200 % de taille de
 * police, d'où les deux rangées de deux, imposées par la règle et non par une
 * prop.
 */
export function Segmented<V extends string | number>({
  label,
  value,
  options,
  onChange,
  inline = false,
}: {
  /** Nom du groupe, annoncé avec lui. */
  label: string;
  value: V;
  options: readonly SegmentedOption<V>[];
  onChange: (value: V) => void;
  /** Largeur intrinsèque, à côté d'un intitulé (Oui / Non). */
  inline?: boolean;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = options.findIndex((option) => option.value === value);
  // Une seule option dans la tabulation : la choisie, ou la première si la
  // valeur n'est dans aucune (sinon le groupe serait injoignable au clavier).
  const tabbable = selected === -1 ? 0 : selected;

  const choose = (index: number) => {
    const option = options[index];
    if (option === undefined || option.locked !== undefined) return;
    onChange(option.value);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index + 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index - 1;
    else return;
    event.preventDefault();
    // Retour au début et à la fin : le groupe est une boucle, comme un radio natif.
    next = (next + options.length) % options.length;
    refs.current[next]?.focus();
    // Déplacer ET choisir ; une option verrouillée reçoit le focus sans être choisie.
    choose(next);
  };

  const layout = inline
    ? 'inline-flex'
    : `grid ${COLUMNS[options.length] ?? 'grid-flow-col auto-cols-fr'}`;

  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-part="segmented"
      className={`${layout} gap-1 rounded-xl bg-[var(--surface-2)] p-1`}
    >
      {options.map((option, index) => {
        const checked = index === selected;
        const { locked } = option;
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-disabled={locked !== undefined ? true : undefined}
            aria-describedby={locked?.describedBy}
            tabIndex={index === tabbable ? 0 : -1}
            onClick={() => {
              choose(index);
            }}
            onKeyDown={(event) => {
              onKeyDown(event, index);
            }}
            className={`min-h-12 min-w-0 rounded-lg px-2 text-base font-semibold
              [overflow-wrap:anywhere] transition-colors duration-[var(--dur-1)]
              ease-[var(--ease-mech)] ${inline ? 'min-w-16' : ''}
              ${
                checked
                  ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                  : 'text-[var(--text-2)]'
              }
              ${locked !== undefined ? 'flex items-center justify-center gap-1.5 opacity-60' : ''}`}
          >
            {locked?.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
