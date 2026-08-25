#!/usr/bin/env node
// Mesure l accord entre deux annotateurs humains avec EXACTEMENT le comparateur qui
// note le modele. C est tout l interet : si l on notait les humains autrement, on ne
// pourrait pas comparer les deux chiffres. Ici « le modele fait 0,68 » et « les
// humains font 0,74 » sont mesures par le meme instrument, sur les memes fragments.
//
// Ce que ca sert a decider : un seuil de gate au-dessus de l accord inter-annotateur
// n est pas un objectif ambitieux, c est un objectif incoherent — il demande au
// modele d etre plus d accord avec l arbitre que les annotateurs ne l ont ete entre
// eux, sur une reference dont la variance est justement ce qu on mesure ici.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMetrics, evaluateFragments } from './e5-llm/evaluate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const defaultRoot = join(here, '..');

// Les seuils du Design Review, tels que les gates DEV-100 les appliquent.
const GATE_THRESHOLDS = {
  claimPrecision: 0.95,
  claimRecall: 0.85,
  knowledgeTypeAccuracy: 0.9,
  epistemicStatusAccuracy: 0.85,
  unresolvedPreservation: 0.9,
  citationPrecision: 0.97,
  citationRecall: 0.9,
  mergedClaimRate: 0.03,
  overFragmentationRate: 0.05
};

const LOWER_IS_BETTER = new Set(['mergedClaimRate', 'overFragmentationRate']);

function readJson(root, relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), 'utf8'));
}

// Une annotation humaine devient un « run record » sans qu aucune donnee de modele
// soit inventee : pas de rawResponse, pas de runId, aucune tentative.
export function annotationsAsRunRecords(annotations) {
  return annotations.map((annotation) => ({
    fragmentId: annotation.fragmentId,
    status: 'VALIDATED',
    prediction: {
      annotationPrediction: annotation.expectedClaims.length > 0 ? 'CLAIMS' : 'ZERO_CLAIM',
      claims: annotation.expectedClaims
    },
    diagnostics: [],
    claimAudit: {
      attempted: annotation.expectedClaims.length,
      retained: annotation.expectedClaims.length,
      filtered: 0,
      claims: annotation.expectedClaims.map(() => ({ individuallyValid: true, diagnostics: [] }))
    },
    attempts: []
  }));
}

function annotationsById(document, label) {
  const map = new Map();
  for (const annotation of document.annotations) map.set(annotation.fragmentId, annotation);
  return { map, label: document.annotatorId ?? label };
}

function compare(primaryAnnotations, secondaryAnnotations) {
  // Le secondaire joue la reference, le primaire joue la prediction.
  const evaluation = evaluateFragments({
    annotations: secondaryAnnotations,
    runRecords: annotationsAsRunRecords(primaryAnnotations)
  });
  return buildMetrics(evaluation.fragmentResults).GLOBAL;
}

export function measureAnnotatorAgreement({
  root = defaultRoot,
  primaryPath,
  secondaryPath,
  fragmentIds
}) {
  const primary = annotationsById(readJson(root, primaryPath), 'primary');
  const secondary = annotationsById(readJson(root, secondaryPath), 'secondary');
  const primaryAnnotations = [];
  const secondaryAnnotations = [];
  for (const fragmentId of fragmentIds) {
    const a = primary.map.get(fragmentId);
    const b = secondary.map.get(fragmentId);
    if (!a) throw new Error(`annotator_did_not_annotate_fragment:${primary.label}:${fragmentId}`);
    if (!b) throw new Error(`annotator_did_not_annotate_fragment:${secondary.label}:${fragmentId}`);
    primaryAnnotations.push(a);
    secondaryAnnotations.push(b);
  }
  return {
    fragmentCount: fragmentIds.length,
    primaryAnnotatorId: primary.label,
    secondaryAnnotatorId: secondary.label,
    forward: compare(primaryAnnotations, secondaryAnnotations),
    reverse: compare(secondaryAnnotations, primaryAnnotations),
    // Plancher de mesure : ce que l instrument affiche en comparant chaque
    // annotateur A LUI-MEME. Devrait etre parfait. Ne l est pas quand un
    // annotateur pose plusieurs claims sur un span identique — la detection de
    // fusion est purement spatiale et ne peut pas les distinguer. Sans ce
    // plancher, on prendrait ce bruit pour du desaccord humain.
    floors: {
      primary: compare(primaryAnnotations, primaryAnnotations),
      secondary: compare(secondaryAnnotations, secondaryAnnotations)
    }
  };
}

// Les claims qui partagent un span rendent la fusion/scission non mesurable sur le
// fragment concerne : aucune prediction ne peut couvrir ce span sans recouvrir
// plusieurs claims de reference a la fois.
export function claimsSharingSpans(annotations) {
  const overlapBytes = (left, right) => {
    let total = 0;
    for (const a of left.supportSpans ?? []) {
      for (const b of right.supportSpans ?? []) {
        total += Math.max(
          0,
          Math.min(a.relativeEndByte, b.relativeEndByte) -
            Math.max(a.relativeStartByte, b.relativeStartByte)
        );
      }
    }
    return total;
  };
  const affected = [];
  for (const annotation of annotations) {
    const claims = annotation.expectedClaims ?? [];
    let pairs = 0;
    for (let i = 0; i < claims.length; i += 1) {
      for (let j = i + 1; j < claims.length; j += 1) {
        if (overlapBytes(claims[i], claims[j]) > 0) pairs += 1;
      }
    }
    if (pairs > 0) affected.push({ fragmentId: annotation.fragmentId, overlappingPairs: pairs });
  }
  return affected;
}

function mean(left, right) {
  if (left === null || left === undefined) return right ?? null;
  if (right === null || right === undefined) return left;
  return (left + right) / 2;
}

// L accord est symetrique par nature : on moyenne les deux sens pour ne pas faire
// dependre le plafond de qui a ete arbitrairement designe « reference ».
export function agreementCeiling(result) {
  const f = result.forward;
  const r = result.reverse;
  const observed = {
    claimPrecision: f.claims.f1,
    claimRecall: f.claims.f1,
    knowledgeTypeAccuracy: mean(
      f.classification.knowledgeTypeAccuracy,
      r.classification.knowledgeTypeAccuracy
    ),
    epistemicStatusAccuracy: mean(
      f.classification.epistemicStatusAccuracy,
      r.classification.epistemicStatusAccuracy
    ),
    unresolvedPreservation: mean(f.unresolved.preservationRate, r.unresolved.preservationRate),
    citationPrecision: mean(f.citations.f1, r.citations.f1),
    citationRecall: mean(f.citations.f1, r.citations.f1),
    mergedClaimRate: mean(f.claims.mergedClaimRate, r.claims.mergedClaimRate),
    overFragmentationRate: mean(f.claims.overFragmentationRate, r.claims.overFragmentationRate)
  };
  // Un axe dont le plancher de mesure n est pas parfait ne peut pas servir de
  // plafond : on ne saurait pas separer le desaccord humain du bruit de l instrument.
  const floorFor = {
    mergedClaimRate: Math.max(
      result.floors.primary.claims.mergedClaimRate,
      result.floors.secondary.claims.mergedClaimRate
    ),
    overFragmentationRate: Math.max(
      result.floors.primary.claims.overFragmentationRate,
      result.floors.secondary.claims.overFragmentationRate
    )
  };
  const axes = {};
  for (const [name, threshold] of Object.entries(GATE_THRESHOLDS)) {
    const value = observed[name];
    const lowerIsBetter = LOWER_IS_BETTER.has(name);
    const floor = floorFor[name] ?? 0;
    const reliable = lowerIsBetter ? floor <= threshold : true;
    const reached =
      value === null || value === undefined
        ? null
        : lowerIsBetter
          ? value <= threshold
          : value >= threshold;
    axes[name] = {
      observed: value,
      threshold,
      lowerIsBetter,
      measurementFloor: floor,
      reliable,
      reachedByHumans: reached
    };
  }
  return { fragmentCount: result.fragmentCount, axes };
}

function fmt(value) {
  return value === null || value === undefined ? '  n/a ' : value.toFixed(4);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const fragmentIds = readJson(
      defaultRoot,
      'golden/e5/source/double-annotation-fragments.json'
    ).fragmentIds;
    const result = measureAnnotatorAgreement({
      primaryPath: 'golden/e5/annotations/annotator-a.json',
      secondaryPath: 'golden/e5/annotations/annotator-b.json',
      fragmentIds
    });
    const ceiling = agreementCeiling(result);
    console.log(
      `Accord inter-annotateur sur ${ceiling.fragmentCount} fragments doublement annotés ` +
        `(${result.primaryAnnotatorId} vs ${result.secondaryAnnotatorId})\n`
    );
    console.log('Axe                        humains    seuil    atteint par 2 humains ?');
    for (const [name, item] of Object.entries(ceiling.axes)) {
      const mark = item.reachedByHumans === null ? 'n/a' : item.reachedByHumans ? 'oui' : 'NON';
      console.log(
        `${name.padEnd(26)} ${fmt(item.observed)}   ${fmt(item.threshold)}   ${mark}`
      );
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
