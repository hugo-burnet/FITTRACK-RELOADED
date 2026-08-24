#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { doubleAnnotationMetrics } from "./e5-gold-comparison.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
}

function walk(directory, predicate) {
  const output = [];
  for (const entry of readdirSync(directory)) {
    const target = path.join(directory, entry);
    if (statSync(target).isDirectory()) output.push(...walk(target, predicate));
    else if (predicate(entry)) output.push(target);
  }
  return output.sort();
}

function stable(value) {
  return JSON.stringify(value);
}

export function validateE5Gold() {
  const errors = [];
  const fail = (message) => errors.push(message);
  const fragmentsDocument = readJson("candidates/e5-prose-fragments.json");
  const citationsDocument = readJson("candidates/e5-prose-citation-occurrences.json");
  const selectionManifest = readJson("candidates/e5-prose-golden-manifest.json");
  const doubleSelection = readJson("golden/e5/source/double-annotation-fragments.json");
  const primary = readJson("golden/e5/annotations/annotator-a.json");
  const secondary = readJson("golden/e5/annotations/annotator-b.json");
  const adjudicated = readJson("golden/e5/adjudication/adjudicated.json");
  const adjudication = readJson("golden/e5/adjudication/disagreements.json");
  const finalManifest = readJson("golden/e5/manifest.json");
  const metrics = readJson("golden/e5/metrics.json");

  const fragmentById = new Map(
    fragmentsDocument.fragments.map((fragment) => [fragment.fragmentId, fragment])
  );
  const citationById = new Map(
    citationsDocument.candidates.map((citation) => [citation.candidateId, citation])
  );
  const manifestIds = selectionManifest.fragments.map((fragment) => fragment.fragmentId);
  const manifestOrder = new Map(manifestIds.map((id, index) => [id, index]));

  const ajv = new Ajv2020({ strict: false, allErrors: true, allowUnionTypes: true });
  addFormats(ajv);
  const schemaPaths = [
    ...walk(path.join(root, "schemas"), (name) => name.endsWith(".schema.json")),
    ...walk(path.join(root, "extraction-contract"), (name) => name.endsWith(".schema.json")),
    path.join(root, "golden", "e5", "annotation.schema.json")
  ];
  for (const schemaPath of schemaPaths) {
    const schema = JSON.parse(readFileSync(schemaPath, "utf8"));
    ajv.addSchema(schema, schema.$id);
  }
  const validateAnnotation = ajv.getSchema(
    "https://fittrack.local/kb/golden/e5/annotation.schema.json"
  );
  for (const [label, document] of [
    ["annotator_A", primary],
    ["annotator_B", secondary],
    ["adjudicated", adjudicated]
  ]) {
    if (!validateAnnotation(document)) {
      fail(`${label} schema: ${ajv.errorsText(validateAnnotation.errors, { separator: " | " })}`);
    }
  }

  function validateCoverage(label, annotations, expectedIds) {
    const ids = annotations.map((annotation) => annotation.fragmentId);
    if (new Set(ids).size !== ids.length) fail(`${label}: duplicate fragmentId`);
    if (stable(ids) !== stable(expectedIds)) fail(`${label}: incomplete or unstable fragment order`);
  }

  validateCoverage("annotator_A", primary.annotations, manifestIds);
  validateCoverage("annotator_B", secondary.annotations, doubleSelection.fragmentIds);
  validateCoverage("adjudicated", adjudicated.annotations, manifestIds);
  if (primary.annotations.length !== 100) fail(`annotator_A: expected 100 fragments`);
  if (secondary.annotations.length < 25) fail(`annotator_B: expected at least 25 fragments`);
  if (adjudicated.annotations.length !== 100) fail(`adjudicated: expected 100 fragments`);

  for (const [label, document] of [
    ["annotator_A", primary],
    ["annotator_B", secondary],
    ["adjudicated", adjudicated]
  ]) {
    const goldenIds = new Set();
    for (const annotation of document.annotations) {
      const fragment = fragmentById.get(annotation.fragmentId);
      if (!fragment) {
        fail(`${label}/${annotation.fragmentId}: unknown fragment`);
        continue;
      }
      const fragmentBytes = Buffer.from(fragment.rawText, "utf8");
      if (fragment.startByte + fragmentBytes.length !== fragment.endByte) {
        fail(`${label}/${annotation.fragmentId}: P0 fragment byte bounds mismatch`);
      }
      if (
        annotation.annotationStatus === "needs_adjudication" &&
        label === "adjudicated"
      ) {
        fail(`${label}/${annotation.fragmentId}: needs_adjudication remains after adjudication`);
      }
      for (const claim of annotation.expectedClaims) {
        if (goldenIds.has(claim.goldenClaimId)) {
          fail(`${label}: duplicate goldenClaimId ${claim.goldenClaimId}`);
        }
        goldenIds.add(claim.goldenClaimId);
        if (!claim.supportSpans.some((span) => span.text === claim.rawStatement)) {
          fail(`${label}/${claim.goldenClaimId}: rawStatement is not an exact support span`);
        }
        let previousEnd = -1;
        for (const span of claim.supportSpans) {
          if (span.relativeStartByte < 0 || span.relativeEndByte > fragmentBytes.length) {
            fail(`${label}/${claim.goldenClaimId}: support span outside fragment`);
            continue;
          }
          const reread = fragmentBytes
            .subarray(span.relativeStartByte, span.relativeEndByte)
            .toString("utf8");
          if (reread !== span.text) fail(`${label}/${claim.goldenClaimId}: span text mismatch`);
          if (span.absoluteStartByte !== fragment.startByte + span.relativeStartByte) {
            fail(`${label}/${claim.goldenClaimId}: bad absoluteStartByte`);
          }
          if (span.absoluteEndByte !== fragment.startByte + span.relativeEndByte) {
            fail(`${label}/${claim.goldenClaimId}: bad absoluteEndByte`);
          }
          if (span.relativeStartByte < previousEnd) {
            fail(`${label}/${claim.goldenClaimId}: support spans overlap or are not sorted`);
          }
          previousEnd = span.relativeEndByte;
        }
        for (const citationId of claim.citationOccurrenceIds) {
          const citation = citationById.get(citationId);
          if (!citation) fail(`${label}/${claim.goldenClaimId}: invented citation ${citationId}`);
          else if (citation.fragmentRef !== annotation.fragmentId) {
            fail(`${label}/${claim.goldenClaimId}: citation belongs to another fragment`);
          }
        }
        if (
          claim.knowledgeType === "EMG_OBSERVATION" &&
          ["established", "established_direction"].includes(claim.epistemicStatus)
        ) {
          fail(`${label}/${claim.goldenClaimId}: EMG cannot be established`);
        }
        if (
          ["EXPERT_PRACTICE", "HYPOTHESIS"].includes(claim.knowledgeType) &&
          ["established", "established_direction", "probable", "refuted"].includes(
            claim.epistemicStatus
          )
        ) {
          fail(`${label}/${claim.goldenClaimId}: practice/hypothesis status violates claim schema`);
        }
        if (claim.assessment?.directness === "emg_only") {
          if (claim.assessment.supportsHypertrophySuperiority !== false) {
            fail(`${label}/${claim.goldenClaimId}: emg_only must explicitly reject hypertrophy superiority`);
          }
        }
        if (
          ["biomechanical_only", "mechanistic_hypothesis", "animal_model"].includes(
            claim.assessment?.directness
          ) &&
          claim.assessment.supportsDemonstratedClinicalRisk !== false
        ) {
          fail(`${label}/${claim.goldenClaimId}: indirect mechanics must explicitly reject demonstrated clinical risk`);
        }
      }
    }
  }

  const measured = doubleAnnotationMetrics(primary.annotations, secondary.annotations);
  const measuredDisagreementIds = measured.disagreements.map((item) => item.fragmentId);
  const declaredDisagreementIds = adjudication.disagreements.map((item) => item.fragmentId);
  if (stable(measuredDisagreementIds) !== stable(declaredDisagreementIds)) {
    fail(`adjudication: disagreement fragment list is incomplete or unstable`);
  }
  for (let index = 0; index < measured.disagreements.length; index += 1) {
    const measuredItem = measured.disagreements[index];
    const declared = adjudication.disagreements[index];
    if (stable(measuredItem.dimensions) !== stable(declared.dimensions)) {
      fail(`adjudication/${declared.fragmentId}: disagreement dimensions do not match measurement`);
    }
    if (!declared.justification) fail(`adjudication/${declared.fragmentId}: missing justification`);
  }
  if (adjudication.doubleAnnotationDecisionCount !== measured.disagreements.length) {
    fail(`adjudication: doubleAnnotationDecisionCount mismatch`);
  }
  const doubleIds = new Set(doubleSelection.fragmentIds);
  const expectedPrimaryOnlyIds = primary.annotations
    .filter(
      (annotation) =>
        annotation.annotationStatus === "needs_adjudication" && !doubleIds.has(annotation.fragmentId)
    )
    .map((annotation) => annotation.fragmentId);
  const declaredPrimaryOnlyIds = adjudication.primaryOnlyResolutions.map(
    (item) => item.fragmentId
  );
  if (stable(expectedPrimaryOnlyIds) !== stable(declaredPrimaryOnlyIds)) {
    fail(`adjudication: primary-only resolutions are incomplete or unstable`);
  }
  if (
    adjudication.totalDecisionCount !==
    adjudication.doubleAnnotationDecisionCount + adjudication.primaryOnlyResolutionCount
  ) {
    fail(`adjudication: totalDecisionCount mismatch`);
  }

  if (finalManifest.fragmentCount !== 100 || finalManifest.doubleAnnotatedFragmentCount !== 30) {
    fail(`manifest: expected fragment counts 100/30`);
  }
  if (finalManifest.selectionManifestRef !== "../../candidates/e5-prose-golden-manifest.json") {
    fail(`manifest: selectionManifestRef must point to P0 input`);
  }
  if (metrics.global.fragmentCount !== 100) fail(`metrics: global fragment count must be 100`);
  if (metrics.doubleAnnotation.fragmentCount !== secondary.annotations.length) {
    fail(`metrics: double annotation fragment count mismatch`);
  }
  if (
    metrics.doubleAnnotation.decisionCount !== adjudication.disagreements.length ||
    metrics.doubleAnnotation.disagreementFragmentCount !== measured.disagreementFragmentCount
  ) {
    fail(`metrics: adjudication counts mismatch`);
  }

  return {
    ok: errors.length === 0,
    errors,
    counts: {
      primaryFragments: primary.annotations.length,
      secondaryFragments: secondary.annotations.length,
      adjudicatedFragments: adjudicated.annotations.length,
      primaryClaims: primary.annotations.reduce(
        (sum, annotation) => sum + annotation.expectedClaims.length,
        0
      ),
      adjudicatedClaims: adjudicated.annotations.reduce(
        (sum, annotation) => sum + annotation.expectedClaims.length,
        0
      ),
      decisions: adjudication.totalDecisionCount
    }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = validateE5Gold();
  if (!result.ok) {
    for (const error of result.errors) console.error(`FAIL ${error}`);
    process.exitCode = 1;
  } else {
    console.log(`E5-GOLD validation PASS ${JSON.stringify(result.counts)}`);
  }
}
