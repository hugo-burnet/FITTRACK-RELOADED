import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { doubleAnnotationMetrics } from "./e5-gold-comparison.mjs";
import { corpusHierarchy } from "./e5-llm/provider-dto.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const goldenRoot = path.join(root, "golden", "e5");
const sourceRoot = path.join(goldenRoot, "source");

async function readJson(relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
}

function sha256(text) {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

const fragmentsDocument = await readJson("candidates/e5-prose-fragments.json");
const citationsDocument = await readJson("candidates/e5-prose-citation-occurrences.json");
const manifestDocument = await readJson("candidates/e5-prose-golden-manifest.json");
const doubleSelection = await readJson("golden/e5/source/double-annotation-fragments.json");

const fragmentById = new Map(fragmentsDocument.fragments.map((fragment) => [fragment.fragmentId, fragment]));
const citationById = new Map(citationsDocument.candidates.map((citation) => [citation.candidateId, citation]));
const manifestOrder = new Map(manifestDocument.fragments.map((fragment, index) => [fragment.fragmentId, index]));

function byteLength(text) {
  return Buffer.byteLength(text, "utf8");
}

function locateSpan(fragment, support) {
  const specification = typeof support === "string" ? { text: support, occurrence: 1 } : support;
  const { text, occurrence = 1 } = specification;
  let characterStart = -1;
  let searchFrom = 0;

  for (let index = 0; index < occurrence; index += 1) {
    characterStart = fragment.rawText.indexOf(text, searchFrom);
    if (characterStart < 0) {
      throw new Error(`Support span not found in ${fragment.fragmentId}: ${JSON.stringify(text)}`);
    }
    searchFrom = characterStart + text.length;
  }

  const relativeStartByte = byteLength(fragment.rawText.slice(0, characterStart));
  const relativeEndByte = relativeStartByte + byteLength(text);

  return {
    text,
    relativeStartByte,
    relativeEndByte,
    absoluteStartByte: fragment.startByte + relativeStartByte,
    absoluteEndByte: fragment.startByte + relativeEndByte
  };
}

function claimId(fragmentId, ordinal) {
  const fragmentKey = fragmentId.replace(/^frag\./, "").replaceAll(".", "-");
  return `gold.e5.${fragmentKey}.${String(ordinal).padStart(2, "0")}`;
}

function resolution(value, reason, resolvedBy = "human_annotation") {
  if (value !== undefined) {
    return { state: "RESOLVED", value, resolvedBy };
  }
  return { state: "UNRESOLVED", reason: reason ?? "not_determinable_from_fragment" };
}

function optionalAxis(value, unresolvedReason) {
  if (value !== undefined && (!Array.isArray(value) || value.length > 0)) {
    return { state: "RESOLVED", value, resolvedBy: "human_annotation" };
  }
  if (unresolvedReason) {
    return { state: "UNRESOLVED", reason: unresolvedReason };
  }
  return { state: "NOT_STATED", reason: "not_explicit_in_fragment" };
}

function materializeClaim(fragment, specification, ordinal) {
  const supports = specification.supportTexts ?? [specification.rawStatement];
  const supportSpans = supports.map((support) => locateSpan(fragment, support));
  if (!supportSpans.some((span) => span.text === specification.rawStatement)) {
    throw new Error(`rawStatement must be one exact support span in ${fragment.fragmentId}`);
  }

  const assessment = specification.assessment;
  // Règle partagée : voir corpusHierarchy dans e5-llm/provider-dto.mjs. Elle
  // était recopiée ici sous forme binaire, comme dans le validateur.
  const hierarchyHint = corpusHierarchy(fragment.corpusFileId);
  const unresolvedAxes = specification.unresolvedAxes ?? {};
  const citationOccurrenceIds = specification.citations ?? [];

  for (const citationId of citationOccurrenceIds) {
    const citation = citationById.get(citationId);
    if (!citation) throw new Error(`Unknown citation ${citationId}`);
    if (citation.fragmentRef !== fragment.fragmentId) {
      throw new Error(`Citation ${citationId} does not belong to ${fragment.fragmentId}`);
    }
  }

  const output = {
    goldenClaimId: claimId(fragment.fragmentId, ordinal),
    rawStatement: specification.rawStatement,
    supportSpans,
    domain: specification.domain,
    ...(specification.knowledgeType === undefined ? {} : { knowledgeType: specification.knowledgeType }),
    ...(specification.epistemicStatus === undefined ? {} : { epistemicStatus: specification.epistemicStatus }),
    ...(assessment === undefined ? {} : { assessment: { ...assessment, hierarchyHint } }),
    axisResolution: {
      knowledgeType: resolution(specification.knowledgeType, unresolvedAxes.knowledgeType),
      epistemicStatus: resolution(specification.epistemicStatus, unresolvedAxes.epistemicStatus),
      confidenceByAspect: optionalAxis(assessment?.confidenceByAspect, unresolvedAxes.confidenceByAspect),
      directness: optionalAxis(assessment?.directness, unresolvedAxes.directness),
      evidenceTypes: optionalAxis(assessment?.evidenceTypes, unresolvedAxes.evidenceTypes),
      hierarchyHint: {
        state: "RESOLVED",
        value: hierarchyHint,
        resolvedBy: "deterministic_rule"
      }
    },
    citationOccurrenceIds,
    citationAttributionState:
      specification.citationAttributionState ?? (citationOccurrenceIds.length > 0 ? "ATTACHED" : "NOT_CITED"),
    cannotConclude: specification.cannotConclude ?? [],
    limitations: specification.limitations ?? [],
    ...(specification.canonicalStatement === undefined
      ? {}
      : { canonicalStatement: specification.canonicalStatement }),
    ...(specification.ambiguities === undefined ? {} : { ambiguities: specification.ambiguities }),
    ...(specification.flags === undefined ? {} : { flags: specification.flags }),
    ...(specification.notes === undefined ? {} : { notes: specification.notes })
  };

  return output;
}

function materializeAnnotation(specification) {
  const fragment = fragmentById.get(specification.fragmentId);
  if (!fragment) throw new Error(`Unknown fragment ${specification.fragmentId}`);
  if (!manifestOrder.has(specification.fragmentId)) {
    throw new Error(`Fragment outside E5 GOLD manifest: ${specification.fragmentId}`);
  }

  return {
    fragmentId: specification.fragmentId,
    annotationStatus: specification.annotationStatus,
    expectedClaims: (specification.claims ?? []).map((claim, index) =>
      materializeClaim(fragment, claim, index + 1)
    ),
    ...(specification.zeroClaimReason === undefined
      ? {}
      : { zeroClaimReason: specification.zeroClaimReason }),
    ...(specification.ambiguities === undefined ? {} : { ambiguities: specification.ambiguities }),
    ...(specification.annotationNotes === undefined
      ? {}
      : { annotationNotes: specification.annotationNotes })
  };
}

function assertCoverage(specifications, expectedIds, label) {
  const actualIds = specifications.map((annotation) => annotation.fragmentId);
  if (new Set(actualIds).size !== actualIds.length) throw new Error(`${label} has duplicate fragment IDs`);
  const actual = new Set(actualIds);
  const missing = expectedIds.filter((id) => !actual.has(id));
  const extra = actualIds.filter((id) => !expectedIds.includes(id));
  if (missing.length || extra.length) {
    throw new Error(`${label} coverage mismatch; missing=${missing.join(",")}; extra=${extra.join(",")}`);
  }
}

async function loadSpecifications(moduleName) {
  const module = await import(pathToFileURL(path.join(sourceRoot, moduleName)));
  return module.default;
}

async function writeAnnotationDocument(relativeTarget, annotatorId, annotationRole, specifications) {
  const annotations = specifications
    .map(materializeAnnotation)
    .sort((left, right) => manifestOrder.get(left.fragmentId) - manifestOrder.get(right.fragmentId));
  const document = {
    schemaVersion: "1.0.0-e5-gold",
    annotatorId,
    annotationRole,
    annotations
  };
  await writeFile(path.join(goldenRoot, relativeTarget), `${JSON.stringify(document, null, 2)}\n`);
  return document;
}

function increment(distribution, key) {
  distribution[key] = (distribution[key] ?? 0) + 1;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function globalMetrics(annotations) {
  const claimCounts = annotations.map((annotation) => annotation.expectedClaims.length);
  const claims = annotations.flatMap((annotation) => annotation.expectedClaims);
  const knowledgeType = {};
  const epistemicStatus = {};
  const fragmentsByCorpus = { F2: 0, F3: 0 };
  const claimsByCorpus = { F2: 0, F3: 0 };
  let claimsWithCitations = 0;
  let citationLinks = 0;
  let claimsWithUnresolvedAxis = 0;
  let unresolvedAxisCount = 0;

  for (const annotation of annotations) {
    const label = fragmentById.get(annotation.fragmentId).corpusFileId.startsWith("corpus.f2.")
      ? "F2"
      : "F3";
    fragmentsByCorpus[label] += 1;
    claimsByCorpus[label] += annotation.expectedClaims.length;
  }
  for (const claim of claims) {
    increment(knowledgeType, claim.knowledgeType ?? "UNRESOLVED");
    increment(epistemicStatus, claim.epistemicStatus ?? "UNRESOLVED");
    citationLinks += claim.citationOccurrenceIds.length;
    if (claim.citationOccurrenceIds.length) claimsWithCitations += 1;
    const unresolved = Object.values(claim.axisResolution).filter(
      (axis) => axis.state === "UNRESOLVED"
    ).length;
    unresolvedAxisCount += unresolved;
    if (unresolved) claimsWithUnresolvedAxis += 1;
  }

  return {
    fragmentCount: annotations.length,
    claimCount: claims.length,
    meanClaimsPerFragment: claims.length / annotations.length,
    medianClaimsPerFragment: median(claimCounts),
    zeroClaimFragments: annotations.filter(
      (annotation) => annotation.annotationStatus === "zero_claim"
    ).length,
    unresolvedFragmentStatuses: annotations.filter(
      (annotation) => annotation.annotationStatus === "unresolved"
    ).length,
    fragmentsWithAnyUnresolvedAxis: annotations.filter((annotation) =>
      annotation.expectedClaims.some((claim) =>
        Object.values(claim.axisResolution).some((axis) => axis.state === "UNRESOLVED")
      )
    ).length,
    claimsWithUnresolvedAxis,
    unresolvedAxisCount,
    needsAdjudicationBeforeAdjudication: primary.filter(
      (annotation) => annotation.annotationStatus === "needs_adjudication"
    ).length,
    fragmentsByCorpus,
    claimsByCorpus,
    knowledgeType,
    epistemicStatus,
    claimsWithCitations,
    claimsWithoutCitations: claims.length - claimsWithCitations,
    citationLinks,
    meanCitationsPerClaim: claims.length ? citationLinks / claims.length : 0
  };
}

await mkdir(path.join(goldenRoot, "annotations"), { recursive: true });
await mkdir(path.join(goldenRoot, "adjudication"), { recursive: true });

const primaryF2 = await loadSpecifications("annotator-a-f2.mjs");
const primaryF3 = await loadSpecifications("annotator-a-f3.mjs");
const primary = [...primaryF2, ...primaryF3];
const allManifestIds = manifestDocument.fragments.map((fragment) => fragment.fragmentId);
assertCoverage(primary, allManifestIds, "annotator_A");

const secondary = await loadSpecifications("annotator-b.mjs");
assertCoverage(secondary, doubleSelection.fragmentIds, "annotator_B");

const primaryDocument = await writeAnnotationDocument(
  "annotations/annotator-a.json",
  "annotator_A",
  "primary",
  primary
);
const secondaryDocument = await writeAnnotationDocument(
  "annotations/annotator-b.json",
  "annotator_B",
  "independent_secondary",
  secondary
);

const comparison = doubleAnnotationMetrics(
  primaryDocument.annotations,
  secondaryDocument.annotations
);
const adjudicationSpecification = await loadSpecifications("adjudication-spec.mjs");
const measuredDisagreementIds = comparison.disagreements.map((item) => item.fragmentId);
const decisionIds = adjudicationSpecification.decisions.map((item) => item.fragmentId);
if (JSON.stringify(measuredDisagreementIds) !== JSON.stringify(decisionIds)) {
  throw new Error("Adjudication decisions do not cover the measured disagreements in stable order");
}

const primaryMaterializedById = new Map(
  primaryDocument.annotations.map((annotation) => [annotation.fragmentId, annotation])
);
const secondaryMaterializedById = new Map(
  secondaryDocument.annotations.map((annotation) => [annotation.fragmentId, annotation])
);
const adjudicatedById = new Map(primaryMaterializedById);

for (const decision of adjudicationSpecification.decisions) {
  const selected =
    decision.selected === "A"
      ? primaryMaterializedById.get(decision.fragmentId)
      : decision.selected === "B"
        ? secondaryMaterializedById.get(decision.fragmentId)
        : materializeAnnotation(decision.annotation);
  adjudicatedById.set(decision.fragmentId, selected);
}
for (const resolution of adjudicationSpecification.primaryOnlyResolutions) {
  adjudicatedById.set(resolution.fragmentId, materializeAnnotation(resolution.annotation));
}

// The adjudicated entries are already materialized. Write them directly to avoid
// a second semantic transformation of the manual decisions.
const adjudicatedDocument = {
  schemaVersion: "1.0.0-e5-gold",
  annotatorId: "adjudicated",
  annotationRole: "adjudicated",
  annotations: allManifestIds.map((fragmentId) => adjudicatedById.get(fragmentId))
};
await writeFile(
  path.join(goldenRoot, "adjudication", "adjudicated.json"),
  `${JSON.stringify(adjudicatedDocument, null, 2)}\n`
);

if (
  adjudicatedDocument.annotations.some(
    (annotation) => annotation.annotationStatus === "needs_adjudication"
  )
) {
  throw new Error("Adjudication left at least one needs_adjudication status unresolved");
}

const dimensionsById = new Map(
  comparison.disagreements.map((item) => [item.fragmentId, item.dimensions])
);
const disagreementDocument = {
  schemaVersion: "1.0.0-e5-gold-adjudication",
  comparedAnnotators: ["annotator_A", "annotator_B"],
  comparisonMethod:
    "Exact claim counts and ZERO_CLAIM status; greedy maximum span-overlap alignment for span, knowledgeType, epistemicStatus and citation-set agreement.",
  doubleAnnotationDecisionCount: adjudicationSpecification.decisions.length,
  primaryOnlyResolutionCount: adjudicationSpecification.primaryOnlyResolutions.length,
  totalDecisionCount:
    adjudicationSpecification.decisions.length +
    adjudicationSpecification.primaryOnlyResolutions.length,
  disagreements: adjudicationSpecification.decisions.map((decision) => ({
    fragmentId: decision.fragmentId,
    dimensions: dimensionsById.get(decision.fragmentId),
    selected: decision.selected,
    justification: decision.justification
  })),
  primaryOnlyResolutions: adjudicationSpecification.primaryOnlyResolutions.map((resolution) => ({
    fragmentId: resolution.fragmentId,
    justification: resolution.justification
  }))
};
await writeFile(
  path.join(goldenRoot, "adjudication", "disagreements.json"),
  `${JSON.stringify(disagreementDocument, null, 2)}\n`
);

const global = globalMetrics(adjudicatedDocument.annotations);
const doubleAnnotation = {
  ...Object.fromEntries(
    Object.entries(comparison).filter(([key]) => key !== "disagreements")
  ),
  decisionCount: adjudicationSpecification.decisions.length,
  primaryOnlyResolutionCount: adjudicationSpecification.primaryOnlyResolutions.length,
  totalAdjudicationDecisionCount: disagreementDocument.totalDecisionCount,
  principalDisagreementReasons: Object.entries(comparison.disagreementDimensionCounts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([dimension, count]) => ({ dimension, count }))
};
const metricsDocument = {
  schemaVersion: "1.0.0-e5-gold-metrics",
  global,
  doubleAnnotation
};
await writeFile(
  path.join(goldenRoot, "metrics.json"),
  `${JSON.stringify(metricsDocument, null, 2)}\n`
);

const selectedIds = new Set(allManifestIds);
const citationCountsByFragment = new Map();
for (const citation of citationsDocument.candidates) {
  if (!selectedIds.has(citation.fragmentRef)) continue;
  citationCountsByFragment.set(
    citation.fragmentRef,
    (citationCountsByFragment.get(citation.fragmentRef) ?? 0) + 1
  );
}
const multipleCitationFragments = [...citationCountsByFragment.values()].filter(
  (count) => count >= 2
).length;
const designReviewText = await readFile(
  path.join(goldenRoot, "references", "E5-DESIGN-REVIEW.md"),
  "utf8"
);
const manifest = {
  schemaVersion: "1.0.0-e5-gold-manifest",
  status: "ready_for_e5_llm_benchmark",
  p0BaseCommit: "de76716c88d6f53207e0d45ea6d3bf7c584fc114",
  designReviewRef: "references/E5-DESIGN-REVIEW.md",
  designReviewHash: sha256(designReviewText),
  selectionManifestRef: "../../candidates/e5-prose-golden-manifest.json",
  proseFragmentsRef: "../../candidates/e5-prose-fragments.json",
  citationOccurrencesRef: "../../candidates/e5-prose-citation-occurrences.json",
  annotationSchemaRef: "annotation.schema.json",
  primaryAnnotationRef: "annotations/annotator-a.json",
  secondaryAnnotationRef: "annotations/annotator-b.json",
  adjudicatedAnnotationRef: "adjudication/adjudicated.json",
  metricsRef: "metrics.json",
  fragmentCount: allManifestIds.length,
  perCorpusFile: { F2: 50, F3: 50 },
  doubleAnnotatedFragmentCount: doubleSelection.fragmentIds.length,
  multipleCitationFragmentCount: multipleCitationFragments,
  sourceArtifactHashes: {
    selectionManifest: sha256(
      await readFile(path.join(root, "candidates", "e5-prose-golden-manifest.json"), "utf8")
    ),
    proseFragments: sha256(
      await readFile(path.join(root, "candidates", "e5-prose-fragments.json"), "utf8")
    ),
    citationOccurrences: sha256(
      await readFile(
        path.join(root, "candidates", "e5-prose-citation-occurrences.json"),
        "utf8"
      )
    )
  },
  benchmarkDimensions: [
    "claim_precision",
    "claim_recall",
    "claim_f1",
    "exact_or_near_match_granularity",
    "span_support_correctness",
    "citation_precision",
    "citation_recall",
    "knowledge_type_accuracy",
    "epistemic_status_accuracy",
    "zero_claim_accuracy",
    "hallucination_rate",
    "unsupported_inference_rate",
    "clinical_overreach_rate"
  ],
  designReviewFindings: [
    `The fixed P0 manifest contains ${multipleCitationFragments} fragments with multiple CitationOccurrences, below the Design Review target of 15; the selection was not changed after P0.`,
    "Coordinated predicates with one shared subject can be impossible to split atomically while keeping every rawStatement autonomous and verbatim.",
    "Grouped terminal citations can preserve the claim while leaving individual claim-to-occurrence attribution UNRESOLVED."
  ]
};
await writeFile(path.join(goldenRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(
  `Built E5 GOLD: A=${primary.length}, B=${secondary.length}, finalClaims=${global.claimCount}, decisions=${disagreementDocument.totalDecisionCount}`
);
