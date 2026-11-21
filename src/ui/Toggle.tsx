/**
 * An on/off switch with a visible mark beside it.
 *
 * A `HeaderAction` is a command: you press it, something happens, the button
 * looks the same afterwards. `aria-pressed` says otherwise but nothing on the
 * screen does — reported from the phone about the deload, where a lit `80%`
 * square read as a button that had simply been tapped rather than as a state
 * the session is now in. A switch shows its state in its shape, so a glance
 * answers "is this on?" without remembering having tapped it.
 *
 * The whole control is one 48px-high target: the mark is part of the switch,
 * not a label sitting next to it.
 */
export function Toggle({
  label,
  mark,
  checked,
  disabled = false,
  onChange,
}: {
  /** Announced name — the mark alone ("80%") does not say what it does. */
  label: string;
  /** The word or figure shown beside the track. */
  mark: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      // Dimmed only when it is off AND unavailable. A switch that is on stays at
      // full contrast even though it is disabled: "deload applied" is the state
      // the session is in — the one figure you want readable mid-set — and not a
      // command that happens to be out of reach.
      className={`flex h-12 shrink-0 items-center gap-2 rounded-xl px-2
        transition-colors duration-[var(--dur-1)] active:bg-[var(--surface-1)]
        ${disabled && !checked ? 'opacity-40' : ''}`}
    >
      <span
        className={`metric text-xs font-bold ${
          checked ? 'text-[var(--accent-ink)]' : 'text-[var(--text-2)]'
        }`}
        aria-hidden="true"
      >
        {mark}
      </span>
      <span
        aria-hidden="true"
        className={`relative block h-6 w-10 rounded-full border transition-colors
          duration-[var(--dur-2)] ${
            checked
              ? 'border-transparent bg-[var(--accent-fill)]'
              : 'border-[var(--border)] bg-[var(--surface-2)]'
          }`}
      >
        <span
          className={`absolute top-1/2 left-0.5 size-4.5 -translate-y-1/2 rounded-full
            transition-transform duration-[var(--dur-2)] ease-[var(--ease-mech)] ${
              checked
                ? 'translate-x-[15px] bg-[var(--accent-on-fill)]'
                : 'bg-[var(--text-2)]'
            }`}
        />
      </span>
    </button>
  );
}
