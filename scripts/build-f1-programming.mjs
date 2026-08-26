#!/usr/bin/env node
// Projette les lignes de tableau de F1 — « Programmation hypertrophie » — en un
// artefact embarquable par le wiki.
//
// POURQUOI CE CHEMIN. Le document F1 est à 79 % tabulaire, et l'extracteur de
// prose E5 écarte volontairement les tableaux. Mais l'étage E1 les avait déjà
// extraits, de façon *déterministe* — aucun modèle, donc aucune invention
// possible — et le résultat dormait dans `candidates/e1-table-rows.json` parce
// que rien ne le consommait.
//
// Ces lignes ne passent pas par `evidence-index.json` : cet index est construit
// depuis `e5-corpus.json` et ses empreintes sont vérifiées par les tests du
// contrat. F1 arrive donc à côté, additif, sans toucher au gel.
//
// Chaque ligne est une fiche : affirmation, confiance, population, sources,
// type de preuve, contradictions, limites, interprétation pratique, et ce qu'on
// ne peut PAS conclure. On la rend telle quelle, sans reformuler.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = resolve(root, 'fittrack-kb-contract/candidates/e1-table-rows.json');
const outputPath = resolve(root, 'src/features/knowledge/f1-programming.json');
const F1 = 'corpus.f1.programmation-hypertrophie';

const source = JSON.parse(readFileSync(sourcePath, 'utf8'));
const candidates = source.candidates.filter((item) => item.corpusFileRef === F1);
if (candidates.length === 0) throw new Error('aucune ligne F1 dans e1-table-rows.json');

// La forme bibliographique n'est pas du contenu : ce sont les métadonnées des
// publications citées ailleurs. Elle est marquée pour que l'interface la range
// à part au lieu de la mêler aux fiches.
const BIBLIOGRAPHY_HEADER = 'Publication';

const sections = new Map();
for (const candidate of candidates) {
  const { headingPath = [], tableHeaderCells = [], cells = [], startLine } = candidate.payload;
  const title = headingPath.find((heading) => /^\d+\./u.test(heading)) ?? headingPath.at(-1) ?? '(racine)';
  if (!sections.has(title)) {
    sections.set(title, { title, headingPath: headingPath.slice(1), rows: [] });
  }
  sections.get(title).rows.push({
    rowId: candidate.candidateId,
    // Le premier en-tête porte l'affirmation dans la forme dominante ; il sert
    // de titre de fiche. Les autres colonnes restent nommées, pas fusionnées.
    fields: cells.map((cell) => ({
      label: cell.header,
      value: cell.raw,
      links: cell.links ?? [],
    })),
    shape: tableHeaderCells[0] ?? '(sans en-tête)',
    isBibliography: tableHeaderCells[0] === BIBLIOGRAPHY_HEADER,
    startByte: candidate.verbatimSpan?.startByte ?? 0,
    endByte: candidate.verbatimSpan?.endByte ?? 0,
    startLine: startLine ?? 0,
    reviewState: candidate.reviewState,
  });
}

for (const section of sections.values()) {
  section.rows.sort((left, right) => left.startByte - right.startByte);
}
const ordered = [...sections.values()].sort(
  (left, right) => (left.rows[0]?.startByte ?? 0) - (right.rows[0]?.startByte ?? 0),
);

const reviewStates = [...new Set(candidates.map((item) => item.reviewState))];
const document = {
  schemaVersion: '1.0.0-f1-programming',
  corpusFileId: F1,
  title: 'Programmation de l’entraînement en résistance pour l’hypertrophie musculaire',
  extraction: {
    method: 'deterministic_table_row',
    stage: 'E1',
    note: 'Extraction déterministe, sans modèle génératif. Aucune reformulation.',
  },
  reviewStates,
  contentHash: `sha256:${createHash('sha256').update(readFileSync(sourcePath)).digest('hex')}`,
  rowCount: candidates.length,
  sections: ordered,
};

writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
const bib = candidates.filter((item) => item.payload.tableHeaderCells?.[0] === BIBLIOGRAPHY_HEADER).length;
console.log(
  `F1 programmation : ${candidates.length} lignes (${candidates.length - bib} fiches, ${bib} références) ` +
    `sur ${ordered.length} sections -> ${outputPath}`,
);
