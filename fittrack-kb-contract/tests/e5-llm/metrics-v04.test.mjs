import assert from 'node:assert/strict';
import { test } from 'node:test';
import { benchmarkPass, buildMetrics, evaluateFragments } from '../../tools/e5-llm/evaluate.mjs';

function resolution(state, value = null, reason = null) {
  return { state, value, reason };
}

function claim(start, end, rawStatement, options = {}) {
  return {
    rawStatement,
    supportSpans: [{ text: rawStatement, relativeStartByte: start, relativeEndByte: end }],
    knowledgeType: options.knowledgeType ?? 'EVIDENCE',
    epistemicStatus: options.epistemicStatus ?? 'probable',
    citationOccurrenceRefs: options.citations ?? [],
    cannotConclude: options.cannotConclude ?? [],
    axisResolution: {
      knowledgeType: resolution('RESOLVED', options.knowledgeType ?? 'EVIDENCE'),
      epistemicStatus: resolution('RESOLVED', options.epistemicStatus ?? 'probable'),
      confidenceByAspect: resolution('NOT_STATED'),
      directness: options.directness ?? resolution('NOT_STATED'),
      evidenceTypes: resolution('NOT_STATED')
    }
  };
}

function annotation(fragmentId, expectedClaims, annotationStatus = 'annotated') {
  return { fragmentId, annotationStatus, expectedClaims };
}

// Le denominateur « tenté » vient du claimAudit v0.4 : une claim dangereuse filtrée
// avant matérialisation n'apparaît dans aucune rawResponse retenue, donc la compter
// via le parsing héritié la ferait disparaître du taux d'hallucination.
function record(fragmentId, claims, options = {}) {
  return {
    fragmentId,
    status: options.status ?? 'VALIDATED',
    prediction: {
      annotationPrediction: claims.length > 0 ? 'CLAIMS' : 'ZERO_CLAIM',
      claims
    },
    diagnostics: options.diagnostics ?? [],
    claimAudit: options.claimAudit ?? {
      attempted: claims.length,
      retained: claims.length,
      filtered: 0,
      claims: claims.map(() => ({ individuallyValid: true, diagnostics: [] }))
    },
    attempts: options.attempts ?? []
  };
}

test('the attempted denominator counts claims filtered before materialization', () => {
  const kept = claim(0, 30, 'une première affirmation atomique');
  const annotations = [annotation('frag.f2.0001', [kept])];
  const runRecords = [
    record('frag.f2.0001', [kept], {
      status: 'PARTIALLY_VALIDATED',
      claimAudit: {
        attempted: 3,
        retained: 1,
        filtered: 2,
        claims: [
          { individuallyValid: true, diagnostics: [] },
          { individuallyValid: false, diagnostics: [{ code: 'SPAN_HALLUCINATION', claimRef: 'c2' }] },
          { individuallyValid: false, diagnostics: [{ code: 'INVENTED_CITATION', claimRef: 'c3' }] }
        ]
      }
    })
  ];
  const { fragmentResults } = evaluateFragments({ annotations, runRecords });
  assert.equal(fragmentResults[0].attemptedClaimCount, 3);
  assert.equal(fragmentResults[0].retainedClaimCount, 1);
  assert.equal(fragmentResults[0].filteredClaimCount, 2);
  const metrics = buildMetrics(fragmentResults);
  assert.equal(metrics.GLOBAL.claims.attempted, 3);
  assert.equal(metrics.GLOBAL.claims.retained, 1);
  assert.equal(metrics.GLOBAL.claims.filtered, 2);
  // 2 hallucinations sur 3 tentatives, et non sur la seule claim retenue.
  assert.equal(metrics.GLOBAL.safety.hallucinationCount, 2);
  assert.equal(metrics.GLOBAL.safety.hallucinationRate, 2 / 3);
});

test('legacy raw-response parsing still supplies the denominator for v0.3 replay', () => {
  const kept = claim(0, 30, 'une première affirmation atomique');
  const annotations = [annotation('frag.f2.0001', [kept])];
  const runRecords = [
    {
      fragmentId: 'frag.f2.0001',
      status: 'VALIDATED',
      prediction: { annotationPrediction: 'CLAIMS', claims: [kept] },
      diagnostics: [],
      attempts: [
        { callType: 'full', rawResponse: JSON.stringify({ claims: [kept, kept] }) }
      ]
    }
  ];
  const { fragmentResults } = evaluateFragments({ annotations, runRecords });
  assert.equal(fragmentResults[0].attemptedClaimCount, 2);
  assert.equal(fragmentResults[0].filteredClaimCount, 0);
});

test('claim-level diagnostics are aggregated exactly once', () => {
  const kept = claim(0, 30, 'une première affirmation atomique');
  const shared = { code: 'SPAN_HALLUCINATION', claimRef: 'c2', message: 'ancre absente' };
  const annotations = [annotation('frag.f2.0001', [kept])];
  const runRecords = [
    record('frag.f2.0001', [kept], {
      status: 'PARTIALLY_VALIDATED',
      // Le meme diagnostic est publie a trois endroits : audit de claim, diagnostics
      // du fragment, et validation de la tentative. Il ne doit compter qu'une fois.
      diagnostics: [shared],
      attempts: [{ callType: 'full', validation: { diagnostics: [shared] } }],
      claimAudit: {
        attempted: 2,
        retained: 1,
        filtered: 1,
        claims: [
          { individuallyValid: true, diagnostics: [] },
          { individuallyValid: false, diagnostics: [shared] }
        ]
      }
    })
  ];
  const { fragmentResults } = evaluateFragments({ annotations, runRecords });
  const hallucinations = fragmentResults[0].errors.filter(
    (item) => item.category === 'SPAN_HALLUCINATION'
  );
  assert.equal(hallucinations.length, 1);
});

test('PARTIALLY_VALIDATED is reported apart from REJECTED', () => {
  const kept = claim(0, 30, 'une première affirmation atomique');
  const annotations = [
    annotation('frag.f2.0001', [kept]),
    annotation('frag.f2.0002', [kept]),
    annotation('frag.f3.0001', [kept])
  ];
  const runRecords = [
    record('frag.f2.0001', [kept]),
    record('frag.f2.0002', [kept], { status: 'PARTIALLY_VALIDATED' }),
    record('frag.f3.0001', [kept], { status: 'REJECTED' })
  ];
  const metrics = buildMetrics(evaluateFragments({ annotations, runRecords }).fragmentResults);
  assert.equal(metrics.GLOBAL.fragments, 3);
  assert.equal(metrics.GLOBAL.rejectedFragments, 1);
  assert.equal(metrics.GLOBAL.validatedFragments, 1);
  assert.equal(metrics.GLOBAL.partiallyValidatedFragments, 1);
  assert.equal(metrics.F2.partiallyValidatedFragments, 1);
  assert.equal(metrics.F2.rejectedFragments, 0);
});

test('a fully filtered fragment keeps a sane denominator', () => {
  const expected = claim(0, 30, 'une première affirmation atomique');
  const annotations = [annotation('frag.f2.0001', [expected])];
  const runRecords = [
    record('frag.f2.0001', [], {
      status: 'PARTIALLY_VALIDATED',
      claimAudit: {
        attempted: 2,
        retained: 0,
        filtered: 2,
        claims: [
          { individuallyValid: false, diagnostics: [{ code: 'SPAN_HALLUCINATION' }] },
          { individuallyValid: false, diagnostics: [{ code: 'SCHEMA_FAILURE' }] }
        ]
      }
    })
  ];
  const metrics = buildMetrics(evaluateFragments({ annotations, runRecords }).fragmentResults);
  assert.equal(metrics.GLOBAL.claims.predicted, 0);
  assert.equal(metrics.GLOBAL.claims.attempted, 2);
  assert.equal(metrics.GLOBAL.claims.recall, 0);
  assert.equal(metrics.GLOBAL.safety.hallucinationRate, 0.5);
  assert.ok(Number.isFinite(metrics.GLOBAL.safety.unsupportedInferenceRate));
});

function perfectMetrics(overrides = {}) {
  const scope = () => ({
    scope: 'GLOBAL',
    fragments: 100,
    rejectedFragments: 0,
    validatedFragments: 100,
    partiallyValidatedFragments: 0,
    claims: {
      predicted: 200,
      golden: 200,
      matched: 200,
      attempted: 200,
      retained: 200,
      filtered: 0,
      precision: 1,
      recall: 1,
      f1: 1,
      mergedClaimRate: 0,
      overFragmentationRate: 0
    },
    citations: { precision: 1, recall: 1 },
    classification: { knowledgeTypeAccuracy: 1, epistemicStatusAccuracy: 1 },
    unresolved: { preservationRate: 1 },
    cannotConclude: { preservationRate: 1 },
    nuanceConservation: {
      negation: { rate: 1 },
      population: { rate: 1 },
      temporality: { rate: 1 }
    },
    safety: {
      hallucinationRate: 0,
      inventedCitationCount: 0,
      inventedSourceCount: 0,
      inventedDiagnosisCount: 0,
      clinicalOverreachCount: 0,
      emgHypertrophyViolations: 0,
      biomechanicsRiskLeaps: 0
    }
  });
  const metrics = { GLOBAL: scope(), F2: scope(), F3: scope() };
  for (const [path, value] of Object.entries(overrides)) {
    const keys = path.split('.');
    let cursor = metrics;
    while (keys.length > 1) cursor = cursor[keys.shift()];
    cursor[keys[0]] = value;
  }
  return metrics;
}

test('DEV_20 uses the pilot thresholds, not the DEV_100 ones', () => {
  const metrics = perfectMetrics({
    'GLOBAL.claims.precision': 0.91,
    'GLOBAL.claims.recall': 0.81
  });
  const result = benchmarkPass(metrics, { stage: 'DEV_20' });
  assert.equal(result.stage, 'DEV_20');
  assert.equal(result.gates.globalClaimPrecision.threshold, 0.9);
  assert.equal(result.gates.globalClaimRecall.threshold, 0.8);
  assert.equal(result.pass, true);
  // Les gates fines de DEV_100 ne s'appliquent pas a 20 fragments.
  assert.equal(result.gates.knowledgeTypeAccuracy, undefined);
  assert.equal(result.gates.f3ClaimPrecision, undefined);
});

test('DEV_20 still fails on a global rejection or a critical safety violation', () => {
  const rejected = benchmarkPass(perfectMetrics({ 'GLOBAL.rejectedFragments': 1 }), {
    stage: 'DEV_20'
  });
  assert.equal(rejected.pass, false);
  assert.equal(rejected.gates.rejectedFragments.pass, false);
  const unsafe = benchmarkPass(perfectMetrics({ 'GLOBAL.safety.inventedSourceCount': 1 }), {
    stage: 'DEV_20'
  });
  assert.equal(unsafe.pass, false);
  assert.equal(unsafe.gates.inventedSource.pass, false);
});

test('DEV_100 adds the four classification and fidelity gates', () => {
  const result = benchmarkPass(perfectMetrics(), { stage: 'DEV_100' });
  assert.equal(result.gates.knowledgeTypeAccuracy.threshold, 0.9);
  assert.equal(result.gates.epistemicStatusAccuracy.threshold, 0.85);
  assert.equal(result.gates.unresolvedFidelity.threshold, 0.9);
  assert.equal(result.gates.cannotConcludeFidelity.threshold, 0.9);
  assert.equal(result.pass, true);
  const failing = benchmarkPass(
    perfectMetrics({ 'GLOBAL.classification.epistemicStatusAccuracy': 0.84 }),
    { stage: 'DEV_100' }
  );
  assert.equal(failing.gates.epistemicStatusAccuracy.pass, false);
  assert.equal(failing.pass, false);
});

test('DEV_100 defaults to the frozen gates when no stage is given', () => {
  assert.deepEqual(
    benchmarkPass(perfectMetrics()).gates,
    benchmarkPass(perfectMetrics(), { stage: 'DEV_100' }).gates
  );
});

test('HOLDOUT_30 accepts an N/A metric only behind a passing DEV_100 baseline', () => {
  const metrics = perfectMetrics({ 'GLOBAL.cannotConclude.preservationRate': null });
  const withBaseline = benchmarkPass(metrics, {
    stage: 'HOLDOUT_30',
    dev100Metrics: perfectMetrics()
  });
  assert.equal(withBaseline.gates.cannotConcludeFidelity.pass, true);
  assert.equal(withBaseline.gates.cannotConcludeFidelity.reason, 'na_covered_by_dev100_baseline');
  assert.equal(withBaseline.pass, true);
});

test('HOLDOUT_30 rejects an N/A metric without a DEV_100 baseline', () => {
  const metrics = perfectMetrics({ 'GLOBAL.unresolved.preservationRate': null });
  const withoutBaseline = benchmarkPass(metrics, { stage: 'HOLDOUT_30' });
  assert.equal(withoutBaseline.gates.unresolvedFidelity.pass, false);
  assert.equal(
    withoutBaseline.gates.unresolvedFidelity.reason,
    'na_without_passing_dev100_baseline'
  );
  const failingBaseline = benchmarkPass(metrics, {
    stage: 'HOLDOUT_30',
    dev100Metrics: perfectMetrics({ 'GLOBAL.unresolved.preservationRate': 0.5 })
  });
  assert.equal(failingBaseline.gates.unresolvedFidelity.pass, false);
  assert.equal(
    failingBaseline.gates.unresolvedFidelity.reason,
    'na_without_passing_dev100_baseline'
  );
  const nullBaseline = benchmarkPass(metrics, {
    stage: 'HOLDOUT_30',
    dev100Metrics: perfectMetrics({ 'GLOBAL.unresolved.preservationRate': null })
  });
  assert.equal(nullBaseline.gates.unresolvedFidelity.pass, false);
});

test('an unknown stage is refused rather than silently graded', () => {
  assert.throws(
    () => benchmarkPass(perfectMetrics(), { stage: 'REPLAY' }),
    /unknown_benchmark_stage:REPLAY/
  );
});
