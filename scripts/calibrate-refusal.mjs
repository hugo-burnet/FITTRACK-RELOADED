#!/usr/bin/env node
// Cherche le seuil de refus : à partir de quel signal la recherche doit-elle
// dire « le corpus ne traite pas ça » plutôt que servir huit passages ?
//
// C'est le défaut mesuré et jamais corrigé : le moteur renvoie des candidats
// pour 28 questions sur 28 auxquelles le corpus ne peut pas répondre. Taux de
// faux positifs de 100 % sur l'answerability.
//
// DEUX ÉTAPES, et la seconde est irréversible.
//
//   --split DEV  (défaut) : cherche quel signal sépare le mieux les 31
//     questions répondables des 28 qui ne le sont pas, en s'appuyant sur
//     l'annotation existante. Ne touche pas à CAL.
//
//   --split CAL : applique le seuil retenu aux 59 questions de CAL et rend leur
//     distribution. LIRE CAL EST IRRÉVERSIBLE — la partition cesse d'être
//     aveugle, et le protocole ne l'autorise qu'une fois.
//
// Aucun appel payant, aucun modèle : on lit des scores déjà calculés.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const selective = resolve(root, 'fittrack-kb-contract/benchmark/e5-retrieval/selective-v1');
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const split = String(option('split', 'DEV')).toUpperCase();
if (!['DEV', 'CAL'].includes(split)) throw new Error(`partition invalide : ${split}`);

const readSel = (name) => JSON.parse(readFileSync(resolve(selective, name), 'utf8'));
const questions = readSel('questions.json');

// Les signaux candidats. Chacun est une quantité que la recherche connaît déjà
// au moment de décider, sans modèle et sans annotation.
const SIGNALS = {
  scoreTop1: (candidates) => candidates[0]?.score ?? 0,
  termesTop1: (candidates) => candidates[0]?.matchedTerms.length ?? 0,
  // La marge entre le premier et le troisième : quand le corpus traite le sujet,
  // le premier détache ; quand il ne le traite pas, tout se vaut et bas.
  margeTop1Top3: (candidates) => (candidates[0]?.score ?? 0) - (candidates[2]?.score ?? 0),
  couvertureTermes: (candidates, terms) =>
    terms === 0 ? 0 : (candidates[0]?.matchedTerms.length ?? 0) / terms,
};

const vite = await createServer({
  root,
  appType: 'custom',
  logLevel: 'error',
  server: { middlewareMode: true },
});

try {
  const { searchEvidence, tokenizeEvidenceText } = await vite.ssrLoadModule(
    '/src/features/knowledge/searchEvidence.ts',
  );
  const rows = [];
  for (const question of questions.questions.filter((item) => item.split === split)) {
    const outcome = searchEvidence(question.text, 8);
    const candidates = outcome.kind === 'EVIDENCE_CANDIDATES' ? outcome.candidates : [];
    const termCount = new Set(tokenizeEvidenceText(question.text)).size;
    rows.push({
      questionId: question.questionId,
      text: question.text,
      signals: Object.fromEntries(
        Object.entries(SIGNALS).map(([name, compute]) => [name, compute(candidates, termCount)]),
      ),
    });
  }

  if (split === 'CAL') {
    const outputPath = resolve(selective, 'refusal-signals-cal.json');
    writeFileSync(outputPath, `${JSON.stringify({ split, rows }, null, 2)}\n`, 'utf8');
    console.log(`CAL : ${rows.length} questions -> ${outputPath}`);
    console.log('Distribution des signaux (min / médiane / max) :');
    for (const name of Object.keys(SIGNALS)) {
      const values = rows.map((row) => row.signals[name]).sort((a, b) => a - b);
      const median = values[Math.floor(values.length / 2)];
      console.log(
        `  ${name.padEnd(18)} ${values[0].toFixed(3)} / ${median.toFixed(3)} / ${values.at(-1).toFixed(3)}`,
      );
    }
    process.exit(0);
  }

  // DEV : on a les étiquettes, donc on peut chercher le meilleur seuil.
  const sheetA = readSel('labels-annotator-a.json');
  const sheetB = readSel('labels-annotator-b.json');
  const mapA = new Map(sheetA.annotations.map((a) => [a.questionId, a]));
  const mapB = new Map(sheetB.annotations.map((a) => [a.questionId, a]));
  const ADJUDICATED = {
    'sq.bc573600a4eb': 'ANSWERABLE', 'sq.da2d3a4a2edf': 'UNANSWERABLE',
    'sq.e9e8b611d6c4': 'ANSWERABLE', 'sq.8b549ac9726e': 'UNANSWERABLE',
    'sq.ca73c16e08c0': 'UNANSWERABLE', 'sq.55534e960c83': 'ANSWERABLE',
    'sq.50df7f71a1ad': 'ANSWERABLE', 'sq.4134ba3f89e5': 'ANSWERABLE',
    'sq.f61dd8e55c7c': 'ANSWERABLE', 'sq.6ea465b0f170': 'UNANSWERABLE',
  };
  for (const row of rows) {
    const a = mapA.get(row.questionId);
    const b = mapB.get(row.questionId);
    row.answerable =
      (a.answerability === b.answerability ? a.answerability : ADJUDICATED[row.questionId]) ===
      'ANSWERABLE';
  }

  const positives = rows.filter((row) => row.answerable).length;
  const negatives = rows.length - positives;
  console.log(`DEV : ${positives} répondables, ${negatives} non répondables\n`);
  console.log('signal              seuil   gardées/répondables   refusées/non-répondables   score');

  for (const name of Object.keys(SIGNALS)) {
    const values = [...new Set(rows.map((row) => row.signals[name]))].sort((a, b) => a - b);
    let best = null;
    for (const threshold of values) {
      const kept = rows.filter((row) => row.signals[name] >= threshold);
      const trueKeep = kept.filter((row) => row.answerable).length;
      const refusedBad = rows.filter(
        (row) => row.signals[name] < threshold && !row.answerable,
      ).length;
      // On veut garder les répondables ET refuser les autres. La moyenne
      // harmonique punit un seuil qui excelle d'un côté en sacrifiant l'autre —
      // refuser tout donnerait un score parfait sur la moitié du problème.
      const sensibilite = positives === 0 ? 0 : trueKeep / positives;
      const specificite = negatives === 0 ? 0 : refusedBad / negatives;
      const score =
        sensibilite + specificite === 0
          ? 0
          : (2 * sensibilite * specificite) / (sensibilite + specificite);
      if (best === null || score > best.score) {
        best = { threshold, trueKeep, refusedBad, score };
      }
    }
    console.log(
      `${name.padEnd(18)} ${best.threshold.toFixed(3).padStart(7)}   ` +
        `${String(best.trueKeep).padStart(2)}/${positives}                 ` +
        `${String(best.refusedBad).padStart(2)}/${negatives}                      ` +
        `${best.score.toFixed(3)}`,
    );
  }
} finally {
  await vite.close();
}
