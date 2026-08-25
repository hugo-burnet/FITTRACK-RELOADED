#!/usr/bin/env node
// Mesure si le modèle embarqué sait refuser une question que le corpus ne couvre pas.
//
// Tout tourne en local via ollama : embeddings et génération. Aucun appel payant.
// Le banc navigateur reste la référence pour prouver le chemin téléphone ; celui-ci
// existe pour itérer vite — vingt minutes par mesure en WebAssembly rendaient toute
// exploration impraticable.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { buildIndex, search } from '../e5-llm/retrieval.mjs';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const OLLAMA = process.env.OLLAMA_URL ?? 'http://127.0.0.1:11434';

// Écarter les fragments trop courts : mesuré, ils se placent au milieu de l'espace
// sémantique et remontent sur n'importe quelle question.
const MIN_LEN = 60;
const TOP_K = 4;
// On recupere large puis on reclasse : c est tout l interet du reranking.
const CANDIDATES = 12;

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

async function embed(model, input) {
  const response = await fetch(`${OLLAMA}/api/embed`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model, input })
  });
  if (!response.ok) throw new Error(`embed_failed:${response.status}:${await response.text()}`);
  return (await response.json()).embeddings;
}

async function generate(model, prompt, think, maxTokens) {
  const response = await fetch(`${OLLAMA}/api/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      // La décision doit être reproductible : deux mesures du même prompt ne peuvent
      // pas diverger, sinon on ne compare plus rien.
      options: { temperature: 0, num_predict: maxTokens ?? (think ? 900 : 120) },
      think
    })
  });
  if (!response.ok) throw new Error(`generate_failed:${response.status}`);
  return (await response.json()).response.trim();
}


// 61 % des affirmations commencent en milieu de phrase : le schema exige un extrait
// verbatim ancre a l octet, donc la portion exacte, qui a souvent perdu son sujet.
// « conclut a l absence de difference entre les deux approches » — lesquelles ?
// Un modele a qui on donne quatre fragments pareils DOIT combler les trous pour
// repondre, et combler un trou c est fabriquer. On lui rend donc la phrase entiere.
const SENTENCE_EDGE = /[.!?\n]/u;

function hydrate(claim, fragment) {
  const span = (claim.supportSpans ?? [])[0];
  if (!span || !fragment) return claim.rawStatement.replace(/\s+/gu, ' ');
  const bytes = Buffer.from(fragment.rawText, 'utf8');
  // Remonter au début de la phrase, puis descendre jusqu'à sa fin, sans jamais sortir
  // du fragment : le contexte rendu vient du corpus, il n'est pas reconstruit.
  let start = span.relativeStartByte;
  while (start > 0 && !SENTENCE_EDGE.test(bytes.slice(start - 1, start).toString('utf8'))) {
    start -= 1;
  }
  let end = span.relativeEndByte;
  while (end < bytes.length && !SENTENCE_EDGE.test(bytes.slice(end, end + 1).toString('utf8'))) {
    end += 1;
  }
  return bytes
    .slice(start, Math.min(end + 1, bytes.length))
    .toString('utf8')
    .replace(/\s+/gu, ' ')
    .trim();
}

function dot(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) sum += a[i] * b[i];
  return sum;
}

// Fusion par rang réciproque. Les deux recherches trouvent des choses différentes —
// BM25 gagnait sur « mal au coude », les embeddings sur « sensation / EMG ». Fusionner
// sur les RANGS plutôt que sur les scores évite d'avoir à les rendre comparables, ce
// qui n'a pas de sens entre un BM25 étalé de 4 à 16 et un cosinus tassé sur 6 %.
const RRF_K = 60;

export function reciprocalRankFusion(rankings, limit) {
  const scores = new Map();
  for (const ranking of rankings) {
    ranking.forEach((claimIndex, rank) => {
      scores.set(claimIndex, (scores.get(claimIndex) ?? 0) + 1 / (RRF_K + rank + 1));
    });
  }
  return [...scores.entries()]
    .sort((left, right) => right[1] - left[1] || left[0] - right[0])
    .slice(0, limit)
    .map(([claimIndex]) => claimIndex);
}

// Reclassement ponctuel par le modèle lui-même : faute de cross-encoder disponible en
// local, on lui pose une question fermée sur UNE affirmation à la fois. C'est le défaut
// mesuré — il choisit mal parmi quatre — traité en le lui faisant juger séparément.
async function rerank(model, question, candidates) {
  const scored = [];
  for (const candidate of candidates) {
    const prompt = `Question d'un pratiquant de musculation :
${question}

Affirmation extraite d'un corpus :
${candidate.text}

Cette affirmation aide-t-elle à répondre à la question ? Réponds par un seul nombre entre 0 et 10, rien d'autre.`;
    const raw = await generate(model, prompt, false, 6);
    const score = Number((raw.match(/\d+/) ?? ['0'])[0]);
    scored.push({ ...candidate, rerankScore: Number.isFinite(score) ? Math.min(score, 10) : 0 });
  }
  return scored.sort((left, right) => right.rerankScore - left.rerankScore);
}

function normalize(vector) {
  const length = Math.sqrt(dot(vector, vector)) || 1;
  return vector.map((value) => value / length);
}

// Le refus doit être un jeton exact, pas une tournure polie à interpréter : on mesure
// une décision, pas un registre de langue.
export const PROMPTS = {
  // v1 : « refuse si rien ne traite du sujet ». Mesuré sur qwen3:1.7b — refuse 2 fois
  // sur 9 quand il le faudrait, et surtout fabrique en citant : sur les séries jusqu'à
  // l'échec, il a inventé « elles favorisent la fatigue nécessaire » et l'a attribué à
  // une affirmation du corpus. Le pire mode d'échec possible ici.
  v1(question, claims) {
    const list = claims.map((claim, index) => `[${index + 1}] ${claim.text}`).join('\n');
    return `Tu réponds à une question de musculation en t'appuyant UNIQUEMENT sur les affirmations ci-dessous, extraites d'un corpus vérifié.

AFFIRMATIONS DISPONIBLES
${list}

QUESTION
${question}

RÈGLES
- Si aucune affirmation ne traite du sujet de la question, réponds exactement : HORS_CORPUS
- Sinon, réponds en une seule phrase, en citant entre crochets les numéros utilisés.
- N'ajoute jamais une information absente des affirmations.

RÉPONSE :`;
  },

  // v2 : le refus devient le défaut, et la décision est décomposée. Un petit modèle
  // juge mal « est-ce hors sujet ? » en une passe ; il juge mieux « cette affirmation
  // parle-t-elle de ce que je demande ? », une affirmation à la fois. L'interdiction
  // porte explicitement sur l'ajout d'un mécanisme ou d'une cause, la fabrication
  // observée en v1.
  v2(question, claims) {
    const list = claims.map((claim, index) => `[${index + 1}] ${claim.text}`).join('\n');
    return `Voici une question et quatre affirmations tirées d'un corpus de musculation.

QUESTION
${question}

AFFIRMATIONS
${list}

Étape 1 — Pour chaque affirmation, dis si elle parle du sujet exact de la question.
Réponds sur une ligne : PERTINENTES: suivi des numéros, ou PERTINENTES: AUCUNE

Étape 2 —
- Si tu as écrit AUCUNE, écris exactement HORS_CORPUS et arrête-toi.
- Sinon, écris une phrase qui reformule ce que disent les affirmations retenues, en
  citant leurs numéros. Tu n'as pas le droit d'ajouter une cause, un mécanisme, un
  chiffre ou une recommandation qui ne figure pas mot pour mot dans une affirmation
  retenue. Si tu ne peux pas répondre sans en ajouter, écris HORS_CORPUS.`;
  }
};

export function buildPrompt(question, claims, variant = 'v2') {
  return PROMPTS[variant](question, claims);
}

export async function runJudge({ embedModel = 'bge-m3', chatModel = 'qwen3:1.7b', variant = 'v2', think = true, context = false, hybrid = false, reranked = false, outputPath } = {}) {
  const corpus = readJson(join(root, 'candidates/e5-corpus.json'));
  const fragments = readJson(join(root, 'candidates/e5-prose-fragments.json'));
  const questions = readJson(join(root, 'benchmark/e5-retrieval/questions-30.json'));
  const fragmentById = new Map(fragments.fragments.map((f) => [f.fragmentId, f]));
  const headings = new Map(
    fragments.fragments.map((fragment) => [fragment.fragmentId, (fragment.headingPath ?? []).join(' > ')])
  );

  const claims = corpus.claims
    .map((claim) => ({
      fragmentId: claim.fragmentId,
      text: context
        ? hydrate(claim, fragmentById.get(claim.fragmentId))
        : claim.rawStatement.replace(/\s+/gu, ' ')
    }))
    .filter((claim) => claim.text.length >= MIN_LEN);

  process.stdout.write(`index : ${claims.length} affirmations`);
  const vectors = [];
  for (let index = 0; index < claims.length; index += 32) {
    const batch = claims
      .slice(index, index + 32)
      .map((claim) => `${headings.get(claim.fragmentId) ?? ''} ${claim.text}`);
    vectors.push(...(await embed(embedModel, batch)).map(normalize));
    process.stdout.write('.');
  }
  process.stdout.write('\n');

  const lexicalIndex = buildIndex(claims.map((c, i) => ({ id: i, text: c.text, payload: i })));

  const queryVectors = (await embed(embedModel, questions.questions.map((q) => q.text))).map(normalize);

  const results = [];
  for (const [index, question] of questions.questions.entries()) {
    const denseRanking = vectors
      .map((vector, claimIndex) => ({ claimIndex, score: dot(queryVectors[index], vector) }))
      .sort((left, right) => right.score - left.score)
      .map((item) => item.claimIndex);

    // Fusionner les deux recherches quand on le demande : chacune rattrape les angles
    // morts de l'autre, et fusionner sur les rangs évite d'avoir à comparer un BM25
    // étalé de 4 à 16 avec un cosinus tassé sur 6 %.
    const ranking = hybrid
      ? reciprocalRankFusion(
          [denseRanking, search(lexicalIndex, question.text, { limit: 60 }).map((hit) => hit.payload)],
          CANDIDATES
        )
      : denseRanking.slice(0, CANDIDATES);

    // Dédupliquer sur le texte réellement fourni. Sans ça, l'hydratation rend identiques
    // plusieurs claims extraites de la même phrase : 120 affirmations récupérées ne
    // donnaient que 77 textes distincts, et trois questions recevaient quatre fois la
    // même. Le modèle croyait avoir quatre sources, il en avait une.
    const seen = new Set();
    const candidates = [];
    for (const claimIndex of ranking) {
      const claim = claims[claimIndex];
      if (seen.has(claim.text)) continue;
      seen.add(claim.text);
      candidates.push(claim);
    }

    const top = (reranked ? await rerank(chatModel, question.text, candidates) : candidates).slice(
      0,
      TOP_K
    );

    const answer = await generate(chatModel, buildPrompt(question.text, top, variant), think);
    const refused = /HORS_CORPUS/i.test(answer);
    results.push({ questionId: question.questionId, question: question.text, refused, answer, retrieved: top });
    console.log(`${question.questionId} ${refused ? 'REFUS ' : 'répond'} ${question.text.slice(0, 52)}`);
  }

  const document = { embedModel, chatModel, variant, think, context, hybrid, reranked, topK: TOP_K, minLen: MIN_LEN, indexed: claims.length, results };
  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  }
  return document;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const option = (name, fallback) => {
    const index = args.indexOf(`--${name}`);
    return index === -1 ? fallback : args[index + 1];
  };
  runJudge({
    embedModel: option('embed', 'bge-m3'),
    chatModel: option('model', 'qwen3:1.7b'),
    variant: option('prompt', 'v2'),
    think: option('think', 'true') !== 'false',
    context: option('context', 'false') === 'true',
    hybrid: option('hybrid', 'false') === 'true',
    reranked: option('rerank', 'false') === 'true',
    outputPath: option('output', join(root, 'benchmark/e5-retrieval/judge-run.json'))
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
