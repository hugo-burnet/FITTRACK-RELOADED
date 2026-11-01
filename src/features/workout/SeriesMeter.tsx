import { useEffect, useRef, useState, type CSSProperties } from 'react';

/**
 * Le compteur de séries de la séance, en barre de vie — que seul le thème Cyber montre (sa feuille le
 * cache ailleurs) : la ligne « 3 séries sur 15 » dit déjà tout, et reste la source pour un lecteur
 * d'écran. Un cran par série. Une série validée la soigne (`data-dir="up"`), une série annulée la
 * frappe (`data-dir="down"`) : la feuille dessine le reflet ou la traînée blanche.
 */
export function SeriesMeter({ done, total }: { done: number; total: number }) {
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  const previous = useRef(done);

  useEffect(() => {
    const before = previous.current;
    previous.current = done;
    if (done === before) return;
    const settle = setTimeout(() => setDirection(done > before ? 'up' : 'down'), 0);
    const clear = setTimeout(() => setDirection(null), 700);
    return () => {
      clearTimeout(settle);
      clearTimeout(clear);
    };
  }, [done]);

  const share = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  const style = {
    '--v': `${share * 100}%`,
    '--notch': `${total > 0 ? 100 / total : 100}%`,
  } as CSSProperties;

  return (
    <span data-part="series-meter" data-dir={direction ?? undefined} aria-hidden="true" style={style}>
      <i data-hp="ghost" />
      <i data-hp="fill" />
    </span>
  );
}
