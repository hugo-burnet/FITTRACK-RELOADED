#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildIndex, search } from '../fittrack-kb-contract/tools/e5-llm/retrieval.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const split = option('split', 'DEV').toUpperCase();
if (!['DEV', 'CAL', 'TEST'].includes(split)) throw new Error(`Partition invalide : ${split}`);

const OLLAMA_URL = option('ollama-url', 'http://127.0.0.1:11434');
const MODEL = option('model', 'bge-m3:latest');
const TOP_K = 4;
const LEXICAL_LIMIT = 60;
const RRF_K = 60;
const questionsPath = resolve(
  root,
  'fittrack-kb-contract/benchmark/e5-retrieval/selective-v1/questions.json',
);
const evidencePath = resolve(root, 'src/features/knowledge/evidence-index.json');
const outputPath = resolve(
  option(
    'output',
    resolve(
      root,
      `fittrack-kb-contract/benchmark/e5-retrieval/selective-v1/hybrid-bge-m3-${split.toLowerCase()}.json`,
    ),
  ),
);
const questionsSource = readFileSync(questionsPath, 'utf8');
const evidenceSource = readFileSync(evidencePath, 'utf8');
const questionsDocument = JSON.parse(questionsSource);
const evidenceDocument = JSON.parse(evidenceSource);
const questions = questionsDocument.questions.filter((question) => question.split === split);
const sha256 = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;

function dot(left, right) {
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) sum += left[index] * right[index];
  return sum;
}

function normalize(vector) {
  const length = Math.sqrt(dot(vector, vector)) || 1;
  return vector.map((value) => value / length);
}

async function embed(input) {
  const response = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, input }),
  });
  if (!response.ok) throw new Error(`ollama_embed_failed:${response.status}:${await response.text()}`);
  return (await response.json()).embeddings.map(normalize);
}

async function modelMetadata() {
  const response = await fetch(`${OLLAMA_URL}/api/tags`);
  if (!response.ok) return { id: MODEL, digest: null };
  const models = (await response.json()).models ?? [];
  const found = models.find((model) => model.name === MODEL || model.model === MODEL);
  return {
    id: MODEL,
    digest: found?.digest ?? null,
    modifiedAt: found?.modified_at ?? null,
    details: found?.details ?? null,
  };
}

function reciprocalRankFusion(denseRanking, lexicalRanking) {
  const scores = new Map();
  for (const ranking of [denseRanking, lexicalRanking]) {
    ranking.forEach((claimIndex, rank) => {
      scores.set(claimIndex, (scores.get(claimIndex) ?? 0) + 1 / (RRF_K + rank + 1));
    });
  }
  return [...scores.entries()].sort(
    (left, right) => right[1] - left[1] || left[0] - right[0],
  );
}

const startedAt = Date.now();
const claims = evidenceDocument.claims;
const lexicalIndex = buildIndex(
  claims.map((claim, index) => ({ id: index, text: claim.retrievalText, payload: index })),
);
const claimVectors = [];
for (let index = 0; index < claims.length; index += 32) {
  claimVectors.push(...(await embed(claims.slice(index, index + 32).map((claim) => claim.retrievalText))));
  process.stdout.write(`\rIndex dense : ${Math.min(index + 32, claims.length)}/${claims.length}`);
}
process.stdout.write('\n');
const questionVectors = [];
for (let index = 0; index < questions.length; index += 32) {
  questionVectors.push(...(await embed(questions.slice(index, index + 32).map((question) => question.text))));
  process.stdout.write(`\rQuestions : ${Math.min(index + 32, questions.length)}/${questions.length}`);
}
process.stdout.write('\n');

const results = questions.map((question, questionIndex) => {
  const denseScores = claimVectors
    .map((vector, claimIndex) => ({ claimIndex, score: dot(questionVectors[questionIndex], vector) }))
    .sort((left, right) => right.score - left.score || left.claimIndex - right.claimIndex);
  const denseRanking = denseScores.map((item) => item.claimIndex);
  const lexicalHits = search(lexicalIndex, question.text, { limit: LEXICAL_LIMIT });
  const lexicalRanking = lexicalHits.map((hit) => hit.payload);
  const denseRankByClaim = new Map(denseRanking.map((claimIndex, rank) => [claimIndex, rank + 1]));
  const lexicalRankByClaim = new Map(
    lexicalRanking.map((claimIndex, rank) => [claimIndex, rank + 1]),
  );
  const denseScoreByClaim = new Map(
    denseScores.map((item) => [item.claimIndex, Number(item.score.toFixed(6))]),
  );
  const lexicalScoreByClaim = new Map(
    lexicalHits.map((item) => [item.payload, Number(item.score.toFixed(6))]),
  );
  const retrieved = reciprocalRankFusion(denseRanking, lexicalRanking)
    .slice(0, TOP_K)
    .map(([claimIndex, rrfScore]) => {
      const claim = claims[claimIndex];
      return {
        claimId: claim.claimId,
        fragmentId: claim.fragmentId,
        rrfScore: Number(rrfScore.toFixed(8)),
        denseRank: denseRankByClaim.get(claimIndex),
        denseScore: denseScoreByClaim.get(claimIndex),
        lexicalRank: lexicalRankByClaim.get(claimIndex) ?? null,
        lexicalScore: lexicalScoreByClaim.get(claimIndex) ?? null,
        rawQuote: claim.rawQuote,
        displayContext: claim.displayContext,
        epistemicStatus: claim.epistemicStatus,
        supportStartByte: claim.supportStartByte,
        supportEndByte: claim.supportEndByte,
      };
    });
  return {
    questionId: question.questionId,
    question: question.text,
    split,
    retrieved,
  };
});

const document = {
  schemaVersion: '1.0.0-selective-hybrid-run',
  createdAt: new Date().toISOString(),
  durationMs: Date.now() - startedAt,
  pipelineCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim(),
  runtime: { node: process.version, ollamaUrl: OLLAMA_URL },
  data: {
    questionSetHash: questionsDocument.questionSetHash,
    questionsFileHash: sha256(questionsSource),
    evidenceIndexHash: sha256(evidenceSource),
    corpusHash: evidenceDocument.corpusHash,
  },
  model: await modelMetadata(),
  retrieval: {
    methods: ['dense-cosine', 'BM25'],
    fusion: 'reciprocal-rank-fusion',
    rrfK: RRF_K,
    lexicalLimit: LEXICAL_LIMIT,
    topK: TOP_K,
    indexedClaims: claims.length,
    scoreSemantics: 'ranking-only; retrieval is not answerability or corpus coverage',
  },
  summary: { questions: results.length, retrievedPerQuestion: TOP_K },
  results,
};
writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
console.log(`${split} hybride terminé en ${Math.round(document.durationMs / 1000)} s -> ${outputPath}`);
