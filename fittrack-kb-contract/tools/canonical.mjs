// Sérialisation canonique et calcul du contentHash.
//
// Le hash doit détecter un changement de FOND, pas un changement de présentation
// ni un renommage. Trois champs sont donc exclus du calcul :
//   - contentHash lui-même, évidemment ;
//   - slug, parce qu'il peut évoluer librement et que rien ne le référence ;
//   - lifecycle, parce qu'une approbation ou une date de revue ne modifie pas
//     le contenu de l'entité.
// Sans ces exclusions, renommer un slug ferait croire à une modification de
// fond, et le hash finirait par être ignoré parce qu'il crie trop souvent.

import { createHash } from 'node:crypto';

const EXCLUDED = new Set(['contentHash', 'slug', 'lifecycle']);

// Tri récursif des clés. Un tri au seul niveau racine laisserait deux objets
// identiques produire deux hashes différents selon l'ordre de saisie.
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const out = {};
  for (const k of Object.keys(value).sort()) out[k] = canonicalize(value[k]);
  return out;
}

export function contentHashOf(record) {
  const stripped = {};
  for (const [k, v] of Object.entries(record)) {
    if (!EXCLUDED.has(k)) stripped[k] = v;
  }
  return 'sha256:' + createHash('sha256').update(JSON.stringify(canonicalize(stripped)), 'utf8').digest('hex');
}

export const CONTENT_HASH_EXCLUDED_FIELDS = [...EXCLUDED];
