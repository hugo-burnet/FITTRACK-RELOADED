// Parser déterministe des tableaux Markdown de F1/F2.
//
// Il ne reformule rien : les cellules restent le texte brut entre pipes.
// Les liens sont extraits EN PLUS du brut, jamais à sa place.

export function isTableRow(line) {
  return line.trim().startsWith('|');
}

export function isSeparatorRow(line) {
  if (!isTableRow(line)) return false;
  const cells = splitTableRow(line);
  if (cells.length === 0) return false;
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

export function splitTableRow(line) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('|')) return [];
  let inner = trimmed;
  if (inner.startsWith('|')) inner = inner.slice(1);
  if (inner.endsWith('|')) inner = inner.slice(0, -1);
  return inner.split('|').map((cell) => cell.trim());
}

export function extractMarkdownLinks(raw) {
  return locateMarkdownLinks(raw).map(({ label, url }) => ({ label, url }));
}

export function locateMarkdownLinks(raw) {
  const text = raw ?? '';
  const links = [];
  const re = /\[([^\]]+)\]\(([^)]+)\)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    links.push({
      label: m[1],
      url: m[2],
      markdown: m[0],
      start: m.index,
      end: m.index + m[0].length
    });
  }
  return links;
}

export function parseMarkdownTables(text) {
  const lines = text.split('\n');
  const tables = [];
  let i = 0;
  while (i < lines.length - 1) {
    if (isTableRow(lines[i]) && isSeparatorRow(lines[i + 1])) {
      const headerCells = splitTableRow(lines[i]);
      const headerLine = i + 1;
      const separatorLine = i + 2;
      const rows = [];
      let j = i + 2;
      while (j < lines.length && isTableRow(lines[j]) && !isSeparatorRow(lines[j])) {
        const rawText = lines[j];
        const values = splitTableRow(rawText);
        const cells = headerCells.map((header, idx) => {
          const raw = values[idx] ?? '';
          return { header, raw, links: extractMarkdownLinks(raw) };
        });
        rows.push({
          startLine: j + 1,
          endLine: j + 1,
          rawText,
          columnCount: values.length,
          expectedColumnCount: headerCells.length,
          cells
        });
        j += 1;
      }
      tables.push({
        startLine: headerLine,
        endLine: j,
        headerLine,
        separatorLine,
        headerCells,
        rows
      });
      i = j;
      continue;
    }
    i += 1;
  }
  return tables;
}
