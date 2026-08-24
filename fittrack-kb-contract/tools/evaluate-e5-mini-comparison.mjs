#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMetrics, evaluateFragments } from './e5-llm/evaluate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const comparisonRoot = join(root, 'benchmark/e5/v0/mini-comparison');
const manifest = readJson(join(comparisonRoot, 'manifest.json'));
const adjudicated = readJson(join(root, 'golden/e5/adjudication/adjudicated.json'));
const runVariants = {
  gpt5: 'openrouter-openai-gpt-5',
  qwen: 'local-qwen3-1.7b-q8-0'
};

const SCHEMA_CODES = new Set(['SCHEMA_FAILURE', 'ANCHOR_REPAIR_SCHEMA_FAILURE', 'ANCHOR_REPAIR_INVALID_JSON', 'INVALID_JSON']);
const ANCHOR_CODES = new Set(['ANCHOR_NOT_FOUND', 'AMBIGUOUS_SUPPORT_ANCHOR', 'OVERLAPPING_SUPPORT_ANCHORS', 'PROVIDER_ANCHOR_INDEX_INVALID', 'ANCHOR_REPAIR_SCOPE_INVALID']);
const CANONICAL_CODES = new Set(['INVALID_FRAGMENT_ID', 'CANONICAL_SCHEMA_SHAPE_UNSUPPORTED', 'CANONICAL_SPAN_INVALID', 'CANONICAL_FRAGMENT_ID_MISMATCH', 'CANONICAL_TECHNICAL_REF_INVALID']);
const CITATION_CODES = new Set(['INVENTED_CITATION', 'CITATION_BLEED']);
const SAFETY_CODES = new Set(['UNSUPPORTED_INFERENCE', 'EVIDENCE_INFLATION', 'EMG_HYPERTROPHY_LEAP', 'BIOMECHANICS_RISK_LEAP', 'CLINICAL_OVERREACH', 'INVENTED_DIAGNOSIS', 'INVENTED_SOURCE']);

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function loadRun(variant) {
  const outputRoot = join(comparisonRoot, 'runs', variant);
  const config = readJson(join(outputRoot, 'config.json'));
  const summary = readJson(join(outputRoot, 'run-summary.json'));
  if (JSON.stringify(config.fragmentIds) !== JSON.stringify(manifest.fragmentIds)) {
    throw new Error(`mini_run_manifest_mismatch:${variant}`);
  }
  const records = manifest.fragmentIds.map((fragmentId) => {
    const safeId = fragmentId.replaceAll('.', '_');
    const prediction = readJson(join(outputRoot, 'predictions', `${safeId}.json`));
    const diagnostics = readJson(join(outputRoot, 'diagnostics', `${safeId}.json`));
    const attempts = readdirSync(join(outputRoot, 'raw-responses', safeId))
      .filter((name) => /^attempt-\d+\.json$/u.test(name))
      .sort()
      .map((name) => readJson(join(outputRoot, 'raw-responses', safeId, name)));
    return {
      fragmentId,
      status: prediction.status,
      prediction: prediction.prediction,
      diagnostics: diagnostics.diagnostics,
      attempts
    };
  });
  const runtimeMetricsPath = join(outputRoot, 'runtime-metrics.json');
  return {
    outputRoot,
    config,
    summary,
    records,
    runtimeMetrics: existsSync(runtimeMetricsPath) ? readJson(runtimeMetricsPath) : null
  };
}

function allDiagnostics(records) {
  return records.flatMap((record) => {
    const attemptDiagnostics = record.attempts.flatMap(
      (attempt) => attempt.validation?.diagnostics ?? []
    );
    return record.attempts.length > 0 ? attemptDiagnostics : record.diagnostics;
  });
}

function countCodes(diagnostics, codes) {
  return diagnostics.filter((item) => codes.has(item.code)).length;
}

function errorCount(errors, category) {
  return errors.filter((item) => item.category === category).length;
}

function cannotConcludeMetric(fragmentResults) {
  let applicableClaims = 0;
  let preservedClaims = 0;
  let goldItems = 0;
  let predictedItems = 0;
  for (const fragment of fragmentResults) {
    for (const pair of fragment.pairs) {
      const gold = pair.golden.cannotConclude ?? [];
      if (gold.length === 0) continue;
      applicableClaims += 1;
      goldItems += gold.length;
      const predicted = pair.prediction.cannotConclude ?? [];
      predictedItems += predicted.length;
      if (predicted.length > 0) preservedClaims += 1;
    }
  }
  return {
    applicableClaims,
    preservedClaims,
    presencePreservationRate: applicableClaims ? preservedClaims / applicableClaims : null,
    goldItems,
    predictedItems
  };
}

function latencyMetrics(records) {
  const latencies = records.flatMap((record) =>
    record.attempts.map((attempt) => attempt.latencyMs).filter(Number.isFinite)
  );
  const totalMs = latencies.reduce((sum, value) => sum + value, 0);
  return {
    callsMeasured: latencies.length,
    totalMs,
    meanMs: latencies.length ? totalMs / latencies.length : null,
    maxMs: latencies.length ? Math.max(...latencies) : null
  };
}

function evaluateRun(label, run) {
  const annotations = adjudicated.annotations.filter((item) =>
    manifest.fragmentIds.includes(item.fragmentId)
  );
  const evaluated = evaluateFragments({ annotations, runRecords: run.records });
  const metrics = buildMetrics(evaluated.fragmentResults);
  const diagnostics = allDiagnostics(run.records);
  const errors = evaluated.errors;
  const global = metrics.GLOBAL;
  const result = {
    label,
    provider: run.config.provider,
    model: run.config.model,
    modelArtifact: run.config.modelArtifact ?? null,
    promptVersion: run.config.promptVersion,
    providerDtoVersion: run.config.providerDtoVersion,
    technical: {
      validated: run.records.filter((item) => item.status === 'VALIDATED').length,
      total: manifest.fragmentIds.length,
      fullCalls: run.summary.fullCalls,
      repairCalls: run.summary.repairCalls,
      rejected: run.records.filter((item) => item.status === 'REJECTED').length,
      schemaFailures: countCodes(diagnostics, SCHEMA_CODES),
      anchorFailures: countCodes(diagnostics, ANCHOR_CODES),
      canonicalFailures: countCodes(diagnostics, CANONICAL_CODES),
      citationFailures: countCodes(diagnostics, CITATION_CODES),
      safetyFailures: countCodes(diagnostics, SAFETY_CODES)
    },
    claims: {
      gold: global.claims.golden,
      predicted: global.claims.predicted,
      attemptedRaw: evaluated.fragmentResults.reduce(
        (sum, fragment) => sum + fragment.attemptedClaimCount,
        0
      ),
      matched: global.claims.matched,
      missed: global.claims.golden - global.claims.matched,
      extra: global.claims.predicted - global.claims.matched,
      merged: errorCount(errors, 'MERGED_CLAIMS'),
      overFragmentation: errorCount(errors, 'OVER_FRAGMENTATION'),
      precision: global.claims.precision,
      recall: global.claims.recall,
      f1: global.claims.f1
    },
    classification: {
      knowledgeTypeAccuracy: global.classification.knowledgeTypeAccuracy,
      knowledgeTypeComparable: global.classification.knowledgeTypeComparable,
      knowledgeTypeCorrect: Math.round(
        global.classification.knowledgeTypeAccuracy * global.classification.knowledgeTypeComparable
      ),
      epistemicStatusAccuracy: global.classification.epistemicStatusAccuracy,
      epistemicStatusComparable: global.classification.epistemicStatusComparable,
      epistemicStatusCorrect: Math.round(
        global.classification.epistemicStatusAccuracy * global.classification.epistemicStatusComparable
      ),
      unresolvedPreservationRate: global.unresolved.preservationRate,
      unresolvedForcedRate: global.unresolved.forcedRate,
      cannotConclude: cannotConcludeMetric(evaluated.fragmentResults)
    },
    citations: {
      precision: global.citations.precision,
      recall: global.citations.recall,
      bleed: global.citations.crossFragmentCitationCount,
      omission: global.citations.falseNegative,
      invented: global.citations.inventedCitationCount
    },
    safety: {
      unsupportedInference: errorCount(errors, 'UNSUPPORTED_INFERENCE'),
      evidenceInflation: global.safety.evidenceInflationCount,
      emgHypertrophyLeap: global.safety.emgHypertrophyViolations,
      biomechanicsRiskLeap: global.safety.biomechanicsRiskLeaps,
      clinicalOverreach: global.safety.clinicalOverreachCount,
      inventedDiagnosis: global.safety.inventedDiagnosisCount,
      universalization: global.safety.universalizationCount,
      totalViolations:
        errorCount(errors, 'UNSUPPORTED_INFERENCE') +
        global.safety.emgHypertrophyViolations +
        global.safety.biomechanicsRiskLeaps +
        global.safety.clinicalOverreachCount +
        global.safety.inventedDiagnosisCount +
        global.safety.inventedCitationCount +
        global.safety.inventedSourceCount
    },
    performance: {
      inputTokens: run.summary.usageByCallType.total.inputTokens,
      outputTokens: run.summary.usageByCallType.total.outputTokens,
      costUsd: run.summary.usageByCallType.total.costUsd,
      latency: {
        ...latencyMetrics(run.records),
        wallMs: new Date(run.summary.completedAt).getTime() - new Date(run.config.startedAt).getTime()
      },
      runtime: run.runtimeMetrics
    },
    fragmentResults: evaluated.fragmentResults,
    errorDistribution: Object.fromEntries(
      [...new Set(errors.map((item) => item.category))]
        .sort()
        .map((category) => [category, errorCount(errors, category)])
    )
  };
  writeJson(join(comparisonRoot, `${label}.metrics.json`), result);
  return result;
}

function percent(value) {
  return value === null || value === undefined ? 'n/a' : `${(value * 100).toFixed(1)}%`;
}

function value(value) {
  return value === null || value === undefined ? 'n/a' : value;
}

function report(gpt5, qwen) {
  const rows = [
    ['VALIDATED / 5', `${gpt5.technical.validated}/5`, `${qwen.technical.validated}/5`],
    ['Claim precision', percent(gpt5.claims.precision), percent(qwen.claims.precision)],
    ['Claim recall', percent(gpt5.claims.recall), percent(qwen.claims.recall)],
    ['Claim F1', percent(gpt5.claims.f1), percent(qwen.claims.f1)],
    ['Citation precision', percent(gpt5.citations.precision), percent(qwen.citations.precision)],
    ['Citation recall', percent(gpt5.citations.recall), percent(qwen.citations.recall)],
    ['KnowledgeType', percent(gpt5.classification.knowledgeTypeAccuracy), percent(qwen.classification.knowledgeTypeAccuracy)],
    ['EpistemicStatus', percent(gpt5.classification.epistemicStatusAccuracy), percent(qwen.classification.epistemicStatusAccuracy)],
    ['Safety violations', gpt5.safety.totalViolations, qwen.safety.totalViolations],
    ['Full calls', gpt5.technical.fullCalls, qwen.technical.fullCalls],
    ['Repair calls', gpt5.technical.repairCalls, qwen.technical.repairCalls],
    ['Cost', `$${gpt5.performance.costUsd}`, `$${qwen.performance.costUsd}`],
    ['Latency total', `${gpt5.performance.latency.totalMs} ms`, `${qwen.performance.latency.totalMs} ms`]
  ];
  const protocolReady =
    gpt5.technical.schemaFailures === 0 &&
    gpt5.technical.anchorFailures === 0 &&
    gpt5.technical.canonicalFailures === 0 &&
    gpt5.technical.citationFailures === 0 &&
    gpt5.technical.fullCalls === 5 &&
    gpt5.technical.repairCalls <= 5 &&
    gpt5.citations.invented === 0 &&
    gpt5.citations.bleed === 0 &&
    gpt5.safety.emgHypertrophyLeap === 0 &&
    gpt5.safety.biomechanicsRiskLeap === 0 &&
    gpt5.safety.clinicalOverreach === 0 &&
    gpt5.safety.inventedDiagnosis === 0;
  const qwenViability =
    qwen.technical.validated >= 4 && qwen.claims.recall >= 0.7 && qwen.safety.totalViolations === 0
      ? 'PRELIMINARY YES'
      : qwen.technical.validated <= 2 || qwen.claims.recall < 0.5 || qwen.safety.totalViolations > 0
        ? 'PRELIMINARY NO'
        : 'INCONCLUSIVE';
  const detailRows = [
    ['Rejections', gpt5.technical.rejected, qwen.technical.rejected],
    ['Schema failures', gpt5.technical.schemaFailures, qwen.technical.schemaFailures],
    ['Anchor failures (responses)', gpt5.technical.anchorFailures, qwen.technical.anchorFailures],
    ['Canonical failures', gpt5.technical.canonicalFailures, qwen.technical.canonicalFailures],
    ['Citation failures', gpt5.technical.citationFailures, qwen.technical.citationFailures],
    ['Safety guardrail failures', gpt5.technical.safetyFailures, qwen.technical.safetyFailures],
    ['GOLD claims', gpt5.claims.gold, qwen.claims.gold],
    ['Accepted predicted claims', gpt5.claims.predicted, qwen.claims.predicted],
    ['Raw attempted claims', gpt5.claims.attemptedRaw, qwen.claims.attemptedRaw],
    ['Correctly matched claims', gpt5.claims.matched, qwen.claims.matched],
    ['Missed claims', gpt5.claims.missed, qwen.claims.missed],
    ['Extra claims', gpt5.claims.extra, qwen.claims.extra],
    ['Merged claims', gpt5.claims.merged, qwen.claims.merged],
    ['Over-fragmentation', gpt5.claims.overFragmentation, qwen.claims.overFragmentation],
    ['UNRESOLVED preservation', percent(gpt5.classification.unresolvedPreservationRate), percent(qwen.classification.unresolvedPreservationRate)],
    ['cannotConclude presence', percent(gpt5.classification.cannotConclude.presencePreservationRate), percent(qwen.classification.cannotConclude.presencePreservationRate)],
    ['Citation bleed', gpt5.citations.bleed, qwen.citations.bleed],
    ['Citation omissions', gpt5.citations.omission, qwen.citations.omission],
    ['Invented citations', gpt5.citations.invented, qwen.citations.invented],
    ['Unsupported inference', gpt5.safety.unsupportedInference, qwen.safety.unsupportedInference],
    ['EMG → hypertrophy leap', gpt5.safety.emgHypertrophyLeap, qwen.safety.emgHypertrophyLeap],
    ['Biomechanics → risk leap', gpt5.safety.biomechanicsRiskLeap, qwen.safety.biomechanicsRiskLeap],
    ['Clinical overreach', gpt5.safety.clinicalOverreach, qwen.safety.clinicalOverreach],
    ['Invented diagnosis', gpt5.safety.inventedDiagnosis, qwen.safety.inventedDiagnosis],
    ['Universalization', gpt5.safety.universalization, qwen.safety.universalization],
    ['Input tokens', gpt5.performance.inputTokens, qwen.performance.inputTokens],
    ['Output tokens', gpt5.performance.outputTokens, qwen.performance.outputTokens],
    ['Mean call latency', `${Math.round(gpt5.performance.latency.meanMs)} ms`, `${Math.round(qwen.performance.latency.meanMs)} ms`],
    ['End-to-end run latency', `${gpt5.performance.latency.wallMs} ms`, `${qwen.performance.latency.wallMs} ms`],
    ['Peak local RAM', 'n/a', qwen.performance.runtime ? `${(qwen.performance.runtime.peakWorkingSetBytes / 1024 ** 3).toFixed(2)} GiB` : 'n/a'],
    ['Local VRAM', 'n/a', qwen.performance.runtime ? `${qwen.performance.runtime.vramBytes} B` : 'n/a']
  ];
  return `# E5 v0.3 mini-comparison\n\n` +
    `Manifest: \`${manifest.benchmarkId}\`\n\n` +
    `| Metric | GPT-5 | Qwen3-1.7B |\n|---|---:|---:|\n` +
    rows.map((row) => `| ${row[0]} | ${value(row[1])} | ${value(row[2])} |`).join('\n') +
    `\n\n## Detailed metrics\n\n` +
    `| Metric | GPT-5 | Qwen3-1.7B |\n|---|---:|---:|\n` +
    detailRows.map((row) => `| ${row[0]} | ${value(row[1])} | ${value(row[2])} |`).join('\n') +
    `\n\nClassification denominators: KnowledgeType ${gpt5.classification.knowledgeTypeCorrect}/${gpt5.classification.knowledgeTypeComparable} vs ${qwen.classification.knowledgeTypeCorrect}/${qwen.classification.knowledgeTypeComparable}; EpistemicStatus ${gpt5.classification.epistemicStatusCorrect}/${gpt5.classification.epistemicStatusComparable} vs ${qwen.classification.epistemicStatusCorrect}/${qwen.classification.epistemicStatusComparable}.\n\n` +
    `## Short analysis\n\n` +
    `1. GPT-5 is materially better on recall, F1, citation recall, validated fragments, anchor fidelity and latency.\n` +
    `2. Qwen is equal on zero invented citations, zero citation bleed and zero dangerous clinical/biomechanical leaps; its 100% precision and KnowledgeType scores apply to only one accepted matched claim. Local API cost is zero.\n` +
    `3. Model-linked failures: GPT-5 confused two product-policy statements with extractable knowledge and remained unstable on EpistemicStatus. Qwen severely under-extracted, returned ZERO_CLAIM on two non-empty GOLD fragments, and failed verbatim anchors after repair on two fragments.\n` +
    `4. Protocol-linked residuals: the strict guardrail rejects a whole GPT fragment when policy claims coexist with useful claims, and targeted anchor repair cannot recover anchors that the small model still paraphrases. The matcher, canonical reconstruction, citation closure and safety guardrails themselves behaved deterministically.\n` +
    `5. Qwen3-1.7B Q8_0 is not preliminarily viable as the FitTrack mobile extractor at this quality level: recall is 6.7% and only 3/5 fragments validate despite three repairs.\n\n` +
    `## Mandatory conclusions\n\n` +
    `E5 v0.3 protocol ready for 100-fragment benchmark: ${protocolReady ? 'YES' : 'NO'}\n\n` +
    `Qwen target appears viable for FitTrack mobile: ${qwenViability}\n`;
}

const gpt5 = evaluateRun('gpt5', loadRun(runVariants.gpt5));
const qwen = evaluateRun('qwen', loadRun(runVariants.qwen));
const comparison = { manifest, gpt5, qwen };
writeJson(join(comparisonRoot, 'comparison.json'), comparison);
writeFileSync(join(comparisonRoot, 'report.md'), report(gpt5, qwen), 'utf8');
console.log('E5 mini-comparison evaluation written.');
