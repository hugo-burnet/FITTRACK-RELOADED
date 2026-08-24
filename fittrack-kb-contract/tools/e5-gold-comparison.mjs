function stable(value) {
  return JSON.stringify(value, Object.keys(value ?? {}).sort());
}

function claimSpanSignature(claim) {
  return claim.supportSpans
    .map((span) => `${span.relativeStartByte}:${span.relativeEndByte}`)
    .join("+");
}

function sorted(values) {
  return [...values].sort();
}

function unresolvedSignature(annotation) {
  const fragmentUnresolved = ["unresolved", "needs_adjudication"].includes(annotation.annotationStatus);
  const claimUnresolved = annotation.expectedClaims.some((claim) =>
    Object.values(claim.axisResolution).some((axis) => axis.state === "UNRESOLVED")
  );
  return { fragmentUnresolved, claimUnresolved };
}

export function disagreementDimensions(left, right) {
  const dimensions = [];
  if (left.expectedClaims.length !== right.expectedClaims.length) dimensions.push("claim_count");
  if (
    (left.annotationStatus === "zero_claim") !==
    (right.annotationStatus === "zero_claim")
  ) {
    dimensions.push("zero_claim");
  }

  const leftSpans = sorted(left.expectedClaims.map(claimSpanSignature));
  const rightSpans = sorted(right.expectedClaims.map(claimSpanSignature));
  if (stable(leftSpans) !== stable(rightSpans)) dimensions.push("spans_and_granularity");

  const leftCitations = sorted(
    left.expectedClaims.map((claim) => sorted(claim.citationOccurrenceIds).join("+"))
  );
  const rightCitations = sorted(
    right.expectedClaims.map((claim) => sorted(claim.citationOccurrenceIds).join("+"))
  );
  if (stable(leftCitations) !== stable(rightCitations)) dimensions.push("citation_attribution");

  const leftTypes = sorted(left.expectedClaims.map((claim) => claim.knowledgeType ?? "UNRESOLVED"));
  const rightTypes = sorted(right.expectedClaims.map((claim) => claim.knowledgeType ?? "UNRESOLVED"));
  if (stable(leftTypes) !== stable(rightTypes)) dimensions.push("knowledge_type");

  const leftStatuses = sorted(
    left.expectedClaims.map((claim) => claim.epistemicStatus ?? "UNRESOLVED")
  );
  const rightStatuses = sorted(
    right.expectedClaims.map((claim) => claim.epistemicStatus ?? "UNRESOLVED")
  );
  if (stable(leftStatuses) !== stable(rightStatuses)) dimensions.push("epistemic_status");

  if (stable(unresolvedSignature(left)) !== stable(unresolvedSignature(right))) {
    dimensions.push("unresolved");
  }
  return dimensions;
}

function spanBounds(claim) {
  return {
    start: Math.min(...claim.supportSpans.map((span) => span.relativeStartByte)),
    end: Math.max(...claim.supportSpans.map((span) => span.relativeEndByte))
  };
}

function overlapScore(left, right) {
  const a = spanBounds(left);
  const b = spanBounds(right);
  const intersection = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
  if (!intersection) return 0;
  return intersection / Math.max(a.end - a.start, b.end - b.start);
}

export function alignClaims(leftClaims, rightClaims) {
  const candidates = [];
  for (let leftIndex = 0; leftIndex < leftClaims.length; leftIndex += 1) {
    for (let rightIndex = 0; rightIndex < rightClaims.length; rightIndex += 1) {
      const score = overlapScore(leftClaims[leftIndex], rightClaims[rightIndex]);
      if (score > 0) candidates.push({ leftIndex, rightIndex, score });
    }
  }
  candidates.sort(
    (a, b) =>
      b.score - a.score || a.leftIndex - b.leftIndex || a.rightIndex - b.rightIndex
  );
  const usedLeft = new Set();
  const usedRight = new Set();
  const pairs = [];
  for (const candidate of candidates) {
    if (usedLeft.has(candidate.leftIndex) || usedRight.has(candidate.rightIndex)) continue;
    usedLeft.add(candidate.leftIndex);
    usedRight.add(candidate.rightIndex);
    pairs.push(candidate);
  }
  return pairs;
}

function divide(numerator, denominator) {
  return denominator ? numerator / denominator : null;
}

export function doubleAnnotationMetrics(primaryAnnotations, secondaryAnnotations) {
  const primaryById = new Map(primaryAnnotations.map((annotation) => [annotation.fragmentId, annotation]));
  let exactClaimCount = 0;
  let absoluteClaimDifference = 0;
  let zeroComparable = 0;
  let zeroAgreement = 0;
  let alignedClaims = 0;
  let spanAgreement = 0;
  let knowledgeTypeComparable = 0;
  let knowledgeTypeAgreement = 0;
  let epistemicComparable = 0;
  let epistemicAgreement = 0;
  let citationAgreement = 0;
  const disagreements = [];

  for (const secondary of secondaryAnnotations) {
    const primary = primaryById.get(secondary.fragmentId);
    const dimensions = disagreementDimensions(primary, secondary);
    if (dimensions.length) disagreements.push({ fragmentId: secondary.fragmentId, dimensions });

    const primaryCount = primary.expectedClaims.length;
    const secondaryCount = secondary.expectedClaims.length;
    if (primaryCount === secondaryCount) exactClaimCount += 1;
    absoluteClaimDifference += Math.abs(primaryCount - secondaryCount);

    const primaryZero = primary.annotationStatus === "zero_claim";
    const secondaryZero = secondary.annotationStatus === "zero_claim";
    if (primaryZero || secondaryZero) {
      zeroComparable += 1;
      if (primaryZero === secondaryZero) zeroAgreement += 1;
    }

    for (const pair of alignClaims(primary.expectedClaims, secondary.expectedClaims)) {
      alignedClaims += 1;
      const left = primary.expectedClaims[pair.leftIndex];
      const right = secondary.expectedClaims[pair.rightIndex];
      if (claimSpanSignature(left) === claimSpanSignature(right)) spanAgreement += 1;
      if (left.knowledgeType !== undefined && right.knowledgeType !== undefined) {
        knowledgeTypeComparable += 1;
        if (left.knowledgeType === right.knowledgeType) knowledgeTypeAgreement += 1;
      }
      if (left.epistemicStatus !== undefined && right.epistemicStatus !== undefined) {
        epistemicComparable += 1;
        if (left.epistemicStatus === right.epistemicStatus) epistemicAgreement += 1;
      }
      if (
        stable(sorted(left.citationOccurrenceIds)) ===
        stable(sorted(right.citationOccurrenceIds))
      ) {
        citationAgreement += 1;
      }
    }
  }

  return {
    fragmentCount: secondaryAnnotations.length,
    exactClaimCountAgreement: divide(exactClaimCount, secondaryAnnotations.length),
    exactClaimCountAgreementFragments: exactClaimCount,
    meanAbsoluteClaimCountDifference: divide(absoluteClaimDifference, secondaryAnnotations.length),
    zeroClaimAgreement: divide(zeroAgreement, zeroComparable),
    zeroClaimComparableFragments: zeroComparable,
    alignedClaimCount: alignedClaims,
    exactSpanAgreement: divide(spanAgreement, alignedClaims),
    knowledgeTypeAgreement: divide(knowledgeTypeAgreement, knowledgeTypeComparable),
    knowledgeTypeComparableClaims: knowledgeTypeComparable,
    epistemicStatusAgreement: divide(epistemicAgreement, epistemicComparable),
    epistemicStatusComparableClaims: epistemicComparable,
    citationAttributionAgreement: divide(citationAgreement, alignedClaims),
    disagreementFragmentCount: disagreements.length,
    disagreementDimensionCounts: Object.fromEntries(
      [
        "claim_count",
        "spans_and_granularity",
        "citation_attribution",
        "knowledge_type",
        "epistemic_status",
        "zero_claim",
        "unresolved"
      ].map((dimension) => [
        dimension,
        disagreements.filter((item) => item.dimensions.includes(dimension)).length
      ])
    ),
    disagreements
  };
}
