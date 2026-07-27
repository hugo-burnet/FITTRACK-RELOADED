export interface CsvRow {
  line: number;
  cells: string[];
}

export type CsvRowsResult =
  | { ok: true; rows: CsvRow[] }
  | { ok: false; line: number };

export function readCsvRows(input: string): CsvRowsResult {
  const text = input.startsWith('\uFEFF') ? input.slice(1) : input;
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let cell = '';
  let line = 1;
  let rowLine = 1;
  let quoted = false;
  let afterQuote = false;

  const finishCell = () => {
    cells.push(cell);
    cell = '';
    afterQuote = false;
  };

  const finishRow = () => {
    finishCell();
    rows.push({ line: rowLine, cells });
    cells = [];
    rowLine = line + 1;
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
          afterQuote = true;
        }
      } else {
        cell += character;
        if (character === '\n') line += 1;
        else if (character === '\r' && text[index + 1] !== '\n') line += 1;
      }
      continue;
    }

    if (afterQuote && character !== ',' && character !== '\r' && character !== '\n') {
      return { ok: false, line: rowLine };
    }

    if (character === '"') {
      if (cell !== '') return { ok: false, line: rowLine };
      quoted = true;
      continue;
    }

    if (character === ',') {
      finishCell();
      continue;
    }

    if (character === '\r' || character === '\n') {
      finishRow();
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      line += 1;
      rowLine = line;
      continue;
    }

    cell += character;
  }

  if (quoted) return { ok: false, line: rowLine };
  if (cell !== '' || cells.length > 0 || afterQuote) finishRow();

  return { ok: true, rows };
}
