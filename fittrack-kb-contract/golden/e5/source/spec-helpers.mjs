export function claim(rawStatement, options = {}) {
  return { rawStatement, ...options };
}

export function annotated(fragmentId, claims, options = {}) {
  return {
    fragmentId,
    annotationStatus: "annotated",
    claims,
    ...options
  };
}

export function zeroClaim(fragmentId, zeroClaimReason, options = {}) {
  return {
    fragmentId,
    annotationStatus: "zero_claim",
    claims: [],
    zeroClaimReason,
    ...options
  };
}

export function needsAdjudication(fragmentId, claims, ambiguities, options = {}) {
  return {
    fragmentId,
    annotationStatus: "needs_adjudication",
    claims,
    ambiguities,
    ...options
  };
}

export function unresolved(fragmentId, ambiguities, options = {}) {
  return {
    fragmentId,
    annotationStatus: "unresolved",
    claims: [],
    ambiguities,
    ...options
  };
}
