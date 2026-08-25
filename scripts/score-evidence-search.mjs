#!/usr/bin/env node
// Banc de score de la barre de recherche du wiki.
//
// Il charge le module reellement embarque (searchEvidence.ts) par le loader SSR
// de Vite, comme la baseline lexicale, pour ne pas maintenir une seconde
// implementation BM25 qui divergerait en silence.
//
// La verite terrain vient de l'annotation exhaustive DEV : union des
// supportingClaimIds des feuilles A et B, sur les questions adjugees ANSWERABLE.
//
// ATTENTION : mesurer une modification de la recherche sur DEV fait de DEV un jeu
// d'entrainement. Le chiffre produit ici sert a decider entre deux variantes, il
// n'est pas une estimation non biaisee. CAL et TEST restent fermes pour ca.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const limit = Number(option('limit', 4));
const label = option('label', 'courant');
const selective = resolve(root, 'fittrack-kb-contract/benchmark/e5-retrieval/selective-v1');

const questions = JSON.parse(readFileSync(resolve(selective, 'questions.json'), 'utf8'));
const sheetA = JSON.parse(readFileSync(resolve(selective, 'labels-annotator-a.json'), 'utf8'));
const sheetB = JSON.parse(readFileSync(resolve(selective, 'labels-annotator-b.json'), 'utf8'));

// Adjudication des dix desaccords, telle que consignee dans DEV-ANNOTATION.md.
const ADJUDICATED = {
  'sq.bc573600a4eb': 'ANSWERABLE',
  'sq.da2d3a4a2edf': 'UNANSWERABLE',
  'sq.e9e8b611d6c4': 'ANSWERABLE',
  'sq.8b549ac9726e': 'UNANSWERABLE',
  'sq.ca73c16e08c0': 'UNANSWERABLE',
  'sq.55534e960c83': 'ANSWERABLE',
  'sq.50df7f71a1ad': 'ANSWERABLE',
  'sq.4134ba3f89e5': 'ANSWERABLE',
  'sq.f61dd8e55c7c': 'ANSWERABLE',
  'sq.6ea465b0f170': 'UNANSWERABLE',
};

const byId = (sheet) => new Map(sheet.annotations.map((a) => [a.questionId, a]));
const mapA = byId(sheetA);
const mapB = byId(sheetB);
const dev = questions.questions.filter((question) => question.split === 'DEV');

const gold = new Map();
const verdicts = new Map();
for (const question of dev) {
  const a = mapA.get(question.questionId);
  const b = mapB.get(question.questionId);
  verdicts.set(
    question.questionId,
    a.answerability === b.answerability ? a.answerability : ADJUDICATED[question.questionId],
  );
  gold.set(question.questionId, new Set([...a.supportingClaimIds, ...b.supportingClaimIds]));
}
const answerable = dev.filter((question) => verdicts.get(question.questionId) === 'ANSWERABLE');
const unanswerable = dev.filter((question) => verdicts.get(question.questionId) === 'UNANSWERABLE');

const vite = await createServer({
  root,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
});

try {
  const { searchEvidence } = await vite.ssrLoadModule('/src/features/knowledge/searchEvidence.ts');
  let recall = 0;
  let precision1 = 0;
  const missed = [];
  for (const question of answerable) {
    const outcome = searchEvidence(question.text, limit);
    const ids = outcome.candidates.map((candidate) => candidate.claimId);
    const expected = gold.get(question.questionId);
    if (ids.length && expected.has(ids[0])) precision1 += 1;
    if (ids.some((id) => expected.has(id))) recall += 1;
    else missed.push(question.text.slice(0, 62));
  }
  const withCandidates = unanswerable.filter(
    (question) => searchEvidence(question.text, limit).candidates.length > 0,
  ).length;

  console.log(`\n=== ${label} (limit = ${limit}) ===`);
  console.log(`rappel@${limit} sur les repondables : ${recall}/${answerable.length}` +
    `  (${((recall / answerable.length) * 100).toFixed(1)} %)`);
  console.log(`precision@1                     : ${precision1}/${answerable.length}`);
  console.log(`non repondables avec candidats   : ${withCandidates}/${unanswerable.length}`);
  if (missed.length) {
    console.log('questions encore ratees :');
    for (const text of missed) console.log(`  - ${text}`);
  }
} finally {
  await vite.close();
}
