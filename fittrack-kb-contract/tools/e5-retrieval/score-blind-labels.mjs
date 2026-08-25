#!/usr/bin/env node
// Confronte les étiquettes posées en aveugle au score du reclasseur.
//
// C'est la seule mesure valable de la chaîne : toutes les précédentes comparaient le
// système à un jugement formé après avoir vu ses sorties. Ici l'étiquette a été posée
// score masqué et ordre brouillé, donc l'accord — ou son absence — veut dire quelque chose.
//
// On mesure deux choses distinctes, souvent confondues :
//   - le CLASSEMENT (AUC) : les extraits utiles remontent-ils au-dessus des inutiles ?
//   - le SEUIL : existe-t-il une coupure qui refuse l'inutile sans jeter l'utile ?
// Un bon classement n'implique pas un seuil exploitable ; c'est précisément ce qui se
// joue ici.

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const benchmark = resolve(here, '../../benchmark/e5-retrieval');

const run = JSON.parse(readFileSync(join(benchmark, 'rerank-crossencoder.json'), 'utf8'));
const truth = JSON.parse(readFileSync(join(benchmark, 'etiquettes-aveugle.json'), 'utf8'));

const rows = run.results
  .map((question) => ({
    id: question.questionId,
    score: question.retrieved[0].rerankScore,
    useful: truth.labels[question.questionId] === 'O',
    uncertain: (truth.uncertain ?? []).includes(question.questionId)
  }))
  .sort((left, right) => right.score - left.score);

const useful = rows.filter((row) => row.useful);
const useless = rows.filter((row) => !row.useful);

// AUC = probabilité qu'un extrait utile tiré au hasard soit mieux noté qu'un inutile.
// 0,5 = le score n'apporte rien ; 1,0 = séparation parfaite. Les égalités comptent 1/2.
const pairs = useful.length * useless.length;
let concordant = 0;
for (const good of useful) {
  for (const bad of useless) {
    if (good.score > bad.score) concordant += 1;
    else if (good.score === bad.score) concordant += 0.5;
  }
}
const auc = concordant / pairs;

console.log(`étiquettes : ${useful.length} utiles / ${rows.length} questions ` +
  `(taux de base ${(useful.length / rows.length * 100).toFixed(0)} %)`);
// Intervalle de Hanley-McNeil. Avec 5 positifs seulement il est très large : le publier
// évite de lire une séparation nette là où il y a surtout peu de données.
const q1 = auc / (2 - auc);
const q2 = (2 * auc * auc) / (1 + auc);
const variance = (auc * (1 - auc)
  + (useful.length - 1) * (q1 - auc * auc)
  + (useless.length - 1) * (q2 - auc * auc)) / pairs;
const halfWidth = 1.96 * Math.sqrt(variance);
console.log(`AUC : ${auc.toFixed(3)}  IC 95 % ` +
  `[${Math.max(0, auc - halfWidth).toFixed(3)}, ${Math.min(1, auc + halfWidth).toFixed(3)}]\n`);

console.log('rang  question  score    étiquette');
rows.forEach((row, index) => {
  console.log(
    `${String(index + 1).padStart(4)}  ${row.id.padEnd(8)}  ` +
    `${row.score.toFixed(3).padStart(7)}  ${row.useful ? 'UTILE' : '.'}` +
    `${row.uncertain ? '  (incertaine)' : ''}`
  );
});

// Chaque score observé est un seuil candidat : on garde ce qui est au-dessus.
console.log('\nseuil     gardées  utiles gardées  précision  rappel');
const candidates = [...new Set(rows.map((row) => row.score))].sort((a, b) => b - a);
for (const threshold of candidates) {
  const kept = rows.filter((row) => row.score >= threshold);
  const keptUseful = kept.filter((row) => row.useful).length;
  if (kept.length > 12) break;
  console.log(
    `${threshold.toFixed(3).padStart(7)}  ${String(kept.length).padStart(7)}  ` +
    `${String(keptUseful).padStart(14)}  ` +
    `${(keptUseful / kept.length).toFixed(2).padStart(9)}  ` +
    `${(keptUseful / useful.length).toFixed(2).padStart(6)}`
  );
}
