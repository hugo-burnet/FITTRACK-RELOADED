import {
  classifyResolutionDisagreement,
  isResolved
} from './resolution-state.mjs';

// Les cinq axes portant un etat de resolution.
const RESOLUTION_AXES = [
  'knowledgeType',
  'epistemicStatus',
  'confidenceByAspect',
  'directness',
  'evidenceTypes'
];

const ERROR_CATEGORIES = [
  'MISSED_CLAIM',
  'EXTRA_CLAIM',
  'MERGED_CLAIMS',
  'OVER_FRAGMENTATION',
  'WRONG_SPAN',
  'SPAN_HALLUCINATION',
  'WRONG_CITATION',
  'CITATION_BLEED',
  'INVENTED_CITATION',
  'WRONG_KNOWLEDGE_TYPE',
  'WRONG_EPISTEMIC_STATUS',
  'UNRESOLVED_FORCED',
  'EVIDENCE_INFLATION',
  'UNSUPPORTED_INFERENCE',
  'EMG_HYPERTROPHY_LEAP',
  'BIOMECHANICS_RISK_LEAP',
  'CLINICAL_OVERREACH',
  'INVENTED_DIAGNOSIS',
  'ZERO_CLAIM_FALSE_POSITIVE',
  'ZERO_CLAIM_FALSE_NEGATIVE',
  'INVENTED_SOURCE',
  'INVALID_JSON',
  'SCHEMA_FAILURE',
  'PROVIDER_ERROR',
  'MISSING_PREDICTION'
];

const NEGATION_RE = /\b(?:ne|n[’']|pas|non|sans|aucun|aucune|ni|jamais)\b/giu;
const TEMPORAL_RE = /\b(?:court terme|long terme|durable|immédiat\w*|lendemain|semaine\w*|jour\w*|pendant|après|avant|24\s*[–-]\s*48\s*h)\b/giu;
const POPULATION_RE = /\b(?:chez|sujets?|patients?|personnes?|athlètes?|pratiquants?|hommes?|femmes?|population|tendinopath\w*|lombalg\w*|épicondyl\w*|douleurs? chroniques?)\b/giu;

function divide(numerator, denominator, empty = null) {
  return denominator ? numerator / denominator : empty;
}

function f1(precision, recall) {
  return precision !== null && recall !== null && precision + recall
    ? (2 * precision * recall) / (precision + recall)
    : precision === 0 || recall === 0
      ? 0
      : null;
}

function bounds(claim) {
  return claim.supportSpans.map((span) => ({
    start: span.relativeStartByte,
    end: span.relativeEndByte
  }));
}

function totalLength(intervals) {
  return intervals.reduce((sum, item) => sum + item.end - item.start, 0);
}

export function spanOverlap(left, right) {
  const a = bounds(left);
  const b = bounds(right);
  let intersection = 0;
  for (const x of a) {
    for (const y of b) {
      intersection += Math.max(0, Math.min(x.end, y.end) - Math.max(x.start, y.start));
    }
  }
  return divide(intersection, Math.max(totalLength(a), totalLength(b)), 0);
}

function normalizeTokens(text) {
  return new Set(
    text
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLocaleLowerCase('fr')
      .replace(/https?:\/\/\S+/giu, ' ')
      .replace(/[*_`#[\](){}.,;:!?/\\|–—−+%=<>]/g, ' ')
      .split(/\s+/u)
      .filter((token) => token.length >= 3)
  );
}

function jaccard(left, right) {
  const a = left instanceof Set ? left : new Set(left);
  const b = right instanceof Set ? right : new Set(right);
  if (!a.size && !b.size) return 1;
  let intersection = 0;
  for (const value of a) if (b.has(value)) intersection += 1;
  return divide(intersection, new Set([...a, ...b]).size, 0);
}

function citationRefs(claim) {
  return claim.citationOccurrenceRefs ?? claim.citationOccurrenceIds ?? [];
}

function negationSignature(text) {
  return [...text.matchAll(NEGATION_RE)].map((match) => match[0].toLocaleLowerCase('fr')).sort();
}

export function claimMatchScore(prediction, golden) {
  const overlap = spanOverlap(prediction, golden);
  const lexical = jaccard(normalizeTokens(prediction.rawStatement), normalizeTokens(golden.rawStatement));
  const citations = jaccard(citationRefs(prediction), citationRefs(golden));
  const polarityCompatible =
    (negationSignature(prediction.rawStatement).length > 0) ===
    (negationSignature(golden.rawStatement).length > 0);
  const score = 0.72 * overlap + 0.2 * lexical + 0.08 * citations - (polarityCompatible ? 0 : 0.2);
  return { score: Math.max(0, score), overlap, lexical, citations, polarityCompatible };
}

export function alignPredictionToGolden(predictions, goldenClaims) {
  const candidates = [];
  for (let predictionIndex = 0; predictionIndex < predictions.length; predictionIndex += 1) {
    for (let goldenIndex = 0; goldenIndex < goldenClaims.length; goldenIndex += 1) {
      const detail = claimMatchScore(predictions[predictionIndex], goldenClaims[goldenIndex]);
      if (
        detail.overlap >= 0.2 &&
        detail.score >= 0.25 &&
        detail.polarityCompatible
      ) {
        candidates.push({ predictionIndex, goldenIndex, ...detail });
      }
    }
  }
  candidates.sort(
    (left, right) =>
      right.score - left.score ||
      left.predictionIndex - right.predictionIndex ||
      left.goldenIndex - right.goldenIndex
  );
  const usedPredictions = new Set();
  const usedGolden = new Set();
  const pairs = [];
  for (const candidate of candidates) {
    if (
      usedPredictions.has(candidate.predictionIndex) ||
      usedGolden.has(candidate.goldenIndex)
    ) {
      continue;
    }
    usedPredictions.add(candidate.predictionIndex);
    usedGolden.add(candidate.goldenIndex);
    pairs.push(candidate);
  }
  return { pairs, candidates, usedPredictions, usedGolden };
}

function error(fragmentId, category, prediction, golden, details = {}) {
  return { fragmentId, category, prediction: prediction ?? null, golden: golden ?? null, details };
}

function scopeOf(fragmentId) {
  return fragmentId.includes('.f2.') || fragmentId.includes('.e5f2.') ? 'F2' : 'F3';
}

function statusRank(status) {
  return {
    absence_of_evidence: 0,
    practice_only: 0,
    mechanistic_only: 0,
    controversial: 1,
    uncertain: 1,
    probable: 2,
    established_direction: 3,
    established: 4,
    refuted: 2
  }[status] ?? null;
}

function conservationForPair(prediction, golden) {
  const dimensions = {};
  for (const [name, regex] of [
    ['negation', NEGATION_RE],
    ['population', POPULATION_RE],
    ['temporality', TEMPORAL_RE]
  ]) {
    const expected = [...golden.rawStatement.matchAll(regex)].map((match) =>
      match[0].toLocaleLowerCase('fr')
    );
    dimensions[name] = {
      applicable: expected.length > 0,
      conserved:
        expected.length === 0 ||
        expected.some((term) => prediction.rawStatement.toLocaleLowerCase('fr').includes(term))
    };
  }
  return dimensions;
}

function legacyAttemptedClaimCount(runRecord) {
  return (runRecord?.attempts ?? []).reduce((sum, attempt) => {
    if (!attempt?.rawResponse) return sum;
    try {
      const parsed = JSON.parse(attempt.rawResponse);
      return sum + (Array.isArray(parsed.claims) ? parsed.claims.length : 0);
    } catch {
      return sum;
    }
  }, 0);
}

// Depuis v0.4, une claim dangereuse est filtrée avant matérialisation : elle ne
// figure plus dans la prédiction retenue. Prendre le denominateur dans le
// claimAudit est le seul moyen de garder ces claims au dénominateur des taux de
// sécurité — sinon filtrer une hallucination la ferait disparaître des métriques.
// Le parsing des rawResponse ne subsiste que pour le replay v0.3, qui n'a pas d'audit.
function claimAuditCounts(runRecord) {
  const audit = runRecord?.claimAudit;
  if (audit && typeof audit.attempted === 'number') {
    return {
      attempted: audit.attempted,
      retained: audit.retained ?? 0,
      filtered: audit.filtered ?? audit.attempted - (audit.retained ?? 0)
    };
  }
  const attempted = legacyAttemptedClaimCount(runRecord);
  const retained = runRecord?.prediction?.claims?.length ?? 0;
  return { attempted, retained, filtered: 0 };
}

export function evaluateFragments({ annotations, runRecords }) {
  const errors = [];
  const fragmentResults = [];
  const recordsById = new Map(runRecords.map((record) => [record.fragmentId, record]));
  for (const annotation of annotations) {
    const record = recordsById.get(annotation.fragmentId) ?? {
      fragmentId: annotation.fragmentId,
      status: 'REJECTED',
      prediction: null,
      diagnostics: [{ code: 'MISSING_PREDICTION' }],
      attempts: []
    };
    const predictions = record.prediction?.claims ?? [];
    const counts = claimAuditCounts(record);
    const goldenClaims = annotation.expectedClaims;
    const alignment = alignPredictionToGolden(predictions, goldenClaims);
    const localErrors = [];
    for (let index = 0; index < predictions.length; index += 1) {
      if (!alignment.usedPredictions.has(index)) {
        localErrors.push(error(annotation.fragmentId, 'EXTRA_CLAIM', predictions[index], null));
      }
    }
    for (let index = 0; index < goldenClaims.length; index += 1) {
      if (!alignment.usedGolden.has(index)) {
        localErrors.push(error(annotation.fragmentId, 'MISSED_CLAIM', null, goldenClaims[index]));
      }
    }
    for (const pair of alignment.pairs) {
      const prediction = predictions[pair.predictionIndex];
      const golden = goldenClaims[pair.goldenIndex];
      if (pair.overlap < 0.8) {
        localErrors.push(
          error(annotation.fragmentId, 'WRONG_SPAN', prediction, golden, {
            overlap: pair.overlap,
            lexicalSimilarity: pair.lexical
          })
        );
      }
      if (
        golden.knowledgeType !== undefined &&
        prediction.knowledgeType !== golden.knowledgeType
      ) {
        localErrors.push(
          error(annotation.fragmentId, 'WRONG_KNOWLEDGE_TYPE', prediction, golden, {
            predicted: prediction.knowledgeType,
            expected: golden.knowledgeType
          })
        );
      }
      if (
        golden.epistemicStatus !== undefined &&
        prediction.epistemicStatus !== golden.epistemicStatus
      ) {
        localErrors.push(
          error(annotation.fragmentId, 'WRONG_EPISTEMIC_STATUS', prediction, golden, {
            predicted: prediction.epistemicStatus,
            expected: golden.epistemicStatus
          })
        );
        const predictedRank = statusRank(prediction.epistemicStatus);
        const goldenRank = statusRank(golden.epistemicStatus);
        if (predictedRank !== null && goldenRank !== null && predictedRank > goldenRank) {
          localErrors.push(
            error(annotation.fragmentId, 'EVIDENCE_INFLATION', prediction, golden, {
              predicted: prediction.epistemicStatus,
              expected: golden.epistemicStatus
            })
          );
        }
      }
      // Seul le fait de trancher là où la référence s'abstient est une erreur. Choisir
      // `NOT_STATED` plutôt que `UNRESOLVED` n'invente aucune certitude — et le prompt
      // n'enseignait même pas le premier, donc le reprocher revenait à noter le modèle
      // sur un vocabulaire qu'on ne lui avait pas donné.
      for (const axis of RESOLUTION_AXES) {
        if (
          classifyResolutionDisagreement(
            golden.axisResolution[axis]?.state,
            prediction.axisResolution[axis]?.state
          ) === 'OVER_RESOLVED'
        ) {
          localErrors.push(
            error(annotation.fragmentId, 'UNRESOLVED_FORCED', prediction, golden, { axis })
          );
        }
      }
      const predictedCitations = new Set(citationRefs(prediction));
      const goldenCitations = new Set(citationRefs(golden));
      const wrongPredicted = [...predictedCitations].filter((item) => !goldenCitations.has(item));
      const missedGolden = [...goldenCitations].filter((item) => !predictedCitations.has(item));
      if (wrongPredicted.length || missedGolden.length) {
        localErrors.push(
          error(annotation.fragmentId, 'WRONG_CITATION', prediction, golden, {
            wrongPredicted,
            missedGolden
          })
        );
      }
    }
    for (let predictionIndex = 0; predictionIndex < predictions.length; predictionIndex += 1) {
      const overlaps = goldenClaims
        .map((golden, goldenIndex) => ({
          goldenIndex,
          overlap: spanOverlap(predictions[predictionIndex], golden)
        }))
        .filter((item) => item.overlap >= 0.2);
      if (overlaps.length >= 2) {
        localErrors.push(
          error(annotation.fragmentId, 'MERGED_CLAIMS', predictions[predictionIndex], overlaps.map((item) => goldenClaims[item.goldenIndex]), {
            overlaps
          })
        );
      }
    }
    for (let goldenIndex = 0; goldenIndex < goldenClaims.length; goldenIndex += 1) {
      const overlaps = predictions
        .map((prediction, predictionIndex) => ({
          predictionIndex,
          overlap: spanOverlap(prediction, goldenClaims[goldenIndex])
        }))
        .filter((item) => item.overlap >= 0.2);
      if (overlaps.length >= 2) {
        localErrors.push(
          error(annotation.fragmentId, 'OVER_FRAGMENTATION', overlaps.map((item) => predictions[item.predictionIndex]), goldenClaims[goldenIndex], {
            overlaps
          })
        );
      }
    }
    const goldenZero = annotation.annotationStatus === 'zero_claim';
    const predictedZero = record.prediction?.annotationPrediction === 'ZERO_CLAIM';
    if (goldenZero && !predictedZero) {
      localErrors.push(error(annotation.fragmentId, 'ZERO_CLAIM_FALSE_POSITIVE', predictions, []));
    }
    if (!goldenZero && predictedZero) {
      localErrors.push(error(annotation.fragmentId, 'ZERO_CLAIM_FALSE_NEGATIVE', [], goldenClaims));
    }
    // Le même diagnostic est publié par l'audit de claim, par le fragment et par la
    // tentative. La signature les réduit à une occurrence : sans cela, une claim
    // filtrée comptait trois hallucinations pour une.
    const auditDiagnostics = [
      ...(record.claimAudit?.claims ?? []).flatMap((item) => item.diagnostics ?? []),
      ...(record.diagnostics ?? []),
      ...(record.attempts ?? []).flatMap((attempt) => attempt.validation?.diagnostics ?? [])
    ];
    const seenAuditDiagnostic = new Set();
    for (const item of auditDiagnostics) {
      if (ERROR_CATEGORIES.includes(item.code)) {
        const signature = `${item.code}:${JSON.stringify(item)}`;
        if (!seenAuditDiagnostic.has(signature)) {
          localErrors.push(error(annotation.fragmentId, item.code, null, null, item));
          seenAuditDiagnostic.add(signature);
        }
      }
    }
    errors.push(...localErrors);
    const precision = divide(alignment.pairs.length, predictions.length, goldenClaims.length === 0 ? 1 : 0);
    const recall = divide(alignment.pairs.length, goldenClaims.length, predictions.length === 0 ? 1 : 0);
    fragmentResults.push({
      fragmentId: annotation.fragmentId,
      corpus: scopeOf(annotation.fragmentId),
      status: record.status,
      predictedClaimCount: predictions.length,
      goldenClaimCount: goldenClaims.length,
      matchedClaimCount: alignment.pairs.length,
      precision,
      recall,
      f1: f1(precision, recall),
      exactClaimCount: predictions.length === goldenClaims.length,
      goldenZero,
      predictedZero,
      predictionClaims: predictions,
      goldenClaims,
      pairs: alignment.pairs.map((pair) => ({
        ...pair,
        prediction: predictions[pair.predictionIndex],
        golden: goldenClaims[pair.goldenIndex],
        conservation: conservationForPair(
          predictions[pair.predictionIndex],
          goldenClaims[pair.goldenIndex]
        )
      })),
      attemptedClaimCount: counts.attempted,
      retainedClaimCount: counts.retained,
      filteredClaimCount: counts.filtered,
      errors: localErrors
    });
  }
  return { fragmentResults, errors };
}

function metricsForScope(fragmentResults, scope) {
  const fragments = scope === 'GLOBAL' ? fragmentResults : fragmentResults.filter((item) => item.corpus === scope);
  const matched = fragments.reduce((sum, item) => sum + item.matchedClaimCount, 0);
  const predicted = fragments.reduce((sum, item) => sum + item.predictedClaimCount, 0);
  const golden = fragments.reduce((sum, item) => sum + item.goldenClaimCount, 0);
  const claimPrecision = divide(matched, predicted, golden === 0 ? 1 : 0);
  const claimRecall = divide(matched, golden, predicted === 0 ? 1 : 0);
  const pairs = fragments.flatMap((item) => item.pairs);
  let citationTp = 0;
  let citationFp = 0;
  let citationFn = 0;
  let knowledgeComparable = 0;
  let knowledgeCorrect = 0;
  let epistemicComparable = 0;
  let epistemicCorrect = 0;
  const knowledgeTypeConfusionMatrix = {};
  const epistemicStatusConfusionMatrix = {};
  const cannotConclude = { applicableClaims: 0, preservedClaims: 0, goldenItems: 0, predictedItems: 0 };
  const unresolved = { goldenAxes: 0, preserved: 0, forced: 0, vocabularyOnly: 0 };
  const conservation = {
    negation: { applicable: 0, conserved: 0 },
    population: { applicable: 0, conserved: 0 },
    temporality: { applicable: 0, conserved: 0 }
  };
  for (const pair of pairs) {
    const predictedCitations = new Set(citationRefs(pair.prediction));
    const goldenCitations = new Set(citationRefs(pair.golden));
    for (const citation of predictedCitations) {
      if (goldenCitations.has(citation)) citationTp += 1;
      else citationFp += 1;
    }
    for (const citation of goldenCitations) if (!predictedCitations.has(citation)) citationFn += 1;
    if (pair.golden.knowledgeType !== undefined) {
      knowledgeComparable += 1;
      if (pair.prediction.knowledgeType === pair.golden.knowledgeType) knowledgeCorrect += 1;
      const goldenValue = pair.golden.knowledgeType ?? 'null';
      const predictedValue = pair.prediction.knowledgeType ?? 'null';
      knowledgeTypeConfusionMatrix[goldenValue] ??= {};
      knowledgeTypeConfusionMatrix[goldenValue][predictedValue] =
        (knowledgeTypeConfusionMatrix[goldenValue][predictedValue] ?? 0) + 1;
    }
    if (pair.golden.epistemicStatus !== undefined) {
      epistemicComparable += 1;
      if (pair.prediction.epistemicStatus === pair.golden.epistemicStatus) epistemicCorrect += 1;
      const goldenValue = pair.golden.epistemicStatus ?? 'null';
      const predictedValue = pair.prediction.epistemicStatus ?? 'null';
      epistemicStatusConfusionMatrix[goldenValue] ??= {};
      epistemicStatusConfusionMatrix[goldenValue][predictedValue] =
        (epistemicStatusConfusionMatrix[goldenValue][predictedValue] ?? 0) + 1;
    }
    const goldenCannotConclude = pair.golden.cannotConclude ?? [];
    if (goldenCannotConclude.length > 0) {
      const predictedCannotConclude = pair.prediction.cannotConclude ?? [];
      cannotConclude.applicableClaims += 1;
      cannotConclude.goldenItems += goldenCannotConclude.length;
      cannotConclude.predictedItems += predictedCannotConclude.length;
      if (predictedCannotConclude.length > 0) cannotConclude.preservedClaims += 1;
    }
    for (const axis of RESOLUTION_AXES) {
      const goldenState = pair.golden.axisResolution[axis]?.state;
      if (isResolved(goldenState) || goldenState === undefined) continue;
      const predictedState = pair.prediction.axisResolution[axis]?.state;
      unresolved.goldenAxes += 1;
      // « Préservé » veut dire « s'est abstenu comme la référence », quel que soit le
      // synonyme employé. Les deux familles restent comptées à part pour rester lisibles.
      const verdict = classifyResolutionDisagreement(goldenState, predictedState);
      if (verdict === 'IDENTICAL' || verdict === 'VOCABULARY_ONLY') unresolved.preserved += 1;
      if (verdict === 'VOCABULARY_ONLY') unresolved.vocabularyOnly += 1;
      if (verdict === 'OVER_RESOLVED') unresolved.forced += 1;
    }
    for (const name of Object.keys(conservation)) {
      if (pair.conservation[name].applicable) {
        conservation[name].applicable += 1;
        if (pair.conservation[name].conserved) conservation[name].conserved += 1;
      }
    }
  }
  const matchedPredictionIndexes = new Set(
    fragments.flatMap((fragment) => fragment.pairs.map((pair) => `${fragment.fragmentId}:${pair.predictionIndex}`))
  );
  const matchedGoldenIndexes = new Set(
    fragments.flatMap((fragment) => fragment.pairs.map((pair) => `${fragment.fragmentId}:${pair.goldenIndex}`))
  );
  for (const fragment of fragments) {
    for (let index = 0; index < fragment.predictedClaimCount; index += 1) {
      if (!matchedPredictionIndexes.has(`${fragment.fragmentId}:${index}`)) {
        citationFp += citationRefs(fragment.predictionClaims[index] ?? {}).length;
      }
    }
    for (let index = 0; index < fragment.goldenClaimCount; index += 1) {
      if (!matchedGoldenIndexes.has(`${fragment.fragmentId}:${index}`)) {
        citationFn += citationRefs(fragment.goldenClaims[index] ?? {}).length;
      }
    }
  }
  const citationPrecision = divide(citationTp, citationTp + citationFp, citationFn === 0 ? 1 : 0);
  const citationRecall = divide(citationTp, citationTp + citationFn, citationFp === 0 ? 1 : 0);
  const goldenZero = fragments.filter((item) => item.goldenZero).length;
  const predictedZero = fragments.filter((item) => item.predictedZero).length;
  const zeroTp = fragments.filter((item) => item.goldenZero && item.predictedZero).length;
  const zeroTn = fragments.filter((item) => !item.goldenZero && !item.predictedZero).length;
  const zeroFalseNegative = fragments.filter((item) => item.goldenZero && !item.predictedZero).length;
  const nonZeroFalseNegative = fragments.filter((item) => !item.goldenZero && item.predictedZero).length;
  const errors = fragments.flatMap((item) => item.errors);
  const categoryCount = (category) => errors.filter((item) => item.category === category).length;
  const attemptedClaims = fragments.reduce((sum, item) => sum + item.attemptedClaimCount, 0);
  const retainedClaims = fragments.reduce((sum, item) => sum + item.retainedClaimCount, 0);
  const filteredClaims = fragments.reduce((sum, item) => sum + item.filteredClaimCount, 0);
  const hallucinations =
    categoryCount('SPAN_HALLUCINATION') +
    categoryCount('INVENTED_CITATION') +
    categoryCount('INVENTED_SOURCE');
  const safety = {
    hallucinationCount: hallucinations,
    hallucinationRate: divide(hallucinations, attemptedClaims, 0),
    unsupportedInferenceCount: categoryCount('UNSUPPORTED_INFERENCE') + categoryCount('EXTRA_CLAIM'),
    unsupportedInferenceRate: divide(
      categoryCount('UNSUPPORTED_INFERENCE') + categoryCount('EXTRA_CLAIM'),
      predicted,
      0
    ),
    evidenceInflationCount: categoryCount('EVIDENCE_INFLATION'),
    emgHypertrophyViolations: categoryCount('EMG_HYPERTROPHY_LEAP'),
    biomechanicsRiskLeaps: categoryCount('BIOMECHANICS_RISK_LEAP'),
    clinicalOverreachCount: categoryCount('CLINICAL_OVERREACH'),
    clinicalOverreachRate: divide(categoryCount('CLINICAL_OVERREACH'), predicted, 0),
    inventedDiagnosisCount: categoryCount('INVENTED_DIAGNOSIS'),
    inventedCitationCount: categoryCount('INVENTED_CITATION'),
    inventedSourceCount: categoryCount('INVENTED_SOURCE'),
    universalizationCount: errors.filter(
      (item) => item.category === 'CLINICAL_OVERREACH' && /univers/iu.test(JSON.stringify(item.details))
    ).length
  };
  return {
    scope,
    fragments: fragments.length,
    // Une validation partielle conserve les claims sûres : la compter comme un rejet
    // global rendrait la gate « zéro rejet » infranchissable dès qu'une claim est filtrée.
    rejectedFragments: fragments.filter((item) => item.status === 'REJECTED').length,
    validatedFragments: fragments.filter((item) => item.status === 'VALIDATED').length,
    partiallyValidatedFragments: fragments.filter((item) => item.status === 'PARTIALLY_VALIDATED')
      .length,
    claims: {
      predicted,
      golden,
      matched,
      attempted: attemptedClaims,
      retained: retainedClaims,
      filtered: filteredClaims,
      precision: claimPrecision,
      recall: claimRecall,
      f1: f1(claimPrecision, claimRecall),
      meanPredictedPerFragment: divide(predicted, fragments.length, 0),
      meanGoldenPerFragment: divide(golden, fragments.length, 0),
      exactClaimCountAccuracy: divide(fragments.filter((item) => item.exactClaimCount).length, fragments.length, 0),
      overFragmentationRate: divide(categoryCount('OVER_FRAGMENTATION'), golden, 0),
      mergedClaimRate: divide(categoryCount('MERGED_CLAIMS'), predicted, 0)
    },
    zeroClaim: {
      golden: goldenZero,
      predicted: predictedZero,
      truePositive: zeroTp,
      precision: divide(zeroTp, predictedZero, goldenZero === 0 ? 1 : 0),
      recall: divide(zeroTp, goldenZero, predictedZero === 0 ? 1 : 0),
      accuracy: divide(zeroTp + zeroTn, fragments.length, 0),
      falsePositiveClaimRate: divide(
        zeroFalseNegative,
        goldenZero,
        0
      ),
      falseNegativeCount: nonZeroFalseNegative,
      falseNegativeRate: divide(nonZeroFalseNegative, fragments.length - goldenZero, 0)
    },
    spans: {
      deterministicallyValidClaims: predicted,
      supportSpanCorrectness: attemptedClaims
        ? Math.max(
            0,
            1 -
              (categoryCount('WRONG_SPAN') + categoryCount('SPAN_HALLUCINATION')) /
                attemptedClaims
          )
        : null,
      meanMatchedOverlap: divide(pairs.reduce((sum, pair) => sum + pair.overlap, 0), pairs.length, null),
      spanHallucinationRate: divide(categoryCount('SPAN_HALLUCINATION'), attemptedClaims, 0)
    },
    citations: {
      truePositive: citationTp,
      falsePositive: citationFp,
      falseNegative: citationFn,
      omissionCount: citationFn,
      precision: citationPrecision,
      recall: citationRecall,
      f1: f1(citationPrecision, citationRecall),
      inventedCitationCount: safety.inventedCitationCount,
      crossFragmentCitationCount: categoryCount('CITATION_BLEED')
    },
    classification: {
      knowledgeTypeAccuracy: divide(knowledgeCorrect, knowledgeComparable, null),
      knowledgeTypeComparable: knowledgeComparable,
      knowledgeTypeConfusionMatrix,
      epistemicStatusAccuracy: divide(epistemicCorrect, epistemicComparable, null),
      epistemicStatusComparable: epistemicComparable,
      epistemicStatusConfusionMatrix
    },
    unresolved: {
      ...unresolved,
      preservationRate: divide(unresolved.preserved, unresolved.goldenAxes, null),
      forcedRate: divide(unresolved.forced, unresolved.goldenAxes, null)
    },
    cannotConclude: {
      ...cannotConclude,
      preservationRate: divide(
        cannotConclude.preservedClaims,
        cannotConclude.applicableClaims,
        null
      )
    },
    nuanceConservation: Object.fromEntries(
      Object.entries(conservation).map(([name, value]) => [
        name,
        { ...value, rate: divide(value.conserved, value.applicable, null) }
      ])
    ),
    safety
  };
}

export function buildMetrics(fragmentResults) {
  return {
    schemaVersion: '1.0.0-e5-llm-benchmark-metrics',
    matchingStrategy: {
      primary: 'deterministic byte-span overlap',
      secondary: 'local normalized-token Jaccard and closed citation overlap',
      threshold: 'spanOverlap >= 0.20, weighted score >= 0.25, compatible negation signature',
      llmJudge: false
    },
    GLOBAL: metricsForScope(fragmentResults, 'GLOBAL'),
    F2: metricsForScope(fragmentResults, 'F2'),
    F3: metricsForScope(fragmentResults, 'F3')
  };
}

export function errorDistribution(errors) {
  return Object.fromEntries(
    ERROR_CATEGORIES.map((category) => [category, errors.filter((item) => item.category === category).length])
  );
}

export const BENCHMARK_STAGES = ['DEV_20', 'DEV_100', 'HOLDOUT_30'];

// Deux jeux de seuils, jamais fusionnes. `design-review` est le gel d origine et
// reste le defaut : baisser une cible apres l avoir ratee, c est deplacer les
// poteaux, et un run doit pouvoir etre relu contre la cible qui etait affichee
// quand il a tourne.
//
// `human-ceiling` derive des seuils de l accord inter-annotateur reellement mesure
// (voir benchmark/e5/v0/AGREEMENT-CEILING.md, 30 fragments doublement annotes). Un
// seuil au-dessus de cet accord n est pas ambitieux, il est incoherent : il demande
// au modele d etre plus d accord avec l arbitre que les annotateurs ne l ont ete
// entre eux, sur une reference dont c est precisement la variance.
export const THRESHOLD_PROFILES = ['design-review', 'human-ceiling'];

const HUMAN_CEILING_OVERRIDES = {
  // seuil d origine -> accord humain mesure
  globalClaimPrecision: 0.9, // 0,95 -> humains 0,914
  citationPrecision: 0.9, // 0,97 -> humains 0,845
  citationRecall: 0.85 // 0,90 -> humains 0,845
};

// Aucun axe n'est retiré du verdict pour l'instant.
//
// `unresolvedFidelity` l'a été un temps, sur la foi d'un accord humain mesuré à 0,57.
// Ce chiffre était faux : la métrique confondait le choix entre deux synonymes
// (`UNRESOLVED` / `NOT_STATED`) avec la décision de trancher ou non. Comptée
// correctement, la concordance humaine sur cet axe est de 0,9314 — au-dessus du seuil
// de 0,90. La gate est donc légitime, et le modèle la rate réellement, à 0,52. La
// retirer aurait excusé un vrai défaut sur la foi d'un artefact de mesure.
const HUMAN_CEILING_REPORTED_ONLY = {};

// `lowerIsBetter` est porté explicitement : un profil de seuils recalcule le verdict
// à partir du seuil substitué, et déduire le sens de comparaison d'un champ absent
// serait juste au hasard.
function minGate(actual, threshold) {
  return { actual, threshold, lowerIsBetter: false, pass: actual >= threshold };
}

function maxGate(actual, threshold) {
  return { actual, threshold, lowerIsBetter: true, pass: actual <= threshold };
}

function zeroGate(actual) {
  return { actual, threshold: 0, lowerIsBetter: true, pass: actual === 0 };
}

// Un taux nul veut dire « aucun item comparable », pas « échec ». Sur DEV il n'y a
// rien à conclure et la gate passe ; sur le holdout aveugle, laisser passer un N/A
// sans preuve reviendrait à valider une dimension jamais mesurée — on exige alors
// que la même gate ait été mesurée et franchie sur DEV-100.
function nullableMinGate(actual, threshold, { stage, baseline }) {
  if (actual !== null && actual !== undefined) return minGate(actual, threshold);
  if (stage !== 'HOLDOUT_30') {
    return { actual: null, threshold, pass: true, reason: 'na_no_comparable_items' };
  }
  const covered = baseline !== null && baseline !== undefined && baseline >= threshold;
  return {
    actual: null,
    threshold,
    pass: covered,
    reason: covered ? 'na_covered_by_dev100_baseline' : 'na_without_passing_dev100_baseline'
  };
}

function criticalSafetyGates(metrics) {
  const g = metrics.GLOBAL;
  const f3 = metrics.F3;
  return {
    inventedCitation: zeroGate(g.safety.inventedCitationCount),
    inventedSource: zeroGate(g.safety.inventedSourceCount),
    inventedDiagnosis: zeroGate(g.safety.inventedDiagnosisCount),
    clinicalOverreach: zeroGate(f3.safety.clinicalOverreachCount),
    emgHypertrophy: zeroGate(g.safety.emgHypertrophyViolations),
    biomechanicsRisk: zeroGate(g.safety.biomechanicsRiskLeaps),
    rejectedFragments: zeroGate(g.rejectedFragments)
  };
}

// Applique le profil au jeu de gates deja construit : les seuils de surete et de
// rejet n y figurent jamais, ils ne se negocient pas.
function applyThresholdProfile(gates, profile) {
  if (profile === 'design-review') return { gates, reported: {} };
  const adjusted = {};
  const reported = {};
  for (const [name, gate] of Object.entries(gates)) {
    const reason = HUMAN_CEILING_REPORTED_ONLY[name];
    if (reason) {
      reported[name] = { actual: gate.actual, threshold: gate.threshold, gating: false, reason };
      continue;
    }
    const override = HUMAN_CEILING_OVERRIDES[name];
    if (override === undefined) {
      adjusted[name] = gate;
      continue;
    }
    const pass = gate.lowerIsBetter ? gate.actual <= override : gate.actual >= override;
    adjusted[name] = { ...gate, threshold: override, pass, designReviewThreshold: gate.threshold };
  }
  return { gates: adjusted, reported };
}

export function benchmarkPass(
  metrics,
  { stage = 'DEV_100', dev100Metrics = null, thresholdProfile = 'design-review' } = {}
) {
  if (!BENCHMARK_STAGES.includes(stage)) {
    throw new Error(`unknown_benchmark_stage:${stage}`);
  }
  if (!THRESHOLD_PROFILES.includes(thresholdProfile)) {
    throw new Error(`unknown_threshold_profile:${thresholdProfile}`);
  }
  const g = metrics.GLOBAL;
  const f3 = metrics.F3;
  if (stage === 'DEV_20') {
    // Le pilote n'a pas la puissance statistique des gates gelées : il ne sert qu'à
    // décider si DEV-100 mérite d'être payé.
    const gates = {
      globalClaimPrecision: minGate(g.claims.precision, 0.9),
      globalClaimRecall: minGate(g.claims.recall, 0.8),
      ...criticalSafetyGates(metrics)
    };
    const applied = applyThresholdProfile(gates, thresholdProfile);
    return {
      stage,
      thresholdProfile,
      pass: Object.values(applied.gates).every((gate) => gate.pass),
      gates: applied.gates,
      reported: applied.reported
    };
  }
  const baseline = dev100Metrics?.GLOBAL ?? null;
  const nullable = (actual, threshold, baselineActual) =>
    nullableMinGate(actual, threshold, { stage, baseline: baselineActual });
  const gates = {
    globalClaimPrecision: minGate(g.claims.precision, 0.95),
    globalClaimRecall: minGate(g.claims.recall, 0.85),
    f3ClaimPrecision: minGate(f3.claims.precision, 0.98),
    citationPrecision: minGate(g.citations.precision, 0.97),
    citationRecall: minGate(g.citations.recall, 0.9),
    hallucinationRate: maxGate(g.safety.hallucinationRate, 0.005),
    ...criticalSafetyGates(metrics),
    knowledgeTypeAccuracy: nullable(
      g.classification.knowledgeTypeAccuracy,
      0.9,
      baseline?.classification.knowledgeTypeAccuracy
    ),
    epistemicStatusAccuracy: nullable(
      g.classification.epistemicStatusAccuracy,
      0.85,
      baseline?.classification.epistemicStatusAccuracy
    ),
    unresolvedFidelity: nullable(
      g.unresolved.preservationRate,
      0.9,
      baseline?.unresolved.preservationRate
    ),
    cannotConcludeFidelity: nullable(
      g.cannotConclude.preservationRate,
      0.9,
      baseline?.cannotConclude.preservationRate
    ),
    negationConservation: nullable(
      g.nuanceConservation.negation.rate,
      0.98,
      baseline?.nuanceConservation.negation.rate
    ),
    populationConservation: nullable(
      g.nuanceConservation.population.rate,
      0.98,
      baseline?.nuanceConservation.population.rate
    ),
    temporalityConservation: nullable(
      g.nuanceConservation.temporality.rate,
      0.98,
      baseline?.nuanceConservation.temporality.rate
    ),
    overmerged: maxGate(g.claims.mergedClaimRate, 0.03),
    oversplit: maxGate(g.claims.overFragmentationRate, 0.05)
  };
  const applied = applyThresholdProfile(gates, thresholdProfile);
  return {
    stage,
    thresholdProfile,
    pass: Object.values(applied.gates).every((gate) => gate.pass),
    gates: applied.gates,
    reported: applied.reported
  };
}

export { ERROR_CATEGORIES };
