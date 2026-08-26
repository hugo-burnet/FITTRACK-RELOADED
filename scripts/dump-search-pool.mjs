#!/usr/bin/env node
// Vide le vivier de la recherche embarquée dans un fichier, pour qu'un autre
// paquet puisse le reclasser sans avoir à charger Vite.
//
// `vite` vit à la racine, `@huggingface/transformers` dans le contrat. Plutôt
// que d'installer l'un chez l'autre — et de faire entrer onnxruntime dans les
// dépendances de l'application — chaque étape tourne là où sont ses outils.
//
// Le module chargé est celui qui est réellement embarqué : on mesure le
// pipeline livré, pas une seconde implémentation.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const pool = Number(option('pool', 16));
const outputPath = resolve(root, option('output', 'fittrack-kb-contract/benchmark/e5-retrieval/search-pool-dev.json'));
const selective = resolve(root, 'fittrack-kb-contract/benchmark/e5-retrieval/selective-v1');

const readSel = (name) => JSON.parse(readFileSync(resolve(selective, name), 'utf8'));
const questions = readSel('questions.json');
const sheetA = readSel('labels-annotator-a.json');
const sheetB = readSel('labels-annotator-b.json');
const mapA = new Map(sheetA.annotations.map((a) => [a.questionId, a]));
const mapB = new Map(sheetB.annotations.map((a) => [a.questionId, a]));

// L'adjudication des dix désaccords, telle que consignée dans DEV-ANNOTATION.md.
const ADJUDICATED = {
  'sq.bc573600a4eb': 'ANSWERABLE', 'sq.da2d3a4a2edf': 'UNANSWERABLE',
  'sq.e9e8b611d6c4': 'ANSWERABLE', 'sq.8b549ac9726e': 'UNANSWERABLE',
  'sq.ca73c16e08c0': 'UNANSWERABLE', 'sq.55534e960c83': 'ANSWERABLE',
  'sq.50df7f71a1ad': 'ANSWERABLE', 'sq.4134ba3f89e5': 'ANSWERABLE',
  'sq.f61dd8e55c7c': 'ANSWERABLE', 'sq.6ea465b0f170': 'UNANSWERABLE',
};

const vite = await createServer({
  root,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
});

try {
  const { searchEvidence } = await vite.ssrLoadModule('/src/features/knowledge/searchEvidence.ts');
  const entries = [];
  for (const question of questions.questions.filter((item) => item.split === 'DEV')) {
    const a = mapA.get(question.questionId);
    const b = mapB.get(question.questionId);
    const verdict =
      a.answerability === b.answerability ? a.answerability : ADJUDICATED[question.questionId];
    if (verdict !== 'ANSWERABLE') continue;
    const outcome = searchEvidence(question.text, pool);
    entries.push({
      questionId: question.questionId,
      question: question.text,
      gold: [...new Set([...a.supportingClaimIds, ...b.supportingClaimIds])],
      pool: outcome.candidates.map((candidate) => ({
        claimId: candidate.claimId,
        kind: candidate.kind,
        sourceTitle: candidate.sourceTitle,
        displayContext: candidate.displayContext,
      })),
    });
  }
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(
    outputPath,
    `${JSON.stringify({ poolSize: pool, questionCount: entries.length, entries }, null, 2)}\n`,
    'utf8',
  );
  const average = entries.reduce((sum, entry) => sum + entry.pool.length, 0) / entries.length;
  console.log(
    `Vivier écrit : ${entries.length} questions répondables, ${average.toFixed(1)} candidats en moyenne -> ${outputPath}`,
  );
} finally {
  await vite.close();
}
