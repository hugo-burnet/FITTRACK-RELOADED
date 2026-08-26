#!/usr/bin/env node
// Découpe F1 — « Programmation hypertrophie » — en fragments de prose.
//
// POURQUOI UN SCRIPT À PART plutôt que d'ajouter F1 à E5_FILES dans
// extract-e5-p0.mjs : ce dernier ne fait pas que fragmenter, il sélectionne
// aussi le golden set, et cette sélection exige des ancres de Design Review
// (DESIGN_REVIEW_ANCHORS) que F1 n'a pas — elle lèverait une exception. Surtout,
// écrire dans `candidates/e5-prose-fragments.json` changerait son empreinte, et
// avec elle les manifestes gelés DEV_20 / DEV_100 / HOLDOUT_30, le golden set et
// une partie des 341 tests du contrat.
//
// F1 est donc purement additif : son propre fichier, aucun artefact gelé touché.
// Le jour où F1 mérite un golden set annoté à la main, ce sera une décision
// séparée et consciente, pas un effet de bord de la fragmentation.
//
// Aucun modèle n'intervient ici : le découpage est déterministe.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fragmentProseDocument, sha256 } from './fragment-e5-prose.mjs';
import { resolveCorpusFile } from './resolve-corpus.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const repoRoot = join(root, '..');
const F1 = 'corpus.f1.programmation-hypertrophie';
const outputPath = join(root, 'candidates/e5-prose-fragments-f1.json');

const config = JSON.parse(readFileSync(join(root, 'corpus/corpus-files.config.json'), 'utf8'));
const configured = config.files.find((file) => file.corpusFileId === F1);
if (!configured) throw new Error(`absent de corpus-files.config.json : ${F1}`);

const hit = resolveCorpusFile(configured, { packageRoot: root, repoRoot, archiveRef: config.archiveRef });
if (!hit.bytes) throw new Error(`Corpus introuvable : ${F1}`);

const contentHash = sha256(hit.bytes);
// Le hash attendu est gelé dans la config : il garantit qu'on ne fragmente pas
// une copie divergente du document, ce qui produirait des offsets d'octets
// justes en apparence et faux en réalité.
if (contentHash !== configured.expectedContentHash) {
  throw new Error(
    `Hash inattendu pour ${F1}\n  attendu : ${configured.expectedContentHash}\n  obtenu  : ${contentHash}`,
  );
}

const corpusFile = {
  corpusFileId: configured.corpusFileId,
  shortLabel: configured.shortLabel,
  title: configured.title,
  originalFilename: configured.originalFilename,
  contentHash,
  byteLength: hit.bytes.length,
  bytes: hit.bytes,
};

// Aucun fragment hérité pour F1 : il n'a jamais été découpé.
const result = fragmentProseDocument({ corpusFile, bytes: hit.bytes, legacyFragments: [] });
const fragments = result.fragments ?? result;
const diagnostics = result.diagnostics ?? [];

const errors = diagnostics.filter((item) => item.severity === 'error');
const document = {
  schemaVersion: '1.0.0-e5-prose-fragments-f1',
  corpusFileId: F1,
  title: configured.title,
  contentHash,
  byteLength: hit.bytes.length,
  fragmentCount: fragments.length,
  diagnosticCount: diagnostics.length,
  errorCount: errors.length,
  fragments,
  diagnostics,
};

writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

const chars = fragments.reduce((sum, f) => sum + (f.rawText ?? f.text ?? '').length, 0);
console.log(
  `F1 fragmenté : ${fragments.length} fragments, ${(chars / 1024).toFixed(1)} Ko de prose, ` +
    `${diagnostics.length} diagnostics dont ${errors.length} erreurs -> ${outputPath}`,
);
if (errors.length > 0) {
  console.log('Erreurs de fragmentation (les cinq premières) :');
  for (const error of errors.slice(0, 5)) {
    console.log(`  ${error.code} ligne ${error.startLine ?? '?'} — ${error.message}`);
  }
}
