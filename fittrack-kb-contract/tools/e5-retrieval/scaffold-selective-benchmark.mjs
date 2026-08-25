#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const contractRoot = resolve(here, '../..');

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const normalizeQuestion = (text) =>
  text.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLocaleLowerCase('fr');

function blankAnnotation(questionId) {
  return {
    questionId,
    answerability: null,
    supportingClaimIds: [],
    notes: '',
  };
}

export function buildSelectiveBenchmark(
  lines,
  { seed = 'fittrack-selective-v1', priorQuestions = [] } = {},
) {
  const rawQuestions = lines.map((line) => line.trim()).filter(Boolean);
  const normalized = rawQuestions.map(normalizeQuestion);
  const unique = new Set(normalized);
  if (unique.size !== rawQuestions.length) {
    throw new Error('Le fichier contient des questions dupliquées après normalisation.');
  }
  if (rawQuestions.length < 120) {
    throw new Error(`120 questions nouvelles minimum sont requises (${rawQuestions.length} reçues).`);
  }

  const prior = new Set(priorQuestions.map(normalizeQuestion));
  const reused = rawQuestions.filter((question) => prior.has(normalizeQuestion(question)));
  if (reused.length > 0) {
    throw new Error(`Questions déjà utilisées : ${reused.join(' | ')}`);
  }

  const ranked = rawQuestions
    .map((text) => ({
      text,
      rank: sha256(`${seed}\0${normalizeQuestion(text)}`),
      questionId: `sq.${sha256(normalizeQuestion(text)).slice(0, 12)}`,
    }))
    .sort((left, right) => left.rank.localeCompare(right.rank));

  const devSize = Math.floor(ranked.length / 3);
  const calSize = Math.floor(ranked.length / 3);
  const questions = ranked.map(({ rank: _rank, ...question }, index) => ({
    ...question,
    split: index < devSize ? 'DEV' : index < devSize + calSize ? 'CAL' : 'TEST',
  }));
  const counts = Object.fromEntries(
    ['DEV', 'CAL', 'TEST'].map((split) => [
      split,
      questions.filter((question) => question.split === split).length,
    ]),
  );
  if (Object.values(counts).some((count) => count < 40)) {
    throw new Error('Chaque partition doit contenir au moins 40 questions.');
  }

  const manifest = {
    schemaVersion: '1.0.0-selective-benchmark',
    seed,
    questionSetHash: `sha256:${sha256(questions.map((question) => question.text).join('\n'))}`,
    priorQuestionSetHash: `sha256:${sha256(priorQuestions.join('\n'))}`,
    counts,
    questions,
  };
  const annotationTemplate = {
    schemaVersion: '1.0.0-selective-annotations',
    questionSetHash: manifest.questionSetHash,
    allowedAnswerability: ['ANSWERABLE', 'UNANSWERABLE', 'AMBIGUOUS'],
    annotations: questions.map((question) => blankAnnotation(question.questionId)),
  };

  return { manifest, annotationTemplate };
}

function option(args, name, fallback) {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const inputPath = option(args, 'input');
  const outputDirectory = option(
    args,
    'output-dir',
    join(contractRoot, 'benchmark/e5-retrieval/selective-v1'),
  );
  const seed = option(args, 'seed', 'fittrack-selective-v1');
  if (!inputPath) {
    throw new Error(
      'Usage : node scaffold-selective-benchmark.mjs --input questions.txt [--output-dir dossier] [--seed valeur]',
    );
  }

  const priorDocument = JSON.parse(
    readFileSync(join(contractRoot, 'benchmark/e5-retrieval/questions-30.json'), 'utf8'),
  );
  const lines = readFileSync(resolve(inputPath), 'utf8').split(/\r?\n/u);
  const { manifest, annotationTemplate } = buildSelectiveBenchmark(lines, {
    seed,
    priorQuestions: priorDocument.questions.map((question) => question.text),
  });

  mkdirSync(resolve(outputDirectory), { recursive: true });
  writeFileSync(
    join(resolve(outputDirectory), 'questions.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  for (const annotator of ['a', 'b']) {
    writeFileSync(
      join(resolve(outputDirectory), `labels-annotator-${annotator}.json`),
      `${JSON.stringify({ ...annotationTemplate, annotator }, null, 2)}\n`,
    );
  }
  console.log(`Benchmark sélectif créé dans ${resolve(outputDirectory)}`);
}
