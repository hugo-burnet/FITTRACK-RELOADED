#!/usr/bin/env node
// Génère la feuille d'étiquetage en aveugle à partir d'un run de reclassement.
//
// Pourquoi en aveugle : j'ai lu quelles questions le corpus couvrait APRÈS avoir vu les
// scores du cross-encoder, donc mon accord avec lui ne prouve rien — je peux très bien
// lire la couverture à travers le score. Le seuil de refus ne peut être fixé que sur des
// étiquettes posées sans voir le score.
//
// Deux précautions : le score est absent de la feuille, et l'ordre des questions est
// brouillé de façon déterministe (par hachage de l'identifiant) — présenter par score
// trahirait la réponse.

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const benchmark = resolve(here, '../../benchmark/e5-retrieval');

const source = process.argv[2] ?? join(benchmark, 'rerank-crossencoder.json');
const target = process.argv[3] ?? join(benchmark, 'etiquetage-aveugle.md');

const run = JSON.parse(readFileSync(source, 'utf8'));
const shuffled = run.results
  .slice()
  .sort((left, right) =>
    createHash('sha256').update(left.questionId).digest('hex')
      .localeCompare(createHash('sha256').update(right.questionId).digest('hex')));

const lines = [
  '# Étiquetage en aveugle — l’extrait répond-il ?',
  '',
  'Pour chaque bloc : la question que tu as écrite, puis **le seul extrait** que la',
  'recherche remonte en premier. Remplace le `?` par `O` (ça répond, même partiellement)',
  'ou `N` (ça ne répond pas). Rien d’autre à faire.',
  '',
  'Le score du reclasseur est volontairement absent et l’ordre est brouillé : c’est ce qui',
  'rend la mesure valable. Une fois rempli, ce fichier donne le seuil de refus.',
  '',
  `Source : \`${source.split(/[\\/]/).pop()}\` — modèle \`${run.model}\`.`,
  '',
  '---',
  ''
];

for (const question of shuffled) {
  lines.push(
    `### ${question.questionId} — réponse : \`?\``,
    '',
    `> ${question.question}`,
    '',
    question.retrieved[0].text.replace(/\s+/gu, ' ').trim(),
    '',
    '---',
    ''
  );
}

writeFileSync(target, lines.join('\n'), 'utf8');
console.log(`${shuffled.length} blocs écrits dans ${target}`);
