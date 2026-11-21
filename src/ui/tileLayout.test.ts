import { describe, expect, it } from 'vitest';
import { placeTiles, type TileColumns, type TileSize } from './tileLayout';

const parse = (suite: string): TileSize[] =>
  suite === '' ? [] : suite.split(' ').map((size) => size as TileSize);
const spans = (text: string): number[] => (text === '' ? [] : text.split(' ').map(Number));

/** « 1 … » dans la table de DESIGN.md veut dire : que des 1, autant que de tuiles. */
const ones = (suite: string): string =>
  parse(suite)
    .map(() => '1')
    .join(' ');

// La table de « Grille modulaire › Rangées pleines », DESIGN.md : entrée → largeurs à 1 / 2 / 3 colonnes.
const TABLE: readonly (readonly [string, string, string, string])[] = [
  ['', '', '', ''],
  ['S', '1', '2', '3'],
  ['S S', '1 1', '1 1', '2 1'],
  ['S S S', '1 1 1', '2 1 1', '1 1 1'],
  ['S S S S', '1 1 1 1', '1 1 1 1', '3 1 1 1'],
  ['S S S S S', '1 1 1 1 1', '2 1 1 1 1', '2 1 1 1 1'],
  ['S S S S S S S', ones('S S S S S S S'), '2 1 1 1 1 1 1', '3 1 1 1 1 1 1'],
  ['L', '1', '2', '3'],
  ['L S', '1 1', '2 2', '2 1'],
  ['S L', '1 1', '2 2', '1 2'],
  ['L L', '1 1', '2 2', '3 3'],
  ['L S S', '1 1 1', '2 1 1', '3 2 1'],
  ['S L S', '1 1 1', '2 2 2', '3 2 1'],
  ['S S L', '1 1 1', '1 1 2', '3 1 2'],
  ['S L S S', '1 1 1 1', '2 2 1 1', '1 2 2 1'],
  ['L S L', '1 1 1', '2 2 2', '3 1 2'],
  ['G', '1', '2', '3'],
  ['G S', '1 1', '2 2', '3 3'],
  ['S S G', '1 1 1', '1 1 2', '2 1 3'],
  ['G S S', '1 1 1', '2 1 1', '3 2 1'],
  ['S S G S', '1 1 1 1', '1 1 2 2', '2 1 3 3'],
  ['S S G S S S S', ones('S S G S S S S'), '1 1 2 1 1 1 1', '2 1 3 3 1 1 1'],
  ['L S G', '1 1 1', '2 2 2', '2 1 3'],
];

describe('placeTiles, table de DESIGN.md', () => {
  for (const [suite, one, two, three] of TABLE) {
    const label = suite === '' ? '[]' : suite;
    it(`${label} à 1 colonne`, () => {
      expect(placeTiles(parse(suite), 1)).toEqual(spans(one));
    });
    it(`${label} à 2 colonnes`, () => {
      expect(placeTiles(parse(suite), 2)).toEqual(spans(two));
    });
    it(`${label} à 3 colonnes`, () => {
      expect(placeTiles(parse(suite), 3)).toEqual(spans(three));
    });
  }
});

// --- Oracle de force brute -------------------------------------------------------------------

const baseOf = (size: TileSize, columns: number): number =>
  size === 'S' ? 1 : size === 'L' ? Math.min(2, columns) : columns;

/** Les rangées d'une suite de largeurs, ou null si l'une n'est pas pleine ou si une largeur la coupe. */
function rowsOf(widths: readonly number[], columns: number): number | null {
  let filled = 0;
  let rows = 0;
  for (const width of widths) {
    filled += width;
    if (filled > columns) return null;
    if (filled === columns) {
      rows += 1;
      filled = 0;
    }
  }
  return filled === 0 ? rows : null;
}

/** Rangement glouton sans élargissement : une `G` seule, le reste dans l'ordre. */
function greedyRows(sizes: readonly TileSize[], columns: number): number {
  let rows = 0;
  let filled = 0;
  for (const size of sizes) {
    const base = baseOf(size, columns);
    if (size === 'G') {
      if (filled > 0) rows += 1;
      rows += 1;
      filled = 0;
    } else if (filled + base > columns) {
      rows += 1;
      filled = base;
    } else {
      filled += base;
    }
  }
  return filled > 0 ? rows + 1 : rows;
}

/** Moins de rangées d'abord, puis la plus grande première largeur, puis la deuxième, etc. */
function oracle(sizes: readonly TileSize[], columns: number): number[] {
  let best: number[] | null = null;
  let bestRows = Infinity;
  const walk = (index: number, current: number[]): void => {
    if (index === sizes.length) {
      const rows = rowsOf(current, columns);
      if (rows === null) return;
      if (best === null || rows < bestRows) {
        best = [...current];
        bestRows = rows;
      } else if (rows === bestRows) {
        for (let at = 0; at < current.length; at += 1) {
          const a = current[at] ?? 0;
          const b = best[at] ?? 0;
          if (a !== b) {
            if (a > b) best = [...current];
            break;
          }
        }
      }
      return;
    }
    const size = sizes[index] ?? 'S';
    for (let width = baseOf(size, columns); width <= columns; width += 1) {
      // Une `G` prend la rangée entière ; une rangée pleine la garde seule.
      if (size === 'G' && width !== columns) continue;
      current.push(width);
      walk(index + 1, current);
      current.pop();
    }
  };
  walk(0, []);
  return best ?? [];
}

function* suites(maxLength: number): Generator<TileSize[]> {
  const sizes: TileSize[] = ['S', 'L', 'G'];
  function* extend(prefix: TileSize[]): Generator<TileSize[]> {
    yield prefix;
    if (prefix.length === maxLength) return;
    for (const size of sizes) yield* extend([...prefix, size]);
  }
  yield* extend([]);
}

describe('placeTiles, propriétés', () => {
  const columnCounts: TileColumns[] = [1, 2, 3];
  const all = [...suites(7)];

  it('couvre toutes les suites de S, L, G jusqu’à 7 tuiles', () => {
    expect(all).toHaveLength((3 ** 8 - 1) / 2);
  });

  it('a la longueur de l’entrée, et base ≤ largeur ≤ colonnes', () => {
    for (const suite of all) {
      for (const columns of columnCounts) {
        const result = placeTiles(suite, columns);
        expect(result).toHaveLength(suite.length);
        result.forEach((width, index) => {
          expect(width).toBeGreaterThanOrEqual(baseOf(suite[index] ?? 'S', columns));
          expect(width).toBeLessThanOrEqual(columns);
        });
      }
    }
  });

  it('remplit chaque rangée exactement, dans l’ordre, avec le nombre de rangées du rangement glouton', () => {
    for (const suite of all) {
      for (const columns of columnCounts) {
        const result = placeTiles(suite, columns);
        expect(rowsOf(result, columns), `${suite.join(' ')} à ${columns}`).toBe(
          greedyRows(suite, columns),
        );
      }
    }
  });

  it('égale l’oracle : moins de rangées, puis lexicographique', () => {
    for (const suite of all) {
      for (const columns of columnCounts) {
        expect(placeTiles(suite, columns), `${suite.join(' ')} à ${columns}`).toEqual(
          oracle(suite, columns),
        );
      }
    }
  });
});
