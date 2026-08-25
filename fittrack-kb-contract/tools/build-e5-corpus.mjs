#!/usr/bin/env node
// Assemble le corpus final : les 100 fragments annotés par des humains, plus les 107
// extraits par le modèle, projetés pour ne garder que ce qui a été mesuré fiable.
//
// Aucun appel modèle ici. L'outil ne fait que relire, projeter et écrire.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { projectCorpus } from './e5-llm/corpus-projection.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadModelRun(runRoot) {
  const predictionDirectory = join(runRoot, 'predictions');
  if (!existsSync(predictionDirectory)) return [];
  return readdirSync(predictionDirectory)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      const prediction = readJson(join(predictionDirectory, name));
      return {
        fragmentId: prediction.fragmentId,
        status: prediction.status,
        prediction: prediction.prediction
      };
    });
}

export function buildCorpus({ modelRunRoot, outputPath }) {
  const human = readJson(join(root, 'golden/e5/adjudication/adjudicated.json')).annotations;
  const model = modelRunRoot ? loadModelRun(modelRunRoot) : [];
  const manifest = existsSync(join(root, 'benchmark/e5/v0/manifests/corpus-107.json'))
    ? readJson(join(root, 'benchmark/e5/v0/manifests/corpus-107.json'))
    : { holdoutFragmentIds: [] };
  const holdout = new Set(manifest.holdoutFragmentIds ?? []);

  const corpus = projectCorpus({ human, model });
  for (const claim of corpus.claims) {
    // Trace conservée : ces fragments étaient réservés à la validation aveugle.
    // Les inclure la supprime ; savoir lesquels permet de la reconstituer.
    if (holdout.has(claim.fragmentId)) claim.fromBlindHoldout = true;
  }

  const document = {
    ...corpus,
    generatedBy: 'tools/build-e5-corpus.mjs',
    reliability: {
      note: "Chaque claim porte le niveau de confiance de chacun de ses champs. Un champ 'unresolved' est vide parce qu'il a été mesuré non fiable, pas parce qu'il manquait.",
      measuredOn: 'benchmark/e5/v0/runs/dev-100 — 186 claims de référence',
      verified: {
        rawStatement: 'verbatim du corpus source, 0 hallucination sur 227 claims tentées',
        supportSpans: 'coordonnées UTF-8 exactes, relues octet à octet',
        'epistemicStatus=refuted': 'précision 1,00, mesurée deux fois (DEV-20 puis DEV-100)'
      },
      unresolved: {
        epistemicStatus: 'exactitude globale 0,46 hors refuted',
        knowledgeType: 'exactitude 0,689'
      },
      unverified: {
        citationOccurrenceRefs: 'précision 0,766 et rappel 0,670 — piste, pas attribution sûre'
      },
      knownLimits: [
        'Le modèle sur-produit d’environ 20 % : claims ancrées mais que l’annotateur humain n’aurait pas retenues.',
        'refuted n’est trouvé que dans un tiers des cas (rappel 0,33) ; fiable quand il est là, muet souvent.',
        'La couche de sûreté filtre avant écriture : 2 débordements cliniques bloqués sur 227 claims tentées.'
      ]
    }
  };
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  return document;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const runIndex = args.indexOf('--run');
  const outIndex = args.indexOf('--output');
  const outputPath = outIndex === -1 ? join(root, 'candidates/e5-corpus.json') : args[outIndex + 1];
  try {
    const document = buildCorpus({
      modelRunRoot: runIndex === -1 ? null : args[runIndex + 1],
      outputPath
    });
    const s = document.summary;
    console.log(`Corpus écrit : ${outputPath}`);
    console.log(`  fragments ${s.fragments} | claims ${s.claims}`);
    console.log(`  dont humaines ${s.humanClaims} | modèle ${s.modelClaims}`);
    console.log(`  retirées comme sur-découpées : ${s.droppedAsContained}`);
    console.log(`  claims au statut de certitude digne de confiance : ${s.claimsWithTrustedStatus}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
