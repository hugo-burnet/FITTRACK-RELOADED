#!/usr/bin/env node
// E1 — extraction déterministe des lignes de tableaux Markdown (F1, F2).
//
// Produit des ExtractionCandidate, jamais d'entités curated. Pas de LLM.
// Même entrée = même sortie : extractedAt et runId ne viennent pas de l'horloge.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseMarkdownTables } from './parse-markdown-table.mjs';
import { resolveCorpusFile } from './resolve-corpus.mjs';

export const EXTRACTOR_VERSION = '0.1.0-e1';
export const EXTRACTED_AT = '2026-08-23T00:00:00.000Z';

const E1_FILES = [
  'corpus.f1.programmation-hypertrophie',
  'corpus.f2.anatomie-biomecanique'
];

export const sha256 = (value) =>
  'sha256:' + createHash('sha256').update(value, typeof value === 'string' ? 'utf8' : undefined).digest('hex');

export function lineByteStarts(text) {
  const lines = text.split('\n');
  const starts = new Array(lines.length);
  let acc = 0;
  for (let i = 0; i < lines.length; i++) {
    starts[i] = acc;
    acc += Buffer.byteLength(lines[i], 'utf8') + 1;
  }
  return starts;
}

function headingPathFor(lines, startLine) {
  const path = [];
  for (let i = 0; i < startLine - 1; i++) {
    const m = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (!m) continue;
    const level = m[1].length;
    path.length = Math.min(path.length, level - 1);
    path[level - 1] = m[2].trim();
  }
  return path.filter((x) => typeof x === 'string');
}

function targetKindFor(headers) {
  if (headers.includes('Affirmation principale') || headers.includes('Conclusion la plus défendable')) {
    return 'claim';
  }
  if (headers.includes('DOI') && (headers.includes('PMID') || headers.includes('Publication'))) {
    return 'source';
  }
  if (headers.includes('Désaccord') || headers.includes('Nuance ou contradiction')) {
    return 'evidence-conflict';
  }
  if (headers.includes('Critère') && headers.includes('Question à poser')) {
    return 'substitution-relation';
  }
  return 'unmapped_table_row';
}

function rawStatementFor(kind, cells) {
  if (kind !== 'claim') return undefined;
  const cell =
    cells.find((c) => c.header === 'Affirmation principale') ??
    cells.find((c) => c.header === 'Conclusion la plus défendable');
  return cell?.raw;
}

function fragmentRefFor(fragments, corpusFileId, startLine, fallbackSeq) {
  const hit = fragments.find(
    (f) =>
      f.corpusFileId === corpusFileId &&
      f.startLine === startLine &&
      f.endLine === startLine &&
      f.blockType === 'table_row'
  );
  if (hit) return hit.fragmentId;
  return `frag.e1.${String(fallbackSeq).padStart(4, '0')}`;
}

export function extractE1FromText({
  corpusFileId,
  text,
  fragments = [],
  extractorVersion = EXTRACTOR_VERSION,
  runId,
  extractedAt = EXTRACTED_AT
}) {
  const bytes = Buffer.from(text, 'utf8');
  const lines = text.split('\n');
  const starts = lineByteStarts(text);
  const tables = parseMarkdownTables(text);
  const candidates = [];
  const diagnostics = [];
  let unmatched = 0;

  for (const table of tables) {
    const kind = targetKindFor(table.headerCells);
    for (const row of table.rows) {
      const startByte = starts[row.startLine - 1];
      const rawRow = row.rawText;
      const endByte = startByte + Buffer.byteLength(rawRow, 'utf8');
      const reread = bytes.subarray(startByte, endByte).toString('utf8');
      if (reread !== rawRow) {
        diagnostics.push({
          type: 'offset_mismatch',
          corpusFileId,
          startLine: row.startLine,
          endLine: row.endLine,
          value: rawRow,
          schema: 'extraction-candidate.schema.json',
          message: 'La relecture aux offsets ne reproduit pas la ligne.'
        });
        continue;
      }

      if (row.columnCount !== row.expectedColumnCount) {
        diagnostics.push({
          type: 'column_count_mismatch',
          corpusFileId,
          startLine: row.startLine,
          endLine: row.endLine,
          startByte,
          value: rawRow,
          expectedColumnCount: row.expectedColumnCount,
          actualColumnCount: row.columnCount,
          schema: 'extraction-candidate.schema.json',
          message: `La ligne a ${row.columnCount} cellule(s), le header en a ${row.expectedColumnCount}.`
        });
      }

      const existing = fragments.some(
        (f) =>
          f.corpusFileId === corpusFileId &&
          f.startLine === row.startLine &&
          f.blockType === 'table_row'
      );
      if (!existing) unmatched += 1;
      const fragmentRef = fragmentRefFor(fragments, corpusFileId, row.startLine, unmatched);

      const idSeed = `${corpusFileId}\n${startByte}\n${rawRow}`;
      const candidateId = `cand.e1.${sha256(idSeed).slice(7, 23)}`;
      const rawStatement = rawStatementFor(kind, row.cells);
      const payload = {
        rawRow,
        startLine: row.startLine,
        endLine: row.endLine,
        headingPath: headingPathFor(lines, row.startLine),
        tableHeaderCells: table.headerCells,
        cells: row.cells,
        columnCount: row.columnCount,
        expectedColumnCount: row.expectedColumnCount
      };
      if (rawStatement !== undefined) payload.rawStatement = rawStatement;

      candidates.push({
        candidateId,
        targetKind: kind,
        fragmentRef,
        corpusFileRef: corpusFileId,
        extraction: {
          method: 'deterministic_table_row',
          runId,
          extractedAt,
          extractorVersion
        },
        payload,
        verbatimSpan: { text: rawRow, startByte, endByte },
        reviewState: 'pending_human_review'
      });
    }
  }

  return { candidates, diagnostics, tables: tables.length };
}

export function extractE1FromCorpusFiles({ files, fragments, extractorVersion = EXTRACTOR_VERSION }) {
  const snapshot = files.map((f) => ({
    corpusFileId: f.corpusFileId,
    contentHash: sha256(f.bytes),
    originalFilename: f.originalFilename
  }));
  const runId = `run.e1.${sha256(extractorVersion + JSON.stringify(snapshot)).slice(7, 19)}`;
  const candidates = [];
  const diagnostics = [];
  let tables = 0;
  for (const f of files) {
    const text = f.bytes.toString('utf8');
    const out = extractE1FromText({
      corpusFileId: f.corpusFileId,
      text,
      fragments,
      extractorVersion,
      runId,
      extractedAt: EXTRACTED_AT
    });
    candidates.push(...out.candidates);
    diagnostics.push(...out.diagnostics);
    tables += out.tables;
  }
  return { candidates, diagnostics, tables, runId, extractedAt: EXTRACTED_AT, extractorVersion, snapshot };
}

function isCli() {
  const self = fileURLToPath(import.meta.url).replaceAll('\\', '/');
  const argv = (process.argv[1] ?? '').replaceAll('\\', '/');
  return argv.endsWith('extract-e1.mjs') || argv.endsWith(self.split('/').pop());
}

if (isCli()) {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = join(here, '..');
  const repoRoot = join(root, '..');
  const config = JSON.parse(readFileSync(join(root, 'corpus/corpus-files.config.json'), 'utf8'));
  const fragments = JSON.parse(readFileSync(join(root, 'fragments/fragments.json'), 'utf8')).fragments;

  const files = [];
  for (const f of config.files.filter((file) => E1_FILES.includes(file.corpusFileId))) {
    const hit = resolveCorpusFile(f, { packageRoot: root, repoRoot, archiveRef: config.archiveRef });
    if (!hit.bytes) {
      console.error('Corpus introuvable :', f.corpusFileId);
      for (const p of hit.tried) console.error('  ', p);
      process.exit(2);
    }
    if (f.expectedContentHash && sha256(hit.bytes) !== f.expectedContentHash) {
      console.error('Hash inattendu pour', f.corpusFileId);
      process.exit(3);
    }
    files.push({
      corpusFileId: f.corpusFileId,
      originalFilename: f.originalFilename,
      bytes: hit.bytes
    });
  }

  const result = extractE1FromCorpusFiles({ files, fragments });
  writeFileSync(
    join(root, 'candidates/e1-table-rows.json'),
    JSON.stringify(
      {
        generatedBy: 'tools/extract-e1.mjs',
        extractorVersion: result.extractorVersion,
        runId: result.runId,
        extractedAt: result.extractedAt,
        method: 'deterministic_table_row',
        corpusSnapshot: result.snapshot,
        note: 'Candidats E1. Pas des entités curated. Régénérer n écrase pas curated/.',
        candidates: result.candidates
      },
      null,
      2
    ) + '\n'
  );
  writeFileSync(
    join(root, 'candidates/e1-diagnostics.json'),
    JSON.stringify(
      {
        generatedBy: 'tools/extract-e1.mjs',
        runId: result.runId,
        diagnostics: result.diagnostics
      },
      null,
      2
    ) + '\n'
  );
  console.log(`tableaux : ${result.tables}`);
  console.log(`lignes   : ${result.candidates.length}`);
  console.log(`rejets   : ${result.diagnostics.length}`);
}
