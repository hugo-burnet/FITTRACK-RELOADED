#!/usr/bin/env node
// Dérive de vocabularies/vocabularies.source.json :
//   - un fichier par vocabulaire : vocabularies/<id>.vocab.json
//   - les enums machine : schemas/common/vocab.schema.json
//
// Pourquoi générer : le prompt exige d'éviter « la duplication contradictoire
// entre schemas ». Recopier à la main une trentaine d'enums dans un schéma et
// dans une documentation garantit une divergence à la première correction.
// Ici la divergence est impossible par construction.

import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const vocabDir = join(root, 'vocabularies');

const src = JSON.parse(readFileSync(join(vocabDir, 'vocabularies.source.json'), 'utf8'));

// camelCase du vocabularyId : "knowledge-type" -> "knowledgeType"
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// Nettoyage des fichiers dérivés d'une exécution précédente : un vocabulaire
// supprimé de la source doit disparaître, pas survivre en orphelin.
for (const f of readdirSync(vocabDir)) {
  if (f.endsWith('.vocab.json')) unlinkSync(join(vocabDir, f));
}

const defs = {};
const index = [];

for (const v of src.vocabularies) {
  const terms = v.terms.map((t) => t.term);
  if (new Set(terms).size !== terms.length) {
    throw new Error('Termes dupliqués dans le vocabulaire ' + v.vocabularyId);
  }

  writeFileSync(
    join(vocabDir, `${v.vocabularyId}.vocab.json`),
    JSON.stringify(
      {
        $schema: 'https://fittrack.local/kb/schemas/common/vocabulary-file.schema.json',
        generatedBy: 'tools/build-vocabularies.mjs',
        vocabularyId: v.vocabularyId,
        title: v.title,
        origin: v.origin,
        description: v.description,
        closed: v.closed,
        terms: v.terms
      },
      null,
      2
    ) + '\n'
  );

  defs[camel(v.vocabularyId)] = {
    title: v.title,
    description: v.description + ' — origine : ' + v.origin,
    enum: terms
  };

  index.push({
    vocabularyId: v.vocabularyId,
    title: v.title,
    origin: v.origin,
    termCount: terms.length,
    file: `${v.vocabularyId}.vocab.json`,
    schemaDef: '#/$defs/' + camel(v.vocabularyId)
  });
}

writeFileSync(
  join(root, 'schemas/common/vocab.schema.json'),
  JSON.stringify(
    {
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'https://fittrack.local/kb/schemas/common/vocab.schema.json',
      title: 'Vocabulaires contrôlés (généré)',
      description:
        'FICHIER GÉNÉRÉ par tools/build-vocabularies.mjs depuis vocabularies/vocabularies.source.json. Ne pas éditer à la main : la prochaine génération écrasera la modification.',
      $defs: defs
    },
    null,
    2
  ) + '\n'
);

writeFileSync(
  join(vocabDir, 'index.json'),
  JSON.stringify(
    { generatedBy: 'tools/build-vocabularies.mjs', vocabularies: index },
    null,
    2
  ) + '\n'
);

console.log(
  `vocabulaires : ${index.length} fichiers, ${index.reduce((n, v) => n + v.termCount, 0)} termes`
);
