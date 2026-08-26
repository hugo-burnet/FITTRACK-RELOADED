// Le reclassement, hors du fil principal.
//
// La première version faisait tourner le modèle dans la page : Chrome affichait
// « Page ne répondant pas », chez moi comme chez le propriétaire. Deux fautes
// cumulées — tout sur le fil principal, et les ~18 paires envoyées en UN seul
// passage avec padding. Pour 568 M de paramètres en WASM, c'est un bloc de
// calcul indivisible de plusieurs minutes.
//
// Ici le modèle vit dans un worker et les paires passent par petits lots. La
// page reste vivante, affiche l'avancement, et un run lent se distingue d'un run
// planté — ce qu'on ne pouvait pas savoir avant.
//
// TROISIÈME correction, et c'est celle qui comptait : ce banc mesurait sans le
// dire un WASM MONO-THREAD sur CPU. `SharedArrayBuffer` manquait faute
// d'en-têtes d'isolation côté serveur, et WebGPU n'était jamais demandé. Un
// facteur 10 à 50 de perdu, attribué au modèle. Le backend réellement utilisé
// et le nombre de fils sont désormais publiés avec le résultat : une mesure qui
// ne dit pas sur quoi elle a tourné ne se compare à rien.
import {
  AutoModelForSequenceClassification,
  AutoTokenizer,
  env
} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6';

const BATCH = 4;
let tokenizer = null;
let reranker = null;

async function load({ id, revision, dtype, device }) {
  env.allowLocalModels = false;

  // Sans isolation multi-origine, onnxruntime-web ne peut pas allouer de
  // mémoire partagée et tombe sur un seul fil sans le signaler.
  const isolated = Boolean(self.crossOriginIsolated);
  const threads = isolated ? (navigator.hardwareConcurrency || 4) : 1;
  env.backends.onnx.wasm.numThreads = threads;

  postMessage({ type: 'status', text: `téléchargement de ${id} (${dtype})…` });
  const started = Date.now();

  // transformers.js publie l'avancement de chaque fichier. Sans ça, l'écran
  // affiche « téléchargement… » pendant plusieurs minutes et un transfert lent
  // devient indistinguable d'un transfert bloqué — c'est exactement le défaut
  // qui a fait croire que la première version avait planté.
  const progress_callback = (report) => {
    if (report.status !== 'progress' || typeof report.progress !== 'number') return;
    postMessage({
      type: 'download',
      file: report.file,
      percent: Math.round(report.progress),
      loaded: report.loaded ?? 0,
      total: report.total ?? 0
    });
  };

  tokenizer = await AutoTokenizer.from_pretrained(id, { revision, progress_callback });

  // WebGPU d'abord quand la machine en a un, WASM sinon. Le repli est explicite
  // et annoncé : un banc qui bascule en silence produit deux mesures sous le
  // même nom.
  const wantsGpu = device === 'webgpu' && Boolean(navigator.gpu);
  let backend = wantsGpu ? 'webgpu' : 'wasm';
  let effectiveDtype = dtype;
  try {
    reranker = await AutoModelForSequenceClassification.from_pretrained(id, {
      revision,
      dtype,
      device: backend,
      progress_callback
    });
  } catch (error) {
    if (backend !== 'webgpu') throw error;
    postMessage({ type: 'status', text: `WebGPU refusé (${error.message}) — repli WASM…` });
    backend = 'wasm';
    effectiveDtype = 'q8';
    reranker = await AutoModelForSequenceClassification.from_pretrained(id, {
      revision,
      dtype: effectiveDtype,
      device: 'wasm',
      progress_callback
    });
  }

  postMessage({
    type: 'ready',
    seconds: Math.round((Date.now() - started) / 1000),
    backend,
    dtype: effectiveDtype,
    threads,
    isolated,
    gpu: Boolean(navigator.gpu)
  });
}

/** Scores de pertinence pour une question contre N passages, par petits lots. */
async function score(question, passages, index) {
  const out = [];
  for (let start = 0; start < passages.length; start += BATCH) {
    const slice = passages.slice(start, start + BATCH);
    const inputs = tokenizer(
      slice.map(() => question),
      { text_pair: slice, padding: true, truncation: true }
    );
    const { logits } = await reranker(inputs);
    for (const row of logits.tolist()) out.push(row[0]);
    // Publié à chaque lot, pas seulement à la fin de la question. Le premier
    // passage inclut la mise en route du graphe et peut durer une minute : sans
    // ce signal, l'écran reste figé sur « modèle prêt » et on ne sait pas si ça
    // calcule ou si c'est mort.
    postMessage({ type: 'batch', index, done: out.length, total: passages.length });
  }
  return out;
}

onmessage = async (event) => {
  const { type, payload } = event.data;
  try {
    if (type === 'load') {
      await load(payload);
      return;
    }
    if (type === 'score') {
      const scores = await score(payload.question, payload.passages, payload.index);
      postMessage({ type: 'scored', index: payload.index, scores });
    }
  } catch (error) {
    postMessage({ type: 'error', message: String(error && error.message ? error.message : error) });
  }
};
