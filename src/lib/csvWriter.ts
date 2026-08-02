/**
 * Writing the CSV that `hevyCsvRows` reads.
 *
 * Half a page, and worth its own module: an export that escapes by hand is the
 * classic way to ship a file that opens fine in a text editor and breaks the
 * day a session is named « Jambes, lourd » or a note contains a quote. The
 * round-trip test in `csvWriter.test.ts` pins the two halves together.
 */

/** Anything that would change the meaning of the row if left bare. */
const NEEDS_QUOTES = /[",\r\n]|^\s|\s$/;

function cell(value: string): string {
  return NEEDS_QUOTES.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * `\r\n` and a final newline: RFC 4180, and the form Excel expects. The reader
 * accepts both endings and ignores the trailing one, so nothing is riding on it
 * — but a file that is going to leave the app should look like every other CSV.
 */
export function serializeCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map(cell).join(',') + '\r\n').join('');
}
