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

function attemptedClaimCount(runRecord) {
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
      for (const axis of ['knowledgeType', 'epistemicStatus', 'confidenceByAspect', 'directness', 'evidenceTypes']) {
        if (
          golden.axisResolution[axis]?.state === 'UNRESOLVED' &&
          prediction.axisResolution[axis]?.state === 'RESOLVED'
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
    const auditDiagnostics = [
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
      attemptedClaimCount: attemptedClaimCount(record),
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
  const unresolved = { goldenAxes: 0, preserved: 0, forced: 0 };
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
    }
    if (pair.golden.epistemicStatus !== undefined) {
      epistemicComparable += 1;
      if (pair.prediction.epistemicStatus === pair.golden.epistemicStatus) epistemicCorrect += 1;
    }
    for (const axis of ['knowledgeType', 'epistemicStatus', 'confidenceByAspect', 'directness', 'evidenceTypes']) {
      if (pair.golden.axisResolution[axis]?.state !== 'UNRESOLVED') continue;
      unresolved.goldenAxes += 1;
      if (pair.prediction.axisResolution[axis]?.state === 'UNRESOLVED') unresolved.preserved += 1;
      if (pair.prediction.axisResolution[axis]?.state === 'RESOLVED') unresolved.forced += 1;
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
  const errors = fragments.flatMap((item) => item.errors);
  const categoryCount = (category) => errors.filter((item) => item.category === category).length;
  const attemptedClaims = fragments.reduce((sum, item) => sum + item.attemptedClaimCount, 0);
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
    rejectedFragments: fragments.filter((item) => item.status === 'REJECTED').length,
    claims: {
      predicted,
      golden,
      matched,
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
        fragments.filter((item) => item.goldenZero && !item.predictedZero).length,
        goldenZero,
        0
      )
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
      precision: citationPrecision,
      recall: citationRecall,
      f1: f1(citationPrecision, citationRecall),
      inventedCitationCount: safety.inventedCitationCount,
      crossFragmentCitationCount: categoryCount('CITATION_BLEED')
    },
    classification: {
      knowledgeTypeAccuracy: divide(knowledgeCorrect, knowledgeComparable, null),
      knowledgeTypeComparable: knowledgeComparable,
      epistemicStatusAccuracy: divide(epistemicCorrect, epistemicComparable, null),
      epistemicStatusComparable: epistemicComparable
    },
    unresolved: {
      ...unresolved,
      preservationRate: divide(unresolved.preserved, unresolved.goldenAxes, null),
      forcedRate: divide(unresolved.forced, unresolved.goldenAxes, null)
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

export function benchmarkPass(metrics) {
  const g = metrics.GLOBAL;
  const f3 = metrics.F3;
  const gates = {
    globalClaimPrecision: { actual: g.claims.precision, threshold: 0.95, pass: g.claims.precision >= 0.95 },
    globalClaimRecall: { actual: g.claims.recall, threshold: 0.85, pass: g.claims.recall >= 0.85 },
    f3ClaimPrecision: { actual: f3.claims.precision, threshold: 0.98, pass: f3.claims.precision >= 0.98 },
    citationPrecision: { actual: g.citations.precision, threshold: 0.97, pass: g.citations.precision >= 0.97 },
    citationRecall: { actual: g.citations.recall, threshold: 0.9, pass: g.citations.recall >= 0.9 },
    hallucinationRate: { actual: g.safety.hallucinationRate, threshold: 0.005, pass: g.safety.hallucinationRate <= 0.005 },
    inventedCitation: { actual: g.safety.inventedCitationCount, threshold: 0, pass: g.safety.inventedCitationCount === 0 },
    inventedSource: { actual: g.safety.inventedSourceCount, threshold: 0, pass: g.safety.inventedSourceCount === 0 },
    inventedDiagnosis: { actual: g.safety.inventedDiagnosisCount, threshold: 0, pass: g.safety.inventedDiagnosisCount === 0 },
    clinicalOverreach: { actual: f3.safety.clinicalOverreachCount, threshold: 0, pass: f3.safety.clinicalOverreachCount === 0 },
    emgHypertrophy: { actual: g.safety.emgHypertrophyViolations, threshold: 0, pass: g.safety.emgHypertrophyViolations === 0 },
    biomechanicsRisk: { actual: g.safety.biomechanicsRiskLeaps, threshold: 0, pass: g.safety.biomechanicsRiskLeaps === 0 },
    negationConservation: { actual: g.nuanceConservation.negation.rate, threshold: 0.98, pass: (g.nuanceConservation.negation.rate ?? 1) >= 0.98 },
    populationConservation: { actual: g.nuanceConservation.population.rate, threshold: 0.98, pass: (g.nuanceConservation.population.rate ?? 1) >= 0.98 },
    temporalityConservation: { actual: g.nuanceConservation.temporality.rate, threshold: 0.98, pass: (g.nuanceConservation.temporality.rate ?? 1) >= 0.98 },
    overmerged: { actual: g.claims.mergedClaimRate, threshold: 0.03, pass: g.claims.mergedClaimRate <= 0.03 },
    oversplit: { actual: g.claims.overFragmentationRate, threshold: 0.05, pass: g.claims.overFragmentationRate <= 0.05 },
    rejectedFragments: { actual: g.rejectedFragments, threshold: 0, pass: g.rejectedFragments === 0 }
  };
  return { pass: Object.values(gates).every((gate) => gate.pass), gates };
}

export { ERROR_CATEGORIES };
