export const PROVIDER_DTO_VERSION = 'e5-provider-prediction-v2';
export const ANCHOR_REPAIR_DTO_VERSION = 'e5-provider-anchor-repair-v1';

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function requiredObject(properties, extra = {}) {
  return {
    type: 'object',
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
    ...extra
  };
}

function enumSchema(values, { nullable = false } = {}) {
  const nonNull = values.filter((value) => value !== null);
  if (!nonNull.length || !nonNull.every((value) => typeof value === 'string')) {
    throw new ProviderDtoError('provider_dto_vocab_must_be_string_enum', {
      code: 'PROVIDER_DTO_VOCAB_INVALID'
    });
  }
  const enumValues = nullable ? [...nonNull, null] : nonNull;
  return {
    type: nullable ? ['string', 'null'] : 'string',
    enum: enumValues
  };
}

function nullableString() {
  return { type: ['string', 'null'] };
}

function stringArray(items = { type: 'string' }, extra = {}) {
  return { type: 'array', items, ...extra };
}

function canonicalEnums(canonicalSchema) {
  const defs = canonicalSchema?.$defs;
  const claim = defs?.claim?.properties;
  const assessment = defs?.assessmentDraft?.properties;
  if (!defs || !claim || !assessment) {
    throw new ProviderDtoError('canonical_prediction_schema_shape_unsupported', {
      code: 'CANONICAL_SCHEMA_SHAPE_UNSUPPORTED'
    });
  }
  return {
    annotationPrediction: canonicalSchema.properties.annotationPrediction.enum,
    resolutionState: defs.resolutionState.enum,
    domain: claim.domain.enum,
    knowledgeType: defs.knowledgeTypeResolution.properties.value.enum,
    epistemicStatus: defs.epistemicStatusResolution.properties.value.enum,
    confidenceAspect:
      defs.confidenceResolution.properties.value.items.properties.aspect.enum,
    confidenceLevel:
      defs.confidenceResolution.properties.value.items.properties.confidence.enum,
    directness: defs.directnessResolution.properties.value.enum,
    evidenceType: defs.evidenceTypesResolution.properties.value.items.enum,
    clinicalEvidenceLevel: assessment.clinicalEvidenceLevel.enum,
    citationAttributionState: claim.citationAttributionState.enum,
    flags: claim.flags.items.enum
  };
}

// Deep module interface: derive a transport-only schema from the canonical
// vocabularies while keeping every transport node shallow enough for Azure.
export function createE5ProviderPredictionSchema(canonicalSchema) {
  const vocab = canonicalEnums(canonicalSchema);
  const resolutionState = enumSchema(vocab.resolutionState);
  const claim = requiredObject({
    supportAnchors: stringArray({ type: 'string', minLength: 1 }, { minItems: 1, maxItems: 6 }),
    rawStatementAnchorIndex: { type: 'integer', minimum: 0 },
    domain: enumSchema(vocab.domain),
    knowledgeTypeState: cloneJson(resolutionState),
    knowledgeType: enumSchema(vocab.knowledgeType, { nullable: true }),
    knowledgeTypeReason: nullableString(),
    epistemicStatusState: cloneJson(resolutionState),
    epistemicStatus: enumSchema(vocab.epistemicStatus, { nullable: true }),
    epistemicStatusReason: nullableString(),
    confidenceState: cloneJson(resolutionState),
    confidenceAspects: {
      type: ['array', 'null'],
      items: enumSchema(vocab.confidenceAspect)
    },
    confidenceLevels: {
      type: ['array', 'null'],
      items: enumSchema(vocab.confidenceLevel)
    },
    confidenceRationales: {
      type: ['array', 'null'],
      items: nullableString()
    },
    confidenceRaw: nullableString(),
    confidenceReason: nullableString(),
    directnessState: cloneJson(resolutionState),
    directness: enumSchema(vocab.directness, { nullable: true }),
    directnessReason: nullableString(),
    evidenceTypesState: cloneJson(resolutionState),
    evidenceTypes: {
      type: ['array', 'null'],
      items: enumSchema(vocab.evidenceType),
      uniqueItems: true
    },
    evidenceTypesReason: nullableString(),
    clinicalEvidenceLevel: enumSchema(vocab.clinicalEvidenceLevel, { nullable: true }),
    supportsHypertrophySuperiority: { type: 'boolean' },
    supportsDemonstratedClinicalRisk: { type: 'boolean' },
    citationOccurrenceRefs: stringArray({
      type: 'string',
      pattern: '^cand\\.e5-citation\\.[0-9a-f]{16}$'
    }, { uniqueItems: true }),
    citationAttributionState: enumSchema(vocab.citationAttributionState),
    conditions: stringArray({ type: 'string', minLength: 1 }),
    limitations: stringArray({ type: 'string', minLength: 1 }),
    cannotConclude: stringArray({ type: 'string', minLength: 1 }),
    unresolved: stringArray({ type: 'string', minLength: 1 }),
    flags: stringArray(enumSchema(vocab.flags), { uniqueItems: true })
  });
  return requiredObject({
    annotationPrediction: enumSchema(vocab.annotationPrediction),
    claims: {
      type: 'array',
      maxItems: 20,
      items: { $ref: '#/$defs/claim' }
    }
  }, {
    $defs: { claim }
  });
}

// Repair responses cannot rewrite claims or classifications: their interface
// contains only the replacement anchors for explicitly identified claims.
export function createE5AnchorRepairSchema() {
  const repair = requiredObject({
    claimIndex: { type: 'integer', minimum: 0 },
    supportAnchors: stringArray({ type: 'string', minLength: 1 }, { minItems: 1, maxItems: 6 }),
    rawStatementAnchorIndex: { type: 'integer', minimum: 0 }
  });
  return requiredObject({
    repairs: {
      type: 'array',
      minItems: 1,
      maxItems: 20,
      items: { $ref: '#/$defs/repair' }
    }
  }, {
    $defs: { repair }
  });
}

export function mergeAnchorRepairs(providerPrediction, repairPrediction, repairableClaimIndexes) {
  const expected = new Set(repairableClaimIndexes);
  const seen = new Set();
  const merged = cloneJson(providerPrediction);
  for (const repair of repairPrediction.repairs) {
    if (!expected.has(repair.claimIndex) || seen.has(repair.claimIndex)) {
      throw new ProviderDtoError('anchor_repair_scope_invalid', {
        code: 'ANCHOR_REPAIR_SCOPE_INVALID',
        claimIndex: repair.claimIndex
      });
    }
    if (repair.rawStatementAnchorIndex >= repair.supportAnchors.length) {
      throw new ProviderDtoError('anchor_repair_raw_statement_index_invalid', {
        code: 'PROVIDER_ANCHOR_INDEX_INVALID',
        claimIndex: repair.claimIndex
      });
    }
    seen.add(repair.claimIndex);
    merged.claims[repair.claimIndex].supportAnchors = [...repair.supportAnchors];
    merged.claims[repair.claimIndex].rawStatementAnchorIndex = repair.rawStatementAnchorIndex;
  }
  if (seen.size !== expected.size) {
    throw new ProviderDtoError('anchor_repair_claim_missing', {
      code: 'ANCHOR_REPAIR_SCOPE_INVALID',
      expectedClaimIndexes: [...expected],
      actualClaimIndexes: [...seen]
    });
  }
  return merged;
}

function expectedHierarchy(fragment) {
  if (fragment.corpusFileId.startsWith('corpus.f2.')) return 'biomechanics';
  if (fragment.corpusFileId.startsWith('corpus.f3.')) return 'clinical';
  throw new ProviderDtoError('provider_dto_fragment_corpus_unsupported', {
    code: 'FRAGMENT_CORPUS_UNSUPPORTED',
    fragmentId: fragment.fragmentId
  });
}

function occurrencesOf(text, needle) {
  const positions = [];
  let from = 0;
  while (needle && from <= text.length) {
    const index = text.indexOf(needle, from);
    if (index === -1) break;
    positions.push(index);
    from = index + 1;
  }
  return positions;
}

function byteOffset(text, charIndex) {
  return Buffer.byteLength(text.slice(0, charIndex), 'utf8');
}

function assertCanonicalSpanIsUnique(fragment, span, path) {
  const positions = occurrencesOf(fragment.rawText, span.text);
  if (positions.length !== 1 || span.occurrence !== 1) {
    throw new ProviderDtoError('canonical_span_cannot_be_located', {
      code: positions.length > 1 ? 'AMBIGUOUS_SUPPORT_ANCHOR' : 'CANONICAL_SPAN_INVALID',
      path,
      occurrenceCount: positions.length
    });
  }
  return span.text;
}

function resolveUniqueAnchor(fragment, anchor, path, claimIndex, anchorIndex) {
  const positions = occurrencesOf(fragment.rawText, anchor);
  if (positions.length === 0) {
    throw new ProviderDtoError('support_anchor_not_found', {
      code: 'ANCHOR_NOT_FOUND',
      path,
      claimIndex,
      anchorIndex,
      anchor
    });
  }
  if (positions.length > 1) {
    throw new ProviderDtoError('support_anchor_is_ambiguous', {
      code: 'AMBIGUOUS_SUPPORT_ANCHOR',
      path,
      claimIndex,
      anchorIndex,
      anchor,
      occurrenceCount: positions.length
    });
  }
  const charStart = positions[0];
  const relativeStartByte = byteOffset(fragment.rawText, charStart);
  const relativeEndByte = relativeStartByte + Buffer.byteLength(anchor, 'utf8');
  const reread = Buffer.from(fragment.rawText, 'utf8')
    .subarray(relativeStartByte, relativeEndByte)
    .toString('utf8');
  if (reread !== anchor) {
    throw new ProviderDtoError('support_anchor_utf8_reread_failed', {
      code: 'ANCHOR_NOT_FOUND',
      path,
      claimIndex,
      anchorIndex,
      anchor
    });
  }
  return {
    span: { text: anchor, occurrence: 1 },
    relativeStartByte,
    relativeEndByte
  };
}

function assertParallelArrays(values, path, { nullable = false } = {}) {
  const nullCount = values.filter((value) => value === null).length;
  if (nullable && nullCount === values.length) return;
  if (nullCount > 0 || !values.every(Array.isArray)) {
    throw new ProviderDtoError('provider_parallel_arrays_nullability_mismatch', {
      code: 'PROVIDER_PARALLEL_ARRAYS_INVALID',
      path
    });
  }
  const lengths = values.map((value) => value.length);
  if (!lengths.every((length) => length === lengths[0])) {
    throw new ProviderDtoError('provider_parallel_arrays_length_mismatch', {
      code: 'PROVIDER_PARALLEL_ARRAYS_INVALID',
      path,
      lengths
    });
  }
}

function resolution(state, value, reason) {
  return { state, value, reason };
}

// Deep module interface: reconstruct the canonical raw prediction using only
// provider data plus deterministic fragment/catalog context.
export function providerPredictionToCanonical(providerPrediction, fragment, citationCatalog) {
  const knownCitations = new Set(citationCatalog.map((item) => item.candidateId));
  const anchorDiagnostics = [];
  const resolvedClaims = providerPrediction.claims.map((claim, claimIndex) => {
    const path = `#/claims/${claimIndex}`;
    const resolvedAnchors = claim.supportAnchors.map((anchor, anchorIndex) => {
      try {
        return resolveUniqueAnchor(
          fragment,
          anchor,
          `${path}/supportAnchors/${anchorIndex}`,
          claimIndex,
          anchorIndex
        );
      } catch (error) {
        if (error instanceof ProviderDtoError) {
          anchorDiagnostics.push(error.providerDtoDiagnostic);
          return null;
        }
        throw error;
      }
    });
    if (
      !Number.isInteger(claim.rawStatementAnchorIndex) ||
      claim.rawStatementAnchorIndex < 0 ||
      claim.rawStatementAnchorIndex >= resolvedAnchors.length
    ) {
      throw new ProviderDtoError('provider_raw_statement_anchor_index_invalid', {
        code: 'PROVIDER_ANCHOR_INDEX_INVALID',
        path: `${path}/rawStatementAnchorIndex`,
        claimIndex
      });
    }
    if (resolvedAnchors.some((item) => item === null)) return null;
    const rawStatement = resolvedAnchors[claim.rawStatementAnchorIndex].span.text;
    const ordered = [...resolvedAnchors].sort(
      (left, right) => left.relativeStartByte - right.relativeStartByte
    );
    for (let anchorIndex = 1; anchorIndex < ordered.length; anchorIndex += 1) {
      if (ordered[anchorIndex].relativeStartByte < ordered[anchorIndex - 1].relativeEndByte) {
        throw new ProviderDtoError('support_anchors_overlap', {
          code: 'OVERLAPPING_SUPPORT_ANCHORS',
          path: `${path}/supportAnchors`,
          claimIndex
        });
      }
    }
    return { supportSpans: ordered.map((item) => item.span), rawStatement };
  });
  if (anchorDiagnostics.length > 0) {
    throw new ProviderDtoError('provider_anchor_resolution_failed', {
      code: 'ANCHOR_RESOLUTION_FAILED',
      diagnostics: anchorDiagnostics
    });
  }
  const claims = providerPrediction.claims.map((claim, claimIndex) => {
    const path = `#/claims/${claimIndex}`;
    const { supportSpans, rawStatement } = resolvedClaims[claimIndex];
    assertParallelArrays(
      [claim.confidenceAspects, claim.confidenceLevels, claim.confidenceRationales],
      `${path}/confidenceByAspect`,
      { nullable: true }
    );
    for (const citationId of claim.citationOccurrenceRefs) {
      if (!knownCitations.has(citationId)) {
        throw new ProviderDtoError('provider_citation_not_in_closed_catalog', {
          code: 'INVENTED_CITATION',
          path: `${path}/citationOccurrenceRefs`,
          citationId
        });
      }
    }
    const confidenceValue = claim.confidenceAspects === null
      ? null
      : claim.confidenceAspects.map((aspect, index) => ({
          aspect,
          confidence: claim.confidenceLevels[index],
          rationale: claim.confidenceRationales[index]
        }));
    return {
      technicalClaimRef: `tmp.claim.${String(claimIndex + 1).padStart(2, '0')}`,
      rawStatement,
      supportSpans,
      domain: claim.domain,
      knowledgeType: resolution(
        claim.knowledgeTypeState,
        claim.knowledgeType,
        claim.knowledgeTypeReason
      ),
      epistemicStatus: resolution(
        claim.epistemicStatusState,
        claim.epistemicStatus,
        claim.epistemicStatusReason
      ),
      assessmentDraft: {
        confidenceByAspect: {
          state: claim.confidenceState,
          value: confidenceValue,
          raw: claim.confidenceRaw,
          reason: claim.confidenceReason
        },
        directness: resolution(
          claim.directnessState,
          claim.directness,
          claim.directnessReason
        ),
        evidenceTypes: resolution(
          claim.evidenceTypesState,
          claim.evidenceTypes,
          claim.evidenceTypesReason
        ),
        clinicalEvidenceLevel: claim.clinicalEvidenceLevel,
        hierarchyHint: expectedHierarchy(fragment),
        supportsHypertrophySuperiority: claim.supportsHypertrophySuperiority,
        supportsDemonstratedClinicalRisk: claim.supportsDemonstratedClinicalRisk
      },
      citationOccurrenceRefs: [...claim.citationOccurrenceRefs],
      citationAttributionState: claim.citationAttributionState,
      conditions: [...claim.conditions],
      limitations: [...claim.limitations],
      cannotConclude: [...claim.cannotConclude],
      unresolved: [...claim.unresolved],
      flags: [...claim.flags]
    };
  });
  return {
    fragmentId: fragment.fragmentId,
    annotationPrediction: providerPrediction.annotationPrediction,
    claims
  };
}

// Offline-only inverse used by structural round-trip tests. Inference never
// calls this function and never receives GOLD data.
export function canonicalPredictionToProvider(canonicalPrediction, fragment) {
  if (canonicalPrediction.fragmentId !== fragment.fragmentId) {
    throw new ProviderDtoError('canonical_fragment_id_mismatch', {
      code: 'CANONICAL_FRAGMENT_ID_MISMATCH'
    });
  }
  return {
    annotationPrediction: canonicalPrediction.annotationPrediction,
    claims: canonicalPrediction.claims.map((claim, claimIndex) => {
      const expectedRef = `tmp.claim.${String(claimIndex + 1).padStart(2, '0')}`;
      if (claim.technicalClaimRef !== expectedRef) {
        throw new ProviderDtoError('canonical_technical_ref_not_deterministic', {
          code: 'CANONICAL_TECHNICAL_REF_INVALID',
          claimIndex
        });
      }
      const supportAnchors = claim.supportSpans.map((span, spanIndex) =>
        assertCanonicalSpanIsUnique(fragment, span, `#/claims/${claimIndex}/supportSpans/${spanIndex}`)
      );
      const rawStatementAnchorIndex = claim.supportSpans.findIndex(
        (span) => span.text === claim.rawStatement
      );
      if (rawStatementAnchorIndex === -1) {
        throw new ProviderDtoError('canonical_raw_statement_has_no_span', {
          code: 'CANONICAL_SPAN_INVALID',
          claimIndex
        });
      }
      const confidence = claim.assessmentDraft.confidenceByAspect.value;
      return {
        supportAnchors,
        rawStatementAnchorIndex,
        domain: claim.domain,
        knowledgeTypeState: claim.knowledgeType.state,
        knowledgeType: claim.knowledgeType.value,
        knowledgeTypeReason: claim.knowledgeType.reason,
        epistemicStatusState: claim.epistemicStatus.state,
        epistemicStatus: claim.epistemicStatus.value,
        epistemicStatusReason: claim.epistemicStatus.reason,
        confidenceState: claim.assessmentDraft.confidenceByAspect.state,
        confidenceAspects: confidence === null ? null : confidence.map((item) => item.aspect),
        confidenceLevels: confidence === null ? null : confidence.map((item) => item.confidence),
        confidenceRationales: confidence === null ? null : confidence.map((item) => item.rationale),
        confidenceRaw: claim.assessmentDraft.confidenceByAspect.raw,
        confidenceReason: claim.assessmentDraft.confidenceByAspect.reason,
        directnessState: claim.assessmentDraft.directness.state,
        directness: claim.assessmentDraft.directness.value,
        directnessReason: claim.assessmentDraft.directness.reason,
        evidenceTypesState: claim.assessmentDraft.evidenceTypes.state,
        evidenceTypes: cloneJson(claim.assessmentDraft.evidenceTypes.value),
        evidenceTypesReason: claim.assessmentDraft.evidenceTypes.reason,
        clinicalEvidenceLevel: claim.assessmentDraft.clinicalEvidenceLevel,
        supportsHypertrophySuperiority: claim.assessmentDraft.supportsHypertrophySuperiority,
        supportsDemonstratedClinicalRisk: claim.assessmentDraft.supportsDemonstratedClinicalRisk,
        citationOccurrenceRefs: [...claim.citationOccurrenceRefs],
        citationAttributionState: claim.citationAttributionState,
        conditions: [...claim.conditions],
        limitations: [...claim.limitations],
        cannotConclude: [...claim.cannotConclude],
        unresolved: [...claim.unresolved],
        flags: [...claim.flags]
      };
    })
  };
}

export class ProviderDtoError extends Error {
  constructor(message, diagnostic) {
    super(message);
    this.name = 'ProviderDtoError';
    this.providerDtoDiagnostic = diagnostic;
  }
}
