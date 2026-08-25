#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const split = option('split', 'DEV').toUpperCase();
if (!['DEV', 'CAL', 'TEST'].includes(split)) {
  throw new Error(`Partition invalide : ${split}`);
}

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
      `fittrack-kb-contract/benchmark/e5-retrieval/selective-v1/lexical-baseline-${split.toLowerCase()}.json`,
    ),
  ),
);
const questionsSource = readFileSync(questionsPath, 'utf8');
const evidenceSource = readFileSync(evidencePath, 'utf8');
const questionsDocument = JSON.parse(questionsSource);
const evidenceDocument = JSON.parse(evidenceSource);
const questions = questionsDocument.questions.filter((question) => question.split === split);
const sha256 = (value) => `sha256:${createHash('sha256').update(value).digest('hex')}`;

// Vite's SSR loader executes the exact TypeScript module used by the app. This
// avoids maintaining a second, subtly different BM25 implementation for tests.
const vite = await createServer({
  root,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
});

try {
  const { searchEvidence } = await vite.ssrLoadModule(
    '/src/features/knowledge/searchEvidence.ts',
  );
  const results = questions.map((question) => {
    const outcome = searchEvidence(question.text);
    return {
      questionId: question.questionId,
      question: question.text,
      split,
      decision: outcome.kind,
      retrieved:
        outcome.kind === 'EVIDENCE_CANDIDATES'
          ? outcome.candidates.map((candidate) => ({
              claimId: candidate.claimId,
              fragmentId: candidate.fragmentId,
              score: Number(candidate.score.toFixed(6)),
              matchedTerms: candidate.matchedTerms,
              rawQuote: candidate.rawQuote,
              displayContext: candidate.displayContext,
              epistemicStatus: candidate.epistemicStatus,
              supportStartByte: candidate.supportStartByte,
              supportEndByte: candidate.supportEndByte,
            }))
          : [],
    };
  });
  const candidateCount = results.filter(
    (result) => result.decision === 'EVIDENCE_CANDIDATES',
  ).length;
  const document = {
    schemaVersion: '1.0.0-selective-lexical-run',
    createdAt: new Date().toISOString(),
    pipelineCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim(),
    split,
    data: {
      questionSetHash: questionsDocument.questionSetHash,
      questionsFileHash: sha256(questionsSource),
      evidenceIndexHash: sha256(evidenceSource),
      corpusHash: evidenceDocument.corpusHash,
    },
    retrieval: {
      implementation: 'src/features/knowledge/searchEvidence.ts',
      method: 'BM25 lexical baseline',
      calibrationStatus: evidenceDocument.calibration.status,
      topK: 4,
      scoreSemantics: 'ranking-only; candidate presence is not corpus coverage',
    },
    summary: {
      questions: results.length,
      withLexicalCandidates: candidateCount,
      withoutLexicalCandidates: results.length - candidateCount,
    },
    results,
  };
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  console.log(
    `${split} : ${candidateCount}/${results.length} questions avec candidats lexicaux -> ${outputPath}`,
  );
} finally {
  await vite.close();
}
