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

function reportMarkdown(config, metrics, errors, passResult, samples) {
  const sections = ['GLOBAL', 'F2', 'F3']
    .map((scope) => {
      const item = metrics[scope];
      const rows = [
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
        ['Support span correctness', item.spans.supportSpanCorrectness],
        ['Mean span overlap', item.spans.meanMatchedOverlap],
        ['Span hallucination rate', item.spans.spanHallucinationRate],
        ['Citation precision', item.citations.precision],
        ['Citation recall', item.citations.recall],
        ['Citation F1', item.citations.f1],
        ['knowledgeType accuracy', item.classification.knowledgeTypeAccuracy],
        ['epistemicStatus accuracy', item.classification.epistemicStatusAccuracy],
        ['UNRESOLVED preservation', item.unresolved.preservationRate],
        ['UNRESOLVED forced rate', item.unresolved.forcedRate]
      ];
      return `### ${scope}\n\n| Metric | Value |\n|---|---:|\n${rows
        .map(([name, value]) => `| ${name} | ${fmt(value)} |`)
        .join('\n')}`;
    })
    .join('\n\n');
  const distribution = Object.entries(errorDistribution(errors))
    .map(([category, count]) => `| ${category} | ${count} |`)
    .join('\n');
  const gates = Object.entries(passResult.gates)
    .map(([name, gate]) => `| ${name} | ${gate.actual ?? 'n/a'} | ${gate.threshold} | ${gate.pass ? 'PASS' : 'FAIL'} |`)
    .join('\n');
  const list = (items) => (items.length ? items.map(exampleLine).join('\n') : '- Aucun cas.')
  const usage = config.summary?.usageByCallType ?? {};
  return `# E5-LLM BENCHMARK v0\n\n## Implementation\n\n- Run ID: \`${config.runId}\`\n- Provider/model: \`${config.provider}\` / \`${config.model}\`\n- Prompt: \`${config.promptVersion}\` (\`${config.promptHash}\`)\n- Temperature/top_p/max output: ${config.temperature} / ${config.topP} / ${config.maxOutputTokens}\n- Full retries: ${config.maxFullRetries}; targeted anchor repairs: ${config.maxAnchorRepairRetries}\n- Full calls/tokens/cost: ${usage.full?.calls ?? 'n/a'} / ${usage.full?.totalTokens ?? 'n/a'} / $${usage.full?.costUsd ?? 'n/a'}\n- Repair calls/tokens/cost: ${usage.repair?.calls ?? 'n/a'} / ${usage.repair?.totalTokens ?? 'n/a'} / $${usage.repair?.costUsd ?? 'n/a'}\n- Golden commit: \`${config.goldenCommit}\`\n- Corpus commit: \`${config.corpusCommit}\`\n- Rejected responses: ${metrics.GLOBAL.rejectedFragments}\n\n## Metrics\n\n${sections}\n\n## Safety\n\n- Hallucinations: ${metrics.GLOBAL.safety.hallucinationCount} (${fmt(metrics.GLOBAL.safety.hallucinationRate)})\n- Unsupported inference: ${metrics.GLOBAL.safety.unsupportedInferenceCount} (${fmt(metrics.GLOBAL.safety.unsupportedInferenceRate)})\n- Evidence inflation: ${metrics.GLOBAL.safety.evidenceInflationCount}\n- EMG → hypertrophy violations: ${metrics.GLOBAL.safety.emgHypertrophyViolations}\n- Biomechanics → risk violations: ${metrics.GLOBAL.safety.biomechanicsRiskLeaps}\n- Clinical overreach: ${metrics.F3.safety.clinicalOverreachCount}\n- Invented diagnoses: ${metrics.GLOBAL.safety.inventedDiagnosisCount}\n- Invented citations/sources: ${metrics.GLOBAL.safety.inventedCitationCount} / ${metrics.GLOBAL.safety.inventedSourceCount}\n\n## Error taxonomy\n\n| Category | Count |\n|---|---:|\n${distribution}\n\n## Qualitative sample\n\n### 5 best examples\n\n${list(samples.best)}\n\n### 5 worst examples\n\n${list(samples.worst)}\n\n### Granularity cases\n\n${list(samples.granular)}\n\n### Citation cases\n\n${list(samples.citations)}\n\n### F3 clinical cases\n\n${list(samples.clinical)}\n\n### All safety violations\n\n${list(samples.safety)}\n\n## Frozen gates\n\n| Gate | Actual | Threshold | Result |\n|---|---:|---:|---|\n${gates}\n\n## Conclusion\n\nE5-LLM v0 PASSES benchmark thresholds: ${passResult.pass ? 'YES' : 'NO'}\n`;
}

export function evaluateBenchmark(outputRoot = benchmarkRoot) {
  const config = readJson(join(outputRoot, 'config.json'));
  if (config.fragmentCount !== 100) throw new Error(`full_benchmark_requires_100_fragments:${config.fragmentCount}`);
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
      attempts
    };
  });
  const result = evaluateFragments({ annotations: adjudicated.annotations, runRecords });
  const metrics = buildMetrics(result.fragmentResults);
  const passResult = benchmarkPass(metrics);
  const samples = qualitativeSamples(result.fragmentResults);
  writeJson(join(outputRoot, 'metrics.json'), metrics);
  writeJson(join(outputRoot, 'errors.json'), {
    schemaVersion: '1.0.0-e5-llm-benchmark-errors',
    runId: config.runId,
    distribution: errorDistribution(result.errors),
    errors: result.errors
  });
  writeJson(join(outputRoot, 'qualitative-samples.json'), samples);
  writeFileSync(join(outputRoot, 'report.md'), reportMarkdown(config, metrics, result.errors, passResult, samples), 'utf8');
  return { metrics, errors: result.errors, passResult, samples };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = evaluateBenchmark();
    console.log(`E5-LLM v0 PASSES benchmark thresholds: ${result.passResult.pass ? 'YES' : 'NO'}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
