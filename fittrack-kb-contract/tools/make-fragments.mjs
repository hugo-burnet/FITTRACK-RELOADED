#!/usr/bin/env node
// Génère corpus/corpus-manifest.json et fragments/fragments.json à partir des
// fichiers RÉELS du corpus.
//
// Pourquoi ce script existe : le prompt de phase 2 exige une provenance réelle
// (offsets, hashes) et interdit d'inventer quoi que ce soit. Écrire les offsets
// à la main garantirait des offsets faux dès la première correction de coquille
// dans le corpus. Ici, tout ce qui est vérifiable est calculé ; seuls le
// découpage (fragment-spec.json) et le typage de bloc sont des décisions
// humaines.
//
// Le fichier original reste l'autorité : ce script ne prétend PAS que la
// concaténation des fragments reconstruit le fichier octet pour octet. Il
// conserve les offsets bruts pour que la relecture soit toujours possible.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const sha256 = (buf) => 'sha256:' + createHash('sha256').update(buf).digest('hex');

const config = JSON.parse(readFileSync(join(root, 'corpus/corpus-files.config.json'), 'utf8'));
const spec = JSON.parse(readFileSync(join(root, 'fragments/fragment-spec.json'), 'utf8'));

// Résolution du premier chemin candidat existant. Le corpus a déjà changé de
// dossier une fois : une liste de candidats évite qu'un déplacement casse la
// régénération, et expectedContentHash empêche de régénérer en silence à
// partir d'une copie qui ne serait pas la bonne.
const missing = [];
for (const f of config.files) {
  f.path = (f.candidatePaths ?? [f.path]).find((p) => p && existsSync(p));
  if (!f.path) missing.push(f);
}
if (missing.length) {
  console.error('Fichiers du corpus introuvables :');
  for (const f of missing) {
    console.error('  - ' + f.corpusFileId);
    for (const p of f.candidatePaths ?? []) console.error('      essayé : ' + p);
  }
  console.error('\nAdapter corpus/corpus-files.config.json. Aucune sortie écrite.');
  process.exit(2);
}

// --- Manifest -------------------------------------------------------------
const loaded = new Map();
const manifestFiles = [];

for (const f of config.files) {
  const bytes = readFileSync(f.path);
  if (f.expectedContentHash && sha256(bytes) !== f.expectedContentHash) {
    console.error(
      `Le fichier ${f.corpusFileId} ne correspond pas au hash attendu.\n` +
        `  chemin  : ${f.path}\n  attendu : ${f.expectedContentHash}\n  obtenu  : ${sha256(bytes)}\n\n` +
        `Si le corpus a été volontairement mis à jour, corriger expectedContentHash et publier une nouvelle KBRelease : ` +
        `les fragments existants deviennent périmés. Aucune sortie écrite.`
    );
    process.exit(3);
  }
  const text = bytes.toString('utf8');
  // Index des offsets octets de chaque début de ligne. Les offsets sont en
  // octets et non en caractères : le corpus est en français, plein de
  // caractères multi-octets, et un offset en caractères ne permettrait pas de
  // relire le fichier avec un outil bas niveau.
  const lines = text.split('\n');
  const lineByteStart = new Array(lines.length);
  let acc = 0;
  for (let i = 0; i < lines.length; i++) {
    lineByteStart[i] = acc;
    acc += Buffer.byteLength(lines[i], 'utf8') + 1; // +1 pour le \n
  }
  loaded.set(f.corpusFileId, { text, lines, lineByteStart, bytes });

  manifestFiles.push({
    corpusFileId: f.corpusFileId,
    shortLabel: f.shortLabel,
    title: f.title,
    originalFilename: f.path.split('/').pop(),
    mediaType: f.mediaType,
    language: f.language,
    corpusDate: f.corpusDate,
    byteLength: bytes.length,
    lineCount: lines.length,
    contentHash: sha256(bytes),
    isAuthority: true,
    reconstructibleFromFragments: false,
    reconstructionNote:
      'Les fragments sont sémantiques et non exhaustifs. Le fichier original est la seule autorité pour le contenu intégral.'
  });
}

const manifest = {
  manifestVersion: '1.0.0',
  generatedBy: 'tools/make-fragments.mjs',
  note:
    'Hashes et tailles calculés sur les fichiers réels. Les fichiers du corpus ne sont pas copiés dans ce paquet ; seule leur empreinte l est.',
  files: manifestFiles
};

writeFileSync(join(root, 'corpus/corpus-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');

// --- Fragments ------------------------------------------------------------
function headingPathFor(lines, startLine, mediaType) {
  if (mediaType !== 'text/markdown') return [];
  const path = [];
  for (let i = 0; i < startLine - 1; i++) {
    const m = /^(#{1,6})\s+(.*)$/.exec(lines[i]);
    if (!m) continue;
    const level = m[1].length;
    path.length = Math.min(path.length, level - 1);
    path[level - 1] = m[2].trim();
  }
  return path.filter((x) => typeof x === 'string');
}

const fragments = [];
const seen = new Set();

for (const fs of spec.fragments) {
  const file = config.files.find((f) => f.corpusFileId === fs.corpusFileId);
  if (!file) throw new Error('corpusFileId inconnu : ' + fs.corpusFileId);
  const doc = loaded.get(fs.corpusFileId);

  if (seen.has(fs.fragmentId)) throw new Error('fragmentId dupliqué : ' + fs.fragmentId);
  seen.add(fs.fragmentId);

  if (fs.startLine < 1 || fs.endLine > doc.lines.length || fs.startLine > fs.endLine) {
    throw new Error(
      `Plage de lignes invalide pour ${fs.fragmentId} : ${fs.startLine}-${fs.endLine} (fichier : ${doc.lines.length} lignes)`
    );
  }

  const rawText = doc.lines.slice(fs.startLine - 1, fs.endLine).join('\n');
  const startByte = doc.lineByteStart[fs.startLine - 1];
  const endByte = startByte + Buffer.byteLength(rawText, 'utf8');

  // Vérification : relire le fichier aux offsets doit redonner exactement le
  // texte du fragment. Sans ce contrôle, une erreur d'indexation passerait
  // inaperçue et toute la provenance serait fausse en silence.
  const reread = doc.bytes.subarray(startByte, endByte).toString('utf8');
  if (reread !== rawText) {
    throw new Error('Incohérence offsets/texte pour ' + fs.fragmentId);
  }

  fragments.push({
    fragmentId: fs.fragmentId,
    corpusFileId: fs.corpusFileId,
    headingPath: headingPathFor(doc.lines, fs.startLine, file.mediaType),
    startLine: fs.startLine,
    endLine: fs.endLine,
    startByte,
    endByte,
    blockType: fs.blockType,
    rawText,
    textHash: sha256(Buffer.from(rawText, 'utf8')),
    corpusFileContentHash: manifestFiles.find((m) => m.corpusFileId === fs.corpusFileId).contentHash
  });
}

writeFileSync(
  join(root, 'fragments/fragments.json'),
  JSON.stringify(
    {
      generatedBy: 'tools/make-fragments.mjs',
      note: 'Offsets octets vérifiés par relecture. Ne pas éditer à la main.',
      fragments
    },
    null,
    2
  ) + '\n'
);

console.log(`corpus-manifest.json : ${manifestFiles.length} fichiers`);
console.log(`fragments.json       : ${fragments.length} fragments, offsets vérifiés`);
