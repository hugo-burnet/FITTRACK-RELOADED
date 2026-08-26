#!/usr/bin/env node
// Mesure ce que le reclassement cross-encoder apporte, AVANT d'embarquer des
// centaines de mégaoctets dans l'application.
//
// Entrée : le vivier produit par `node scripts/dump-search-pool.mjs` à la
// racine — donc les candidats de la recherche réellement livrée, pas une
// seconde implémentation.
//
// Un bi-encodeur réduit la question et le passage à un vecteur chacun, puis
// compare les vecteurs : il mesure une proximité de sujet. Un cross-encoder les
// lit ENSEMBLE, mot contre mot, et juge « ce passage répond-il à cette
// question ». C'est exactement la différence entre « bon sujet » et « bonne
// réponse », et c'est le défaut observé sur téléphone : le sujet était bon,
// l'ordre non.
//
// Aucun appel payant : le modèle tourne en local et reste en cache.
//
// ATTENTION : DEV a servi à régler les poids lexicaux, c'est donc un jeu
// d'entraînement pour la partie lexicale. Le reclassement, lui, n'a jamais vu
// ces questions — son gain est la seule part non biaisée de cette mesure.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AutoModelForSequenceClassification, AutoTokenizer, env } from '@huggingface/transformers';

const here = dirname(fileURLToPath(import.meta.url));
const contractRoot = resolve(here, '../..');

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const TOP_K = Number(option('topk', 8));
const MODEL = option('model', 'onnx-community/bge-reranker-v2-m3-ONNX');
const DTYPE = option('dtype', 'q8');
const poolPath = join(contractRoot, option('pool-file', 'benchmark/e5-retrieval/search-pool-dev.json'));

const document = JSON.parse(readFileSync(poolPath, 'utf8'));
const entries = document.entries;

env.allowLocalModels = false;
console.log(`Chargement de ${MODEL} (${DTYPE}) — le premier appel télécharge le modèle.`);
const started = Date.now();
const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
const reranker = await AutoModelForSequenceClassification.from_pretrained(MODEL, { dtype: DTYPE });
console.log(`Modèle prêt en ${Math.round((Date.now() - started) / 1000)} s.\n`);

let baseline = 0;
let baselineAt1 = 0;
let reranked = 0;
let rerankedAt1 = 0;
const recovered = [];
const lost = [];
const rankStarted = Date.now();

for (const [index, entry] of entries.entries()) {
  const gold = new Set(entry.gold);
  const before = entry.pool.slice(0, TOP_K).map((item) => item.claimId);
  const hitBefore = before.some((id) => gold.has(id));
  if (hitBefore) baseline += 1;
  if (before.length > 0 && gold.has(before[0])) baselineAt1 += 1;

  // On donne au cross-encoder le contexte affiché, pas la citation seule :
  // c'est ce que le lecteur lira, donc c'est ce qu'il faut juger.
  const inputs = tokenizer(
    Array.from({ length: entry.pool.length }, () => entry.question),
    { text_pair: entry.pool.map((item) => item.displayContext), padding: true, truncation: true },
  );
  const { logits } = await reranker(inputs);
  const scores = logits.tolist().map((row) => row[0]);
  const after = entry.pool
    .map((item, position) => ({ item, score: scores[position] }))
    .sort((left, right) => right.score - left.score)
    .slice(0, TOP_K)
    .map(({ item }) => item.claimId);

  const hitAfter = after.some((id) => gold.has(id));
  if (hitAfter) reranked += 1;
  if (after.length > 0 && gold.has(after[0])) rerankedAt1 += 1;
  if (hitAfter && !hitBefore) recovered.push(entry.question.slice(0, 62));
  if (!hitAfter && hitBefore) lost.push(entry.question.slice(0, 62));
  process.stdout.write(`\r  ${index + 1}/${entries.length}`);
}

const total = entries.length;
const perQuestion = Math.round((Date.now() - rankStarted) / total);
console.log(`\r  ${total}/${total} — ${perQuestion} ms par question\n`);
console.log(`vivier ${document.poolSize} -> top ${TOP_K}, sur ${total} questions répondables\n`);
console.log(`  rappel@${TOP_K}     lexical ${baseline}/${total}     reclassé ${reranked}/${total}`);
console.log(`  précision@1   lexical ${baselineAt1}/${total}     reclassé ${rerankedAt1}/${total}`);
if (recovered.length > 0) {
  console.log(`\n  récupérées (${recovered.length}) :`);
  for (const text of recovered) console.log(`    + ${text}`);
}
if (lost.length > 0) {
  console.log(`\n  perdues (${lost.length}) :`);
  for (const text of lost) console.log(`    - ${text}`);
}
