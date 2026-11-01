import type { CSSProperties } from 'react';

/**
 * Les éclats de la coche : huit fragments, tirés vers la gauche et la verticale (la carte rogne à
 * droite). Des angles fixes et non tirés au sort : un rendu doit rester le même d'une fois à l'autre,
 * et huit directions bien réparties suffisent à faire « éclater ».
 */
const SHARDS = [
  { angle: 100, distance: 34, size: 4, delay: 0 },
  { angle: 125, distance: 46, size: 5, delay: 10 },
  { angle: 150, distance: 30, size: 3, delay: 0 },
  { angle: 170, distance: 50, size: 4, delay: 20 },
  { angle: 192, distance: 38, size: 5, delay: 0 },
  { angle: 215, distance: 44, size: 3, delay: 10 },
  { angle: 238, distance: 32, size: 4, delay: 0 },
  { angle: 258, distance: 40, size: 3, delay: 20 },
] as const;

/**
 * L'impact d'une série validée, dans le thème Cyber : deux ondes, quatre équerres qui se
 * verrouillent, huit éclats, l'étiquette de ce que la série a ajouté.
 *
 * Décoratif de bout en bout (`aria-hidden`) : la coche dit déjà son état par `aria-pressed`, et
 * l'étiquette répète un nombre que la ligne affiche. Monté à chaque validation (sa clé change), il
 * rejoue ses animations CSS ; hors du thème Cyber, la feuille de style le cache.
 */
export function SetCheckFx({ tag }: { tag: string }) {
  return (
    <span data-part="set-fx" aria-hidden="true">
      <span data-fx="ring" />
      <span data-fx="ring" data-late="" />
      <span data-fx="lock" />
      <span data-fx="shards">
        {SHARDS.map(({ angle, distance, size, delay }) => {
          const radians = (angle * Math.PI) / 180;
          const style = {
            '--dx': `${(Math.cos(radians) * distance).toFixed(1)}px`,
            '--dy': `${(-Math.sin(radians) * distance).toFixed(1)}px`,
            '--s': `${size}px`,
            '--d': `${delay}ms`,
          } as CSSProperties;
          return <i key={angle} style={style} />;
        })}
      </span>
      <span data-fx="tag">{tag}</span>
    </span>
  );
}
