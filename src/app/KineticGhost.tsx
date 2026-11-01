import type { CSSProperties } from 'react';

/** Une espace sécable écrasée par le vertical : l'insécable garde la silhouette du titre. */
const glyph = (char: string) => (char === ' ' ? ' ' : char);

/**
 * Le nom de l'écran en filigrane — en typographie cinétique, que seul le thème Cyber montre.
 *
 * Il défile lentement en boucle le long du bord droit (deux passages du titre, d'où une boucle sans
 * couture), ses lettres entrent une à une à l'arrivée, quelques-unes grésillent. Tout est dans la feuille
 * du thème, en `transform` et `opacity` : le compositeur le joue seul, sans coûter une image. Décoratif :
 * caché aux lecteurs d'écran, qui ont le vrai titre.
 */
export function KineticGhost({ text }: { text: string }) {
  const letters = [...text];
  const run = (copy: number) => (
    <span data-run="" key={copy}>
      {letters.map((char, index) => (
        <span key={index} data-letter="" style={{ '--i': index } as CSSProperties}>
          {glyph(char)}
        </span>
      ))}
    </span>
  );

  return (
    <span data-part="ghost" aria-hidden="true">
      <span data-track="">{[run(0), run(1)]}</span>
    </span>
  );
}
