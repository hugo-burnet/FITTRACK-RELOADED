#!/usr/bin/env node
// Produit les artefacts dérivables, pour qu'ils ne soient jamais saisis à la
// main et donc jamais en désaccord avec la réalité :
//
//   1. fixtures/valid/00-corpus-and-fragments.json — les CorpusFile et
//      CorpusFragment réels, afin que leurs schemas soient exercés sur des
//      données authentiques et pas sur un exemple inventé ;
//   2. contentHash sur chaque enregistrement du golden set ;
//   3. governance/id-registry.json — bootstrap du registre d'identifiants.
//
// Le registre est généré ICI et une seule fois. Passée cette amorce, il devient
// append-only : c'est lui qui garantit qu'un identifiant attribué ne sera pas
// réutilisé, et le régénérer à chaque exécution annulerait cette garantie.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { contentHashOf } from './canonical.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = (p) => JSON.parse(readFileSync(join(root, p), 'utf8'));
const write = (p, v) => writeFileSync(join(root, p), JSON.stringify(v, null, 2) + '\n');

// --- 1. Fixtures dérivées du corpus réel ----------------------------------
const manifest = read('corpus/corpus-manifest.json');
const fragments = read('fragments/fragments.json');

write('fixtures/valid/00-corpus-and-fragments.json', {
  note:
    "FICHIER GÉNÉRÉ par tools/build-derived.mjs. Contient les CorpusFile et CorpusFragment réels, avec leurs offsets et leurs hashes calculés sur les fichiers du corpus. Les schemas de provenance sont ainsi validés contre des données authentiques, pas contre un exemple fabriqué pour passer.",
  collections: [
    { kind: 'corpus-file', records: manifest.files },
    { kind: 'corpus-fragment', records: fragments.fragments }
  ]
});

// --- 2. contentHash sur le golden set -------------------------------------
let stamped = 0;
const goldenDir = join(root, 'fixtures/golden-set');
for (const name of readdirSync(goldenDir)) {
  if (!name.endsWith('.json')) continue;
  const rel = `fixtures/golden-set/${name}`;
  const data = read(rel);
  for (const c of data.collections ?? []) {
    // Les entités runtime n'ont pas de contentHash : elles ne sont pas
    // versionnées comme de la connaissance, elles sont datées comme un fait.
    if (['symptom-observation', 'tolerance-observation', 'irritability-state', 'exercise-response', 'delayed-response', 'clinician-instruction'].includes(c.kind)) continue;
    for (const rec of c.records) {
      if (!rec.id) continue;
      rec.contentHash = contentHashOf(rec);
      stamped++;
    }
  }
  write(rel, data);
}

// --- 3. Registre d'identifiants -------------------------------------------
const registryPath = 'governance/id-registry.json';
const existing = existsSync(join(root, registryPath)) ? read(registryPath) : null;

const entries = [];
const seen = new Set();
for (const dir of ['fixtures/golden-set', 'fixtures/valid']) {
  const abs = join(root, dir);
  if (!existsSync(abs)) continue;
  for (const name of readdirSync(abs)) {
    if (!name.endsWith('.json')) continue;
    const data = read(`${dir}/${name}`);
    for (const c of data.collections ?? []) {
      for (const rec of c.records) {
        // Fragments, fichiers de corpus et entités runtime ne passent pas par
        // le registre : leur identité vient du corpus ou d'une date, pas d'une
        // attribution.
        if (!rec.id || /^(frag|corpus|rt)\./.test(rec.id)) continue;
        if (seen.has(rec.id)) continue;
        seen.add(rec.id);
        const prior = existing?.entries?.find((e) => e.id === rec.id);
        entries.push({
          id: rec.id,
          kind: c.kind,
          currentSlug: rec.slug,
          currentRevision: rec.revision,
          assignedAt: prior?.assignedAt ?? '2026-08-23',
          slugHistory: prior && prior.currentSlug !== rec.slug
            ? [...(prior.slugHistory ?? []), prior.currentSlug]
            : (prior?.slugHistory ?? [])
        });
      }
    }
  }
}
entries.sort((a, b) => a.id.localeCompare(b.id));

write(registryPath, {
  registryVersion: '1.0.0',
  note:
    "Registre des identifiants attribués. Amorcé par tools/build-derived.mjs à partir du golden set, puis APPEND-ONLY : un identifiant qui y figure ne doit jamais être réattribué ni retiré, même si l'entité est retirée. C'est ce registre, et non le texte ni le hash, qui porte l'identité.",
  policy: {
    idIsAssignedOnce: true,
    slugMayChange: true,
    hashIsNotIdentity: true,
    deletionIsLogicalOnly: true
  },
  entries
});

console.log(`fixtures dérivées : ${manifest.files.length} fichiers de corpus, ${fragments.fragments.length} fragments`);
console.log(`contentHash apposés : ${stamped}`);
console.log(`registre d'identifiants : ${entries.length} entrées`);
