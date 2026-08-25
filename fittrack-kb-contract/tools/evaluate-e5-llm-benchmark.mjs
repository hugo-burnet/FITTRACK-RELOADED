#!/usr/bin/env node
// Cette phase est volontairement séparée de la génération. Elle seule ouvre le GOLD,
// après que toutes les prédictions ont été matérialisées.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  benchmarkPass,
  buildMetrics,
  errorDistribution,
  evaluateFragments
} from './e5-llm/evaluate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const benchmarkRoot = join(root, 'benchmark/e5/v0');
const defaultOutputRoot = join(benchmarkRoot, 'runs', 'openrouter-openai-gpt-5');

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function fmt(value) {
  return value === null || value === undefined ? 'n/a' : value.toFixed(4);
}

function exampleLine(item) {
  const categories = [...new Set(item.errors.map((error) => error.category))].join(', ') || 'none';
  const prediction = item.predictionClaims?.[0]?.rawStatement?.replace(/\s+/g, ' ').slice(0, 140) ?? 'ZERO_CLAIM';
  const golden = item.goldenClaims?.[0]?.rawStatement?.replace(/\s+/g, ' ').slice(0, 140) ?? 'ZERO_CLAIM';
  return `- ${item.fragmentId}: F1=${fmt(item.f1)}, predicted=${item.predictedClaimCount}, golden=${item.goldenClaimCount}, errors=${categories}\n  - prediction: ${prediction}\n  - GOLD: ${golden}`;
}

function qualitativeSamples(fragmentResults) {
  const ordered = [...fragmentResults].sort(
    (left, right) =>
      (right.f1 ?? -1) - (left.f1 ?? -1) || left.errors.length - right.errors.length || left.fragmentId.localeCompare(right.fragmentId)
  );
  const worst = [...ordered].reverse();
  const granularFailures = fragmentResults
    .filter((item) => item.errors.some((e) => ['MERGED_CLAIMS', 'OVER_FRAGMENTATION'].includes(e.category)))
    .sort((a, b) => b.errors.length - a.errors.length);
  const granularFallback = fragmentResults
    .filter((item) => item.goldenClaimCount >= 2 || item.predictedClaimCount >= 2)
    .sort((a, b) => b.goldenClaimCount - a.goldenClaimCount || b.predictedClaimCount - a.predictedClaimCount);
  const granular = [...new Map([...granularFailures, ...granularFallback].map((item) => [item.fragmentId, item])).values()].slice(0, 5);
  const citationFailures = fragmentResults
    .filter((item) => item.errors.some((e) => ['WRONG_CITATION', 'CITATION_BLEED', 'INVENTED_CITATION'].includes(e.category)))
    .sort((a, b) => b.errors.length - a.errors.length);
  const citationFallback = fragmentResults.filter((item) =>
    [...(item.predictionClaims ?? []), ...(item.goldenClaims ?? [])].some(
      (claim) => (claim.citationOccurrenceRefs ?? claim.citationOccurrenceIds ?? []).length > 0
    )
  );
  const citations = [...new Map([...citationFailures, ...citationFallback].map((item) => [item.fragmentId, item])).values()].slice(0, 5);
  const clinical = worst.filter((item) => item.corpus === 'F3').slice(0, 5);
  const safety = fragmentResults.filter((item) =>
    item.errors.some((e) =>
      [
        'SPAN_HALLUCINATION',
        'INVENTED_CITATION',
        'INVENTED_SOURCE',
        'EVIDENCE_INFLATION',
        'EMG_HYPERTROPHY_LEAP',
        'BIOMECHANICS_RISK_LEAP',
        'CLINICAL_OVERREACH',
        'INVENTED_DIAGNOSIS'
      ].includes(e.category)
    )
  );
  return { best: ordered.slice(0, 5), worst: worst.slice(0, 5), granular, citations, clinical, safety };
}

function auditSummary(runRecords, fragmentResults, errors, config, metrics) {
  const repairRecords = runRecords.filter((record) =>
    record.attempts.some((attempt) => attempt.callType === 'repair')
  );
  const repairReasons = {};
  for (const record of repairRecords) {
    const full = record.attempts.find((attempt) => attempt.callType === 'full');
    for (const diagnostic of full?.validation?.diagnostics ?? []) {
      repairReasons[diagnostic.code] = (repairReasons[diagnostic.code] ?? 0) + 1;
    }
  }
  const rejectionReasons = {};
  for (const record of runRecords.filter((item) => item.status === 'REJECTED')) {
    for (const diagnostic of record.diagnostics) {
      rejectionReasons[diagnostic.code] = (rejectionReasons[diagnostic.code] ?? 0) + 1;
    }
  }
  const partialAudits = runRecords
    .filter((record) => record.status === 'REJECTED' && record.partialAudit)
    .map((record) => ({ fragmentId: record.fragmentId, ...record.partialAudit }));
  const providerClaims = [];
  for (const record of runRecords) {
    const full = record.attempts.find((attempt) => attempt.callType === 'full');
    try {
      const parsed = JSON.parse(full?.rawResponse ?? '');
      const prompt = JSON.parse(full?.promptInput ?? '{}');
      const fragmentText = prompt.fragment?.rawText ?? '';
      for (const claim of parsed.claims ?? []) {
        providerClaims.push({ fragmentId: record.fragmentId, fragmentText, claim });
      }
    } catch {
      // Invalid JSON is already represented in diagnostics.
    }
  }
  const productPolicyClaims = providerClaims.filter(({ claim }) =>
    ['PRODUCT_POLICY', 'MODELING_DECISION'].includes(claim.knowledgeType)
  );
  const causalPattern = /\b(?:caus\w*|provoqu\w*|entra[îi]ne\w*|responsable de)\b/iu;
  const causalityInventions = fragmentResults.flatMap((fragment) =>
    fragment.pairs.filter(
      (pair) =>
        causalPattern.test(pair.prediction.rawStatement) &&
        !causalPattern.test(pair.golden.rawStatement)
    ).map((pair) => ({ fragmentId: fragment.fragmentId, claim: pair.prediction.rawStatement }))
  );
  const referralPattern = /\b(?:consulter|consultation|médecin|professionnel de santé|urgence|référer|orienter)\b/iu;
  const inventedReferrals = providerClaims.filter(({ claim, fragmentText }) => {
    const freeText = JSON.stringify({
      conditions: claim.conditions,
      limitations: claim.limitations,
      cannotConclude: claim.cannotConclude,
      unresolved: claim.unresolved,
      knowledgeTypeReason: claim.knowledgeTypeReason,
      epistemicStatusReason: claim.epistemicStatusReason,
      directnessReason: claim.directnessReason,
      evidenceTypesReason: claim.evidenceTypesReason
    });
    const match = freeText.match(referralPattern)?.[0];
    return Boolean(match) && !fragmentText.toLocaleLowerCase('fr').includes(match.toLocaleLowerCase('fr'));
  });
  const coverageByCode = {};
  let coverageFragments = 0;
  let coverageDiagnostics = 0;
  for (const item of runRecords) {
    const diagnostics = item.coverageAudit?.diagnostics ?? [];
    if (diagnostics.length > 0) coverageFragments += 1;
    coverageDiagnostics += diagnostics.length;
    for (const entry of diagnostics) {
      coverageByCode[entry.code] = (coverageByCode[entry.code] ?? 0) + 1;
    }
  }
  const claimAuditTotals = runRecords.reduce(
    (totals, item) => ({
      attempted: totals.attempted + (item.claimAudit?.attempted ?? 0),
      retained: totals.retained + (item.claimAudit?.retained ?? 0),
      filtered: totals.filtered + (item.claimAudit?.filtered ?? 0)
    }),
    { attempted: 0, retained: 0, filtered: 0 }
  );
  const usage = config.summary.usageByCallType;
  const completedFragments = config.summary.fragmentCount;
  const totalCostUsd = usage.total.costUsd;
  return {
    statuses: {
      validated: runRecords.filter((item) => item.status === 'VALIDATED').length,
      partiallyValidated: runRecords.filter((item) => item.status === 'PARTIALLY_VALIDATED').length,
      rejected: runRecords.filter((item) => item.status === 'REJECTED').length
    },
    claimAudit: claimAuditTotals,
    coverage: {
      fragmentsWithDiagnostics: coverageFragments,
      diagnosticCount: coverageDiagnostics,
      byCode: coverageByCode
    },
    partialRejections: {
      fragmentsWithIndividuallyValidClaims: partialAudits.filter(
        (item) => item.individuallyValidClaimCount > 0
      ).length,
      individuallyValidClaimsInsideRejectedFragments: partialAudits.reduce(
        (sum, item) => sum + item.individuallyValidClaimCount,
        0
      ),
      individuallyInvalidClaimsInsideRejectedFragments: partialAudits.reduce(
        (sum, item) => sum + item.individuallyInvalidClaimCount,
        0
      ),
      fragments: partialAudits
    },
    repairs: {
      calls: usage.repair.calls,
      ratePerFullCall: usage.full.calls ? usage.repair.calls / usage.full.calls : 0,
      successfulFragments: repairRecords.filter((record) => record.status === 'VALIDATED').length,
      successRate: repairRecords.length
        ? repairRecords.filter((record) => record.status === 'VALIDATED').length / repairRecords.length
        : null,
      reasons: repairReasons
    },
    rejectionReasons,
    safetyExtensions: {
      productPolicyIncorrectlyExtracted: productPolicyClaims.length,
      inventedCausality: causalityInventions.length,
      populationGeneralization:
        (metrics.GLOBAL.nuanceConservation.population.applicable ?? 0) -
        (metrics.GLOBAL.nuanceConservation.population.conserved ?? 0),
      inventedReferral: inventedReferrals.length
    },
    cost: {
      fullUsd: usage.full.costUsd,
      repairUsd: usage.repair.costUsd,
      totalUsd: totalCostUsd,
      meanPerCompletedFragmentUsd: completedFragments ? totalCostUsd / completedFragments : null,
      projected207Usd: completedFragments ? (totalCostUsd / completedFragments) * 207 : null,
      fullInputTokens: usage.full.inputTokens,
      fullOutputTokens: usage.full.outputTokens,
      fullReasoningTokens: usage.full.reasoningTokens,
      repairInputTokens: usage.repair.inputTokens,
      repairOutputTokens: usage.repair.outputTokens,
      repairReasoningTokens: usage.repair.reasoningTokens
    },
    errorsByCategory: errorDistribution(errors)
  };
}

function reportMarkdown(config, metrics, errors, passResult, samples, audit) {
  const sections = ['GLOBAL', 'F2', 'F3']
    .map((scope) => {
      const item = metrics[scope];
      const rows = [
        ['Claims attempted', item.claims.attempted, 'count'],
        ['Claims retained', item.claims.retained, 'count'],
        ['Claims filtered', item.claims.filtered, 'count'],
        ['Fragments validated', item.validatedFragments, 'count'],
        ['Fragments partially validated', item.partiallyValidatedFragments, 'count'],
        ['Fragments globally rejected', item.rejectedFragments, 'count'],
        ['Claim precision', item.claims.precision],
        ['Claim recall', item.claims.recall],
        ['Claim F1', item.claims.f1],
        ['Mean claims predicted', item.claims.meanPredictedPerFragment],
        ['Mean claims GOLD', item.claims.meanGoldenPerFragment],
        ['Exact claim-count accuracy', item.claims.exactClaimCountAccuracy],
        ['Over-fragmentation rate', item.claims.overFragmentationRate],
        ['Merged-claim rate', item.claims.mergedClaimRate],
        ['ZERO_CLAIM precision', item.zeroClaim.precision],
        ['ZERO_CLAIM recall', item.zeroClaim.recall],
        ['ZERO_CLAIM accuracy', item.zeroClaim.accuracy],
        ['ZERO_CLAIM false-positive claim rate', item.zeroClaim.falsePositiveClaimRate],
        ['ZERO_CLAIM false-negative rate', item.zeroClaim.falseNegativeRate],
        ['Support span correctness', item.spans.supportSpanCorrectness],
        ['Mean span overlap', item.spans.meanMatchedOverlap],
        ['Span hallucination rate', item.spans.spanHallucinationRate],
        ['Citation precision', item.citations.precision],
        ['Citation recall', item.citations.recall],
        ['Citation F1', item.citations.f1],
        ['knowledgeType accuracy', item.classification.knowledgeTypeAccuracy],
        ['epistemicStatus accuracy', item.classification.epistemicStatusAccuracy],
        ['UNRESOLVED preservation', item.unresolved.preservationRate],
        ['UNRESOLVED forced rate', item.unresolved.forcedRate],
        ['cannotConclude fidelity', item.cannotConclude.preservationRate]
      ];
      return `### ${scope}\n\n| Metric | Value |\n|---|---:|\n${rows
        .map(([name, value, kind]) => `| ${name} | ${kind === 'count' ? value ?? 'n/a' : fmt(value)} |`)
        .join('\n')}`;
    })
    .join('\n\n');
  const distribution = Object.entries(errorDistribution(errors))
    .map(([category, count]) => `| ${category} | ${count} |`)
    .join('\n');
  const gates = Object.entries(passResult.gates)
    .map(
      ([name, gate]) =>
        `| ${name} | ${gate.actual ?? 'n/a'} | ${gate.threshold} | ${gate.pass ? 'PASS' : 'FAIL'} | ${gate.reason ?? ''} |`
    )
    .join('\n');
  const list = (items) => (items.length ? items.map(exampleLine).join('\n') : '- Aucun cas.')
  const usage = config.summary?.usageByCallType ?? {};
  return `# E5-LLM — ${passResult.stage}\n\n## Run\n\n- Stage: \`${passResult.stage}\`${passResult.replay ? ' (replay)' : ''}\n- Run ID: \`${config.runId}\`\n- Code commit: \`${config.codeCommit}\`\n- Provider/model/reasoning: \`${config.provider}\` / \`${config.model}\` / \`${config.reasoningEffort}\`\n- Prompt: \`${config.promptVersion}\` (\`${config.promptHash}\`)\n- Provider DTO: \`${config.providerDtoVersion}\`\n- Fragments attempted/validated/rejected: ${config.summary.fragmentCount} / ${config.summary.validated} / ${config.summary.rejected}\n- Full retries: ${config.maxFullRetries}; targeted anchor repairs: ${config.maxAnchorRepairRetries}\n- Golden commit: \`${config.goldenCommit}\`\n- Corpus commit: \`${config.corpusCommit}\`\n\n## Metrics\n\n${sections}\n\n## Repairs\n\n- Full calls: ${usage.full?.calls ?? 'n/a'}\n- Repair calls: ${audit.repairs.calls}\n- Repair rate: ${fmt(audit.repairs.ratePerFullCall)}\n- Successful fragments after repair: ${audit.repairs.successfulFragments}\n- Repair success rate: ${fmt(audit.repairs.successRate)}\n- Repair reasons: ${JSON.stringify(audit.repairs.reasons)}\n\n## Cost\n\n- Full input/output/reasoning tokens: ${audit.cost.fullInputTokens} / ${audit.cost.fullOutputTokens} / ${audit.cost.fullReasoningTokens}\n- Repair input/output/reasoning tokens: ${audit.cost.repairInputTokens} / ${audit.cost.repairOutputTokens} / ${audit.cost.repairReasoningTokens}\n- Full/repair/total cost: $${audit.cost.fullUsd} / $${audit.cost.repairUsd} / $${audit.cost.totalUsd}\n- Mean cost per completed fragment: $${audit.cost.meanPerCompletedFragmentUsd}\n- Projected cost for 207 fragments: $${audit.cost.projected207Usd}\n\n## Partial-fragment rejection audit\n\n- Rejected fragments retaining individually valid claims: ${audit.partialRejections.fragmentsWithIndividuallyValidClaims}\n- Individually valid claims inside rejected fragments: ${audit.partialRejections.individuallyValidClaimsInsideRejectedFragments}\n- Individually invalid claims inside rejected fragments: ${audit.partialRejections.individuallyInvalidClaimsInsideRejectedFragments}\n- Global rejection reasons: ${JSON.stringify(audit.rejectionReasons)}\n\n## Safety\n\n- Hallucinations: ${metrics.GLOBAL.safety.hallucinationCount} (${fmt(metrics.GLOBAL.safety.hallucinationRate)})\n- Unsupported inference: ${metrics.GLOBAL.safety.unsupportedInferenceCount} (${fmt(metrics.GLOBAL.safety.unsupportedInferenceRate)})\n- Evidence inflation: ${metrics.GLOBAL.safety.evidenceInflationCount}\n- Invented causality: ${audit.safetyExtensions.inventedCausality}\n- Population generalization: ${audit.safetyExtensions.populationGeneralization}\n- EMG → hypertrophy violations: ${metrics.GLOBAL.safety.emgHypertrophyViolations}\n- Biomechanics → risk violations: ${metrics.GLOBAL.safety.biomechanicsRiskLeaps}\n- Clinical overreach: ${metrics.F3.safety.clinicalOverreachCount}\n- Universalization: ${metrics.GLOBAL.safety.universalizationCount}\n- Invented diagnoses: ${metrics.GLOBAL.safety.inventedDiagnosisCount}\n- Invented referrals: ${audit.safetyExtensions.inventedReferral}\n- PRODUCT_POLICY/MODELING_DECISION extracted: ${audit.safetyExtensions.productPolicyIncorrectlyExtracted}\n- Invented citations/sources: ${metrics.GLOBAL.safety.inventedCitationCount} / ${metrics.GLOBAL.safety.inventedSourceCount}\n\n## EpistemicStatus confusion matrix\n\n\`\`\`json\n${JSON.stringify(metrics.GLOBAL.classification.epistemicStatusConfusionMatrix, null, 2)}\n\`\`\`\n\n## Error taxonomy\n\n| Category | Count |\n|---|---:|\n${distribution}\n\n## Qualitative sample\n\n### 5 best examples\n\n${list(samples.best)}\n\n### 5 worst examples\n\n${list(samples.worst)}\n\n### Granularity cases\n\n${list(samples.granular)}\n\n### Citation cases\n\n${list(samples.citations)}\n\n### F3 clinical cases\n\n${list(samples.clinical)}\n\n### All safety violations\n\n${list(samples.safety)}\n\n## Coverage\n\n- Fragments with a coverage diagnostic: ${audit.coverage.fragmentsWithDiagnostics}\n- Coverage diagnostics: ${audit.coverage.diagnosticCount}\n- Coverage diagnostics by code: ${JSON.stringify(audit.coverage.byCode)}\n\n## Frozen gates (${passResult.stage})\n\n| Gate | Actual | Threshold | Result | Reason |\n|---|---:|---:|---|---|\n${gates}\n\n## Conclusion\n\n${
    passResult.replay
      ? 'Replay run: non-regression check only, no release verdict is issued.'
      : `${passResult.stage} gates passed: ${passResult.pass ? 'YES' : 'NO'}`
  }\n`;
}

const STAGE_FRAGMENT_COUNT = { DEV_20: 20, DEV_100: 100, HOLDOUT_30: 30 };

export function evaluateBenchmark(outputRoot = defaultOutputRoot, options = {}) {
  const config = readJson(join(outputRoot, 'config.json'));
  const stage = options.stage ?? config.stage ?? 'DEV_100';
  const expectedFragments = STAGE_FRAGMENT_COUNT[stage];
  if (expectedFragments === undefined) throw new Error(`unknown_benchmark_stage:${stage}`);
  if (config.fragmentCount !== expectedFragments) {
    throw new Error(`${stage.toLowerCase()}_requires_${expectedFragments}_fragments:${config.fragmentCount}`);
  }
  // Un replay rejoue des réponses déjà payées : il prouve une non-régression, il ne
  // décide jamais d'une mise en production.
  const isReplay = options.replay ?? config.replay ?? config.provider === 'replay';
  const dev100Metrics =
    options.dev100Metrics ??
    (config.dev100MetricsPath ? readJson(join(outputRoot, config.dev100MetricsPath)) : null);
  const adjudicated = readJson(join(root, 'golden/e5/adjudication/adjudicated.json'));
  const predictionDirectory = join(outputRoot, 'predictions');
  const diagnosticDirectory = join(outputRoot, 'diagnostics');
  const rawDirectory = join(outputRoot, 'raw-responses');
  const runRecords = config.fragmentIds.map((fragmentId) => {
    const safeId = fragmentId.replaceAll('.', '_');
    const prediction = readJson(join(predictionDirectory, `${safeId}.json`));
    const diagnostics = readJson(join(diagnosticDirectory, `${safeId}.json`));
    const attemptDirectory = join(rawDirectory, safeId);
    const attempts = readdirSync(attemptDirectory)
      .filter((name) => /^attempt-\d+\.json$/.test(name))
      .sort()
      .map((name) => readJson(join(attemptDirectory, name)));
    return {
      fragmentId,
      status: prediction.status,
      prediction: prediction.prediction,
      diagnostics: diagnostics.diagnostics,
      partialAudit: diagnostics.partialAudit ?? null,
      claimAudit: diagnostics.claimAudit ?? null,
      coverageAudit: diagnostics.coverageAudit ?? null,
      attempts
    };
  });
  const result = evaluateFragments({ annotations: adjudicated.annotations, runRecords });
  const metrics = buildMetrics(result.fragmentResults);
  const passResult = { ...benchmarkPass(metrics, { stage, dev100Metrics }), replay: isReplay };
  const samples = qualitativeSamples(result.fragmentResults);
  const audit = auditSummary(runRecords, result.fragmentResults, result.errors, config, metrics);
  writeJson(join(outputRoot, 'metrics.json'), metrics);
  writeJson(join(outputRoot, 'errors.json'), {
    schemaVersion: '1.0.0-e5-llm-benchmark-errors',
    runId: config.runId,
    distribution: errorDistribution(result.errors),
    errors: result.errors
  });
  writeJson(join(outputRoot, 'qualitative-samples.json'), samples);
  writeJson(join(outputRoot, 'audit-summary.json'), audit);
  writeFileSync(
    join(outputRoot, 'report.md'),
    reportMarkdown(config, metrics, result.errors, passResult, samples, audit),
    'utf8'
  );
  return { metrics, errors: result.errors, passResult, samples, audit };
}

function argsOf(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--output') args.output = argv[++index];
    else if (argv[index] === '--stage') args.stage = argv[++index];
    else if (argv[index] === '--dev100-metrics') args.dev100MetricsPath = argv[++index];
    else throw new Error(`unknown_argument:${argv[index]}`);
  }
  return args;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = argsOf(process.argv.slice(2));
    const result = evaluateBenchmark(args.output ?? defaultOutputRoot, {
      stage: args.stage,
      dev100Metrics: args.dev100MetricsPath ? readJson(args.dev100MetricsPath) : undefined
    });
    console.log(
      result.passResult.replay
        ? 'E5-LLM replay: non-regression check only, no release verdict.'
        : `E5-LLM ${result.passResult.stage} PASSES frozen gates: ${result.passResult.pass ? 'YES' : 'NO'}`
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
