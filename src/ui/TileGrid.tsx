import {
  Children,
  Fragment,
  isValidElement,
  useId,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { SectionTitle } from './SectionTitle';
import { placeTiles, type TileSize } from './tileLayout';

type TileGridProps = {
  /** Un `SectionTitle` ; la section en prend son nom. */
  title?: string;
  /** Des éléments qui portent chacun `size` : `Tile`, ou un composant qui la transmet. */
  children: ReactNode;
};

const SIZES: readonly string[] = ['S', 'L', 'G'];

function sizeOf(child: ReactNode): TileSize {
  if (isValidElement(child) && child.type !== Fragment) {
    const size = (child.props as { size?: unknown }).size;
    if (typeof size === 'string' && SIZES.includes(size)) return size as TileSize;
  }
  // Une tuile qu'on ne sait pas placer est un bogue, pas un repli.
  throw new Error('TileGrid: chaque enfant doit porter une `size` (S, L ou G), sans fragment.');
}

/**
 * Un groupe de tuiles qui répond à une question. Le CSS (`@container`) décide du nombre de colonnes selon la
 * largeur du groupe, `placeTiles` de ce qu'y occupe chaque tuile : les trois résultats voyagent en variables
 * CSS, et la requête de conteneur choisit — pas de `ResizeObserver`, pas de rendu en deux temps.
 */
export function TileGrid({ title, children }: TileGridProps) {
  const titleId = useId();
  // `toArray` écarte les enfants absents : une tuile conditionnelle qui n'est pas là sort du placement.
  const tiles = Children.toArray(children);
  const sizes = tiles.map(sizeOf);
  const one = placeTiles(sizes, 1);
  const two = placeTiles(sizes, 2);
  const three = placeTiles(sizes, 3);

  return (
    <section className="@container" aria-labelledby={title === undefined ? undefined : titleId}>
      {title !== undefined && <SectionTitle id={titleId}>{title}</SectionTitle>}
      <ul
        role="list"
        className="grid grid-cols-1 gap-3 @min-[15.5rem]:grid-cols-2 @min-[30rem]:grid-cols-3"
      >
        {tiles.map((tile, index) => (
          <li
            key={(tile as ReactElement).key}
            className="flex min-w-0 col-span-(--tile-span-1) @min-[15.5rem]:col-span-(--tile-span-2) @min-[30rem]:col-span-(--tile-span-3)"
            style={
              {
                '--tile-span-1': one[index],
                '--tile-span-2': two[index],
                '--tile-span-3': three[index],
              } as CSSProperties
            }
          >
            {tile}
          </li>
        ))}
      </ul>
    </section>
  );
}
