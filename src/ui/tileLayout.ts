/**
 * Le placement des tuiles d'une grille modulaire (DESIGN.md › « Grille modulaire »).
 *
 * Pourquoi une fonction et pas du CSS : une rangée incomplète doit se remplir en élargissant une tuile, la
 * plus importante, et le CSS ne sait pas le faire quand les tailles sont mêlées. Le CSS décide du nombre de
 * colonnes, cette fonction de ce qu'y occupe chaque tuile ; l'ordre visuel reste celui du DOM.
 */
export type TileSize = 'S' | 'L' | 'G';
export type TileColumns = 1 | 2 | 3;

const baseOf = (size: TileSize, columns: number): number =>
  size === 'S' ? 1 : size === 'L' ? Math.min(2, columns) : columns;

/** Le nombre de rangées du rangement glouton, sans élargissement, de largeurs de base. */
function greedyRows(bases: readonly number[], from: number, columns: number): number {
  let rows = 0;
  let filled = 0;
  for (let index = from; index < bases.length; index += 1) {
    const base = bases[index] ?? 1;
    if (filled + base > columns) {
      rows += 1;
      filled = base;
    } else {
      filled += base;
    }
  }
  return filled > 0 ? rows + 1 : rows;
}

/** Place un segment sans `G` : le moins de rangées, puis la première tuile de chaque rangée la plus large. */
function placeSegment(bases: readonly number[], columns: number): number[] {
  const spans: number[] = [];
  let start = 0;
  let rowsLeft = greedyRows(bases, 0, columns);

  while (start < bases.length) {
    // Le moins de tuiles possible dans cette rangée, tant que la suite tient dans les rangées restantes.
    let count = 1;
    let used = bases[start] ?? 1;
    while (
      start + count < bases.length &&
      greedyRows(bases, start + count, columns) > rowsLeft - 1
    ) {
      used += bases[start + count] ?? 1;
      count += 1;
    }
    // Le vide de la rangée va à sa première tuile.
    spans.push((bases[start] ?? 1) + (columns - used));
    for (let offset = 1; offset < count; offset += 1) spans.push(bases[start + offset] ?? 1);
    start += count;
    rowsLeft -= 1;
  }
  return spans;
}

/** La largeur, en colonnes, de chaque tuile, dans l'ordre reçu. Pure et totale. */
export function placeTiles(sizes: readonly TileSize[], columns: TileColumns): number[] {
  const spans: number[] = [];
  let segment: number[] = [];
  const flush = (): void => {
    spans.push(...placeSegment(segment, columns));
    segment = [];
  };

  for (const size of sizes) {
    if (size === 'G') {
      flush();
      spans.push(columns);
    } else {
      segment.push(baseOf(size, columns));
    }
  }
  flush();
  return spans;
}
