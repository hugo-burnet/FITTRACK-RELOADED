/**
 * Les mécaniques d'un document markdown : une cellule, une ligne, une date.
 *
 * Extraites de `serializeMarkdown` le jour où un second sérialiseur est apparu
 * (les routines). Rien n'y a changé de comportement — c'est le même code, au
 * même endroit pour les deux documents, et c'est tout l'intérêt : un pipe
 * échappé d'un côté et pas de l'autre produit un tableau qui se casse dans un
 * document sur deux, sans que rien ne le dise à la génération.
 *
 * Ce fichier ne décide de rien sur le fond. Ce qu'un chiffre *veut dire* reste
 * l'affaire de `lib/measurement` et des projections ; ici on ne sait que le
 * placer dans une case.
 */

/** « 102,5 » — un nombre est du texte d'interface, et il se lit à la française. */
export const decimal = (value: number): string => value.toLocaleString('fr-FR');

const MONTHS = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** `'2026-07-27'` → « 27 juillet 2026 », lu comme un jour du calendrier et rien d'autre. */
export function frenchDate(isoDate: string): string {
  const [year = '0', month = '1', day = '1'] = isoDate.split('-');
  return MONTHS.format(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

/** Un horodatage, comme le jour civil qu'il occupe **là où le lecteur est**. */
export function frenchDateOf(at: number): string {
  const local = new Date(at);
  return MONTHS.format(Date.UTC(local.getFullYear(), local.getMonth(), local.getDate()));
}

/** Un pipe ferme une case et un saut de ligne ferme une ligne. Rien d'autre n'en casse une. */
export const cell = (text: string): string =>
  text.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');

export const tableRow = (cells: string[]): string => `| ${cells.map(cell).join(' | ')} |`;

export interface MarkdownColumn<T> {
  label: string;
  /** Chiffres à droite, mots à gauche — le seul alignement qu'un tableau markdown porte. */
  numeric: boolean;
  of: (row: T) => string;
}

/** L'en-tête, le filet d'alignement, et les lignes. */
export function markdownTable<T>(
  columns: readonly MarkdownColumn<T>[],
  rows: readonly T[],
): string[] {
  return [
    tableRow(columns.map((column) => column.label)),
    `|${columns.map((column) => (column.numeric ? '---:' : '---')).join('|')}|`,
    ...rows.map((row) => tableRow(columns.map((column) => column.of(row)))),
  ];
}

/**
 * Un document rendu : les lignes jointes, les blancs répétés ramenés à un, et
 * une seule fin de ligne — un document collé dans une conversation ne doit pas
 * s'ouvrir sur un écran de vide.
 */
export const renderDocument = (lines: readonly string[]): string =>
  `${lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd()}\n`;
