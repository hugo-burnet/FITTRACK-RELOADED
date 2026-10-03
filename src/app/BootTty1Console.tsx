import { useMemo, useState, type CSSProperties } from 'react';
import { prefersReducedMotion } from '@/platform/reducedMotion';
import type { BootLine, BootScript } from './bootTty1Script';
import { useBootClock } from './useBootClock';

/** `[ OK ]`, `[ WARN ]`, `[ FAIL ]` : le niveau d'une ligne d'état, au début de son texte. */
const LEVEL = /^\[ (OK|WARN|FAIL) \]/;

/** `[    0.04]` : l'horodatage d'une ligne du noyau, au début de son texte. */
const STAMP = /^\[ *\d+\.\d\d\]/;

/**
 * Six cases et une étoile, que le CSS fait défiler : `[*     ]`, `[ *    ]`… La piste est deux fois
 * plus longue que la fenêtre (`.boot-tty1-spin`) et glisse d'une case par pas, ce qui évite
 * d'animer `content` — les WebView Android plus anciennes ne savent pas le faire.
 */
const SPINNER_TRACK = '      *     ';

/**
 * Une ligne de la console. Les crochets d'un niveau restent gris et seul le mot prend sa couleur,
 * comme sur une console Linux : `[` OK `]`. Le texte reste celui de `fr.ts`, découpé ici plutôt que
 * réécrit, pour que la console de l'ouverture normale et celle-ci disent la même chose.
 */
function BootTty1Line({ text }: { text: string }) {
  const level = LEVEL.exec(text);
  if (level !== null) {
    const word = level[1] ?? '';
    return (
      <p className="boot-tty1-line">
        <span className="boot-tty1-bracket">[</span>{' '}
        <span className="boot-tty1-tag" data-level={word.toLowerCase()}>
          {word}
        </span>{' '}
        <span className="boot-tty1-bracket">]</span>
        {text.slice(level[0].length)}
      </p>
    );
  }

  const stamp = STAMP.exec(text);
  if (stamp !== null) {
    return (
      <p className="boot-tty1-line">
        <span className="boot-tty1-stamp">{stamp[0]}</span>
        {text.slice(stamp[0].length)}
      </p>
    );
  }

  // Une ligne vide garde sa hauteur : sans caractère, le paragraphe s'effondrerait.
  return <p className="boot-tty1-line">{text === '' ? ' ' : text}</p>;
}

function BootTty1Row({
  line,
  elapsed,
  cursor,
}: {
  line: BootLine;
  elapsed: number;
  cursor: boolean;
}) {
  switch (line.kind) {
    case 'text':
      return <BootTty1Line text={line.text} />;

    case 'comment':
      return <p className="boot-tty1-comment">{line.text}</p>;

    case 'command':
      return (
        <p className="boot-tty1-prompt">
          <span>{line.prompt}&nbsp;</span>
          {/* La commande et son curseur voyagent ensemble : sur un téléphone trop étroit, c'est la
              commande entière qui passe à la ligne suivante, jamais son curseur seul. */}
          <span className="boot-tty1-input">
            <span
              className="boot-tty1-command"
              style={{ '--chars': line.text.length } as CSSProperties}
            >
              {line.text}
            </span>
            {cursor && <span className="boot-tty1-cursor">█</span>}
          </span>
        </p>
      );

    case 'gate':
      // La même ligne, d'abord en attente, puis remplacée par sa validation : comme sur une
      // machine, où le service qu'on attend se réécrit en place au lieu de laisser deux lignes.
      return elapsed >= line.doneAt ? (
        <BootTty1Line text={line.done} />
      ) : (
        <p className="boot-tty1-line">
          <span className="boot-tty1-bracket">[</span>
          <span className="boot-tty1-spin">
            <span>{SPINNER_TRACK}</span>
          </span>
          <span className="boot-tty1-bracket">]</span> {line.waiting}
        </p>
      );
  }
}

/**
 * La console de l'ouverture TTY1 : les lignes du script se posent au fil de l'horloge, sous le
 * logo, et les plus anciennes sortent par le haut (le CSS ancre la colonne en bas).
 *
 * Elles sont ajoutées à la page quand leur heure sonne, pas toutes présentes avec un délai : avec
 * toutes les lignes déjà posées, la pile occuperait sa hauteur finale dès la première image et rien
 * ne défilerait — les lignes se révéleraient sur place, du haut vers le bas.
 *
 * `exiting` (le rideau qui se retire) et le mouvement réduit montrent le script entier d'emblée :
 * le premier ne doit rien rejouer, le second n'a rien demandé à regarder.
 */
export function BootTty1Console({ script, exiting }: { script: BootScript; exiting: boolean }) {
  const instants = useMemo(
    () =>
      script.lines.flatMap((line) => (line.kind === 'gate' ? [line.at, line.doneAt] : [line.at])),
    [script],
  );
  // Lu une fois : on ne change pas ses préférences système pendant qu'une app s'ouvre.
  const [reducedMotion] = useState(prefersReducedMotion);
  const elapsed = useBootClock(instants, exiting || reducedMotion);

  const shown = script.lines.filter((line) => line.at <= elapsed);

  // Le curseur est sur la dernière commande tant qu'aucune sortie ne la suit — une ligne de devise,
  // un commentaire, ne la lui prend pas : c'est le curseur de l'invite finale.
  const cursorAt = shown.reduce(
    (found, line, index) =>
      line.kind === 'command' ? index : line.kind === 'comment' ? found : -1,
    -1,
  );

  return (
    <div className="boot-tty1" aria-hidden="true">
      <div className="boot-tty1-window">
        <div className="boot-tty1-lines">
          {shown.map((line, index) => (
            <BootTty1Row key={index} line={line} elapsed={elapsed} cursor={index === cursorAt} />
          ))}
        </div>
      </div>
    </div>
  );
}
