import { ChevronDownIcon } from './icons';

type Props = {
  /** The axis when idle ("Muscle"), the chosen value once engaged ("Haltères"). */
  label: string;
  active: boolean;
  onClick: () => void;
};

/**
 * Opens a picker, and shows what that picker currently holds.
 *
 * Engaged, it is a FILL of --color-accent carrying --color-accent-fg, never the
 * accent as text on a surface: the acid green sits at 1.3:1 on white, which is
 * the fill/ink split Lot 1 measured its way into.
 *
 * No clear "×" inside the chip. A 20px cross next to a 48px target is exactly
 * the thing you miss with damp fingers, and clearing a filter belongs where you
 * set it — the picker's first row — or in the empty state, on a full-size
 * button, at the one moment it is actually urgent.
 */
export function FilterChip({ label, active, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl pr-2.5 pl-4
        text-base font-semibold transition-colors duration-[var(--dur-1)] ease-[var(--ease-mech)]
        ${
          active
            ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
            : 'bg-[var(--surface-2)] text-[var(--text-1)]'
        }`}
    >
      <span className="truncate">{label}</span>
      <ChevronDownIcon className={active ? '' : 'text-[var(--text-2)]'} />
    </button>
  );
}
