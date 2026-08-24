function cloneClaims(claims) {
  return structuredClone(claims);
}

function isExpertPracticeDefault(claim) {
  return (
    claim.knowledgeType?.state === 'RESOLVED' &&
    claim.knowledgeType.value === 'EXPERT_PRACTICE' &&
    claim.epistemicStatus?.state === 'UNRESOLVED' &&
    claim.epistemicStatus.value === null
  );
}

function citationRange(citation) {
  const start = citation.payload?.relativeStartByte;
  const end = citation.payload?.relativeEndByte;
  return Number.isInteger(start) && Number.isInteger(end) && start < end ? { start, end } : null;
}

function isContainedIn(unit, range) {
  return unit.relativeStartByte <= range.start && range.end <= unit.relativeEndByte;
}

function claimsForUnit(claims, unitIndex) {
  return claims.filter(
    (claim) =>
      Array.isArray(claim.coverageUnitIndexes) &&
      claim.coverageUnitIndexes.length === 1 &&
      claim.coverageUnitIndexes[0] === unitIndex
  );
}

function citationsForUnit(citationCatalog, fragmentId, unit) {
  return citationCatalog.filter((citation) => {
    const range = citationRange(citation);
    return citation.fragmentRef === fragmentId && range !== null && isContainedIn(unit, range);
  });
}

/**
 * Applies only the two E5 v0.4 deterministic resolutions after local claim
 * validation. It neither interprets evidence nor expands the citation catalog.
 */
export function postprocessClaims({ claims, fragment, citationCatalog, coverageUnits }) {
  const resolvedClaims = cloneClaims(claims);
  const resolutions = [];

  for (const claim of resolvedClaims) {
    if (!isExpertPracticeDefault(claim)) continue;
    claim.epistemicStatus = {
      state: 'RESOLVED',
      value: 'practice_only',
      reason: 'deterministic_expert_practice_default'
    };
    resolutions.push({
      technicalClaimRef: claim.technicalClaimRef,
      axis: 'epistemicStatus',
      reason: 'deterministic_expert_practice_default'
    });
  }

  for (const unit of coverageUnits) {
    if (unit.kind !== 'SENTENCE') continue;
    const localClaims = claimsForUnit(resolvedClaims, unit.unitIndex);
    const localCitations = citationsForUnit(citationCatalog, fragment.fragmentId, unit);
    if (localClaims.length !== 1 || localCitations.length !== 1) continue;

    const [claim] = localClaims;
    const [citation] = localCitations;
    if (claim.citationOccurrenceRefs.length !== 0) continue;

    claim.citationOccurrenceRefs = [citation.candidateId];
    claim.citationAttributionState = 'ATTACHED';
    resolutions.push({
      technicalClaimRef: claim.technicalClaimRef,
      axis: 'citationOccurrenceRefs',
      citationOccurrenceRef: citation.candidateId,
      reason: 'deterministic_unique_local_citation'
    });
  }

  return { claims: resolvedClaims, resolutions, diagnostics: [] };
}
