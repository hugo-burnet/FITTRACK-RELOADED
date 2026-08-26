#!/usr/bin/env node
// Projette l'annotation DEV en un index de questions embarquable.
//
// Les feuilles d'annotation vivent dans le banc (`fittrack-kb-contract/`), que
// l'application ne lit jamais : le bundle ne doit dépendre que de `src/`. Ce
// script fait la même chose que `build-knowledge-index.mjs` pour les preuves —
// un artefact généré, reproductible, commité.
//
// Il n'embarque QUE des questions et des identifiants d'affirmations. Aucune
// réponse rédigée n'existe dans l'annotation, et il ne faut pas qu'il s'en crée
// une par ce chemin.
//
// DEV uniquement. CAL et TEST ne sont pas lus.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const selective = resolve(root, 'fittrack-kb-contract/benchmark/e5-retrieval/selective-v1');
const outputPath = resolve(root, 'src/features/knowledge/wiki-questions.json');

const questions = JSON.parse(readFileSync(resolve(selective, 'questions.json'), 'utf8'));
const sheetA = JSON.parse(readFileSync(resolve(selective, 'labels-annotator-a.json'), 'utf8'));
const sheetB = JSON.parse(readFileSync(resolve(selective, 'labels-annotator-b.json'), 'utf8'));

// Adjudication des dix désaccords, telle que consignée dans DEV-ANNOTATION.md.
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

const covered = [];
const uncovered = [];

for (const question of dev) {
  const a = mapA.get(question.questionId);
  const b = mapB.get(question.questionId);
  if (a === undefined || b === undefined) throw new Error(`non annotée : ${question.questionId}`);
  const verdict =
    a.answerability === b.answerability
      ? a.answerability
      : ADJUDICATED[question.questionId];
  if (verdict === undefined) throw new Error(`adjudication manquante : ${question.questionId}`);

  if (verdict === 'ANSWERABLE') {
    const claimIds = [...new Set([...a.supportingClaimIds, ...b.supportingClaimIds])];
    if (claimIds.length === 0) {
      throw new Error(`répondable sans appui : ${question.questionId}`);
    }
    covered.push({ questionId: question.questionId, text: question.text, claimIds });
  } else {
    // La note de la feuille A dit ce qui manque, en une phrase. La réécrire
    // serait la réinventer ; c'est déjà l'analyse la plus précise qu'on ait.
    uncovered.push({
      questionId: question.questionId,
      text: question.text,
      missing: a.notes,
    });
  }
}

const document = {
  schemaVersion: '1.0.0-wiki-questions',
  split: 'DEV',
  questionSetHash: questions.questionSetHash,
  note:
    'Questions écrites avant toute recherche. Aucune réponse rédigée : seulement des ' +
    'identifiants d’affirmations du corpus embarqué.',
  covered,
  uncovered,
};

writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
console.log(
  `Questions du wiki : ${covered.length} documentées, ${uncovered.length} hors corpus -> ${outputPath}`,
);
