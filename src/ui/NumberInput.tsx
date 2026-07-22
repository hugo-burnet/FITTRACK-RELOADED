import { useState } from 'react';

type Props = {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  placeholder?: string;
  'aria-label': string;
};

const NUMERIC = /^\d*[.,]?\d*$/;

const parse = (raw: string): number | undefined => {
  if (raw === '') return undefined;
  const parsed = Number(raw.replace(',', '.'));
  return Number.isNaN(parsed) ? undefined : parsed;
};

// The decimal separator is UI text, and this UI is French. Only ever applied to
// values arriving from outside — what you typed is left exactly as you typed it.
const format = (value: number | undefined): string =>
  value === undefined ? '' : String(value).replace('.', ',');

export function NumberInput({
  value,
  onChange,
  step = 2.5,
  min = 0,
  max = 9999,
  suffix,
  placeholder,
  ...aria
}: Props) {
  // Le champ garde sa propre chaîne de saisie : sans ça, "102," est reparsé en 102
  // et la virgule disparaît sous les doigts — décimale impossible à taper.
  const [draft, setDraft] = useState(() => format(value));
  const [lastValue, setLastValue] = useState(value);

  // Resynchronise seulement quand la valeur change réellement depuis l'extérieur
  // (pré-remplissage depuis la série précédente, boutons ±). Ajustement pendant le
  // rendu et non dans un effet : un effet afficherait d'abord une frame avec
  // l'ancienne chaîne, visible sur un pré-remplissage.
  if (value !== lastValue) {
    setLastValue(value);
    if (parse(draft) !== value) setDraft(format(value));
  }

  const handleInput = (raw: string) => {
    if (!NUMERIC.test(raw)) return; // refuse lettres et séparateurs multiples
    setDraft(raw);
    onChange(parse(raw));
  };

  const bump = (delta: number) => {
    const next = Math.min(max, Math.max(min, (value ?? 0) + delta));
    onChange(Number(next.toFixed(2)));
  };

  const stepper =
    'min-h-12 w-12 shrink-0 rounded-lg bg-[var(--surface-2)] text-xl text-[var(--text-1)] ' +
    'transition-transform duration-[var(--dur-1)] ease-[var(--ease-mech)] active:scale-[0.94]';

  return (
    <div className="flex items-stretch gap-1">
      <button type="button" aria-label="Diminuer" onClick={() => bump(-step)} className={stepper}>
        −
      </button>

      <div className="relative flex w-full">
        <input
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          value={draft}
          placeholder={placeholder}
          onChange={(e) => handleInput(e.target.value)}
          // La touche « OK » du clavier du téléphone. Sans ça elle ne fait
          // rien : hors d'un <form>, Entrée n'a aucune action par défaut, et le
          // clavier reste devant la feuille. C'est le blur qui le referme.
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.currentTarget.blur();
            }
          }}
          onFocus={(e) => e.target.select()} // remplacer la valeur d'un geste, pas la corriger
          className={`metric min-h-12 w-full rounded-lg bg-[var(--surface-2)] text-center text-xl
            font-semibold text-[var(--text-1)] outline-none placeholder:font-normal
            placeholder:text-[var(--text-2)] focus:ring-2 focus:ring-[var(--accent-ink)]
            ${suffix ? 'pr-9 pl-9' : ''}`}
          {...aria}
        />
        {/* Engraved register, but NOT uppercased: SI symbols are case-sensitive,
            it is "kg" and never "KG". */}
        {suffix && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-3 flex items-center
              text-[0.6875rem] font-semibold tracking-[0.08em] text-[var(--text-2)]"
          >
            {suffix}
          </span>
        )}
      </div>

      <button type="button" aria-label="Augmenter" onClick={() => bump(step)} className={stepper}>
        +
      </button>
    </div>
  );
}
