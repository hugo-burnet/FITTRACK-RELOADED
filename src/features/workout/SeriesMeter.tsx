import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { LossShreds } from './LossShreds';

/**
 * Le compteur de séries de la séance, en barre de vie — que seul le thème Cyber montre (sa feuille le
 * cache ailleurs) : la ligne « 3 séries sur 15 » dit déjà tout, et reste la source pour un lecteur
 * d'écran. Un cran par série. Une série validée la soigne (`data-dir="up"`, un reflet) ; une série
 * annulée la frappe (`data-dir="down"`) et le cran perdu se détache, monte et s'évapore
 * (`data-hp="loss"`, hors de la barre, qui rogne).
 */
export function SeriesMeter({ done, total }: { done: number; total: number }) {
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);
  const [loss, setLoss] = useState<{ key: number; left: number; width: number } | null>(null);
  const previous = useRef(done);

  const shareOf = (count: number) => (total > 0 ? Math.min(1, Math.max(0, count / total)) : 0);

  useEffect(() => {
    const before = previous.current;
    previous.current = done;
    if (done === before) return;
    const lost = done < before;
    const shareBefore = total > 0 ? Math.min(1, Math.max(0, before / total)) : 0;
    const shareAfter = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
    const settle = setTimeout(() => {
      setDirection(lost ? 'down' : 'up');
      if (lost && shareBefore > shareAfter) {
        setLoss((last) => ({
          key: (last?.key ?? 0) + 1,
          left: Math.round(shareAfter * 100_000) / 1000,
          width: Math.round((shareBefore - shareAfter) * 100_000) / 1000,
        }));
      }
    }, 0);
    const clear = setTimeout(() => setDirection(null), 700);
    const gone = setTimeout(() => setLoss(null), 900);
    return () => {
      clearTimeout(settle);
      clearTimeout(clear);
      clearTimeout(gone);
    };
  }, [done, total]);

  const style = {
    '--v': `${shareOf(done) * 100}%`,
    '--notch': `${total > 0 ? 100 / total : 100}%`,
  } as CSSProperties;

  return (
    <span
      data-part="series-meter"
      data-dir={direction ?? undefined}
      aria-hidden="true"
      style={style}
    >
      <span data-hp="bar">
        <i data-hp="fill" />
      </span>
      {loss !== null && (
        <i key={loss.key} data-hp="loss" style={{ left: `${loss.left}%`, width: `${loss.width}%` }}>
          <LossShreds />
        </i>
      )}
    </span>
  );
}
