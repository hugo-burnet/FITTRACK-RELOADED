// Recherche lexicale BM25 sur le corpus, sans aucune dépendance ni modèle.
//
// C'est délibérément la version la plus bête qui puisse marcher. Elle sert de plancher :
// tout ce qu'on construira ensuite — embeddings, modèle sur téléphone — doit la battre
// pour justifier son poids. Si elle répond déjà aux vraies questions, il n'y a rien à
// embarquer de plus.
//
// Le français impose deux choses qu'un BM25 anglais ignore : replier les accents (le
// pratiquant tape « developpe » aussi souvent que « développé ») et couper les élisions
// (« l'exercice » doit indexer « exercice »).

const STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'a', 'au', 'aux', 'en',
  'que', 'qui', 'quoi', 'dont', 'pour', 'par', 'sur', 'sous', 'dans', 'avec', 'sans',
  'est', 'sont', 'ete', 'etre', 'ai', 'as', 'ait', 'ont', 'avoir', 'fait', 'faire',
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'me', 'te', 'se',
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'ce', 'cet', 'cette',
  'ces', 'plus', 'moins', 'tres', 'trop', 'peu', 'si', 'ne', 'pas', 'non', 'oui',
  'mais', 'donc', 'car', 'comme', 'aussi', 'alors', 'y', 'd', 'l', 'c', 'n', 's', 'j',
  'm', 't', 'qu', 'est-ce', 'vraiment', 'juste', 'bien', 'tout', 'toute', 'tous'
]);

export function tokenize(text) {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    // Les élisions portent le mot utile après l'apostrophe.
    .replace(/['’]/gu, ' ')
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token));
}

const K1 = 1.2;
const B = 0.75;

export function buildIndex(documents) {
  const docs = documents.map((document) => {
    const tokens = tokenize(document.text);
    const frequencies = new Map();
    for (const token of tokens) frequencies.set(token, (frequencies.get(token) ?? 0) + 1);
    return { ...document, tokens, frequencies, length: tokens.length };
  });
  const documentFrequency = new Map();
  for (const doc of docs) {
    for (const token of new Set(doc.tokens)) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }
  const averageLength = docs.reduce((sum, doc) => sum + doc.length, 0) / (docs.length || 1);
  return { docs, documentFrequency, averageLength, size: docs.length };
}

function idf(index, token) {
  const n = index.documentFrequency.get(token) ?? 0;
  // IDF de Robertson, bornée à zéro : un terme présent partout n'apporte rien mais ne
  // doit pas pénaliser le document qui le contient.
  return Math.max(0, Math.log((index.size - n + 0.5) / (n + 0.5) + 1));
}

export function search(index, query, { limit = 5 } = {}) {
  const queryTokens = tokenize(query);
  const scored = index.docs.map((doc) => {
    let score = 0;
    const matched = [];
    for (const token of new Set(queryTokens)) {
      const frequency = doc.frequencies.get(token);
      if (!frequency) continue;
      const norm = frequency * (K1 + 1) /
        (frequency + K1 * (1 - B + B * (doc.length / (index.averageLength || 1))));
      score += idf(index, token) * norm;
      matched.push(token);
    }
    return { id: doc.id, text: doc.text, payload: doc.payload, score, matched };
  });
  return scored
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || String(left.id).localeCompare(String(right.id)))
    .slice(0, limit);
}
