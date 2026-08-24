export const PROVIDER_DTO_VERSION = 'e5-provider-prediction-v1';

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
    supportSpanStartBytes: stringArray({ type: 'integer', minimum: 0 }, { minItems: 1, maxItems: 6 }),
    supportSpanEndBytes: stringArray({ type: 'integer', minimum: 1 }, { minItems: 1, maxItems: 6 }),
    rawStatementSpanIndex: { type: 'integer', minimum: 0 },
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
    from = index + needle.length;
  }
  return positions;
}

function byteOffset(text, charIndex) {
  return Buffer.byteLength(text.slice(0, charIndex), 'utf8');
}

function canonicalSpanToOffsets(fragment, span, path) {
  const positions = occurrencesOf(fragment.rawText, span.text);
  const charStart = positions[span.occurrence - 1];
  if (charStart === undefined) {
    throw new ProviderDtoError('canonical_span_cannot_be_located', {
      code: 'CANONICAL_SPAN_INVALID',
      path
    });
  }
  const start = byteOffset(fragment.rawText, charStart);
  return [start, start + Buffer.byteLength(span.text, 'utf8')];
}

function offsetsToCanonicalSpan(fragment, start, end, path) {
  const bytes = Buffer.from(fragment.rawText, 'utf8');
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > bytes.length) {
    throw new ProviderDtoError('provider_span_offsets_invalid', {
      code: 'PROVIDER_SPAN_INVALID',
      path,
      start,
      end,
      fragmentByteLength: bytes.length
    });
  }
  const text = bytes.subarray(start, end).toString('utf8');
  if (!text || Buffer.byteLength(text, 'utf8') !== end - start) {
    throw new ProviderDtoError('provider_span_utf8_boundary_invalid', {
      code: 'PROVIDER_SPAN_INVALID',
      path,
      start,
      end
    });
  }
  const occurrences = occurrencesOf(fragment.rawText, text).map((charStart) => ({
    start: byteOffset(fragment.rawText, charStart),
    end: byteOffset(fragment.rawText, charStart) + Buffer.byteLength(text, 'utf8')
  }));
  const occurrenceIndex = occurrences.findIndex((item) => item.start === start && item.end === end);
  if (occurrenceIndex === -1) {
    throw new ProviderDtoError('provider_span_not_exact_fragment_slice', {
      code: 'PROVIDER_SPAN_INVALID',
      path,
      start,
      end
    });
  }
  return { text, occurrence: occurrenceIndex + 1 };
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
  const claims = providerPrediction.claims.map((claim, claimIndex) => {
    const path = `#/claims/${claimIndex}`;
    assertParallelArrays([claim.supportSpanStartBytes, claim.supportSpanEndBytes], `${path}/supportSpans`);
    if (!claim.supportSpanStartBytes.length) {
      throw new ProviderDtoError('provider_claim_without_span', {
        code: 'PROVIDER_SPAN_INVALID',
        path
      });
    }
    const supportSpans = claim.supportSpanStartBytes.map((start, spanIndex) =>
      offsetsToCanonicalSpan(
        fragment,
        start,
        claim.supportSpanEndBytes[spanIndex],
        `${path}/supportSpans/${spanIndex}`
      )
    );
    if (
      !Number.isInteger(claim.rawStatementSpanIndex) ||
      claim.rawStatementSpanIndex < 0 ||
      claim.rawStatementSpanIndex >= supportSpans.length
    ) {
      throw new ProviderDtoError('provider_raw_statement_span_index_invalid', {
        code: 'PROVIDER_SPAN_INVALID',
        path: `${path}/rawStatementSpanIndex`
      });
    }
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
      rawStatement: supportSpans[claim.rawStatementSpanIndex].text,
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
      const offsets = claim.supportSpans.map((span, spanIndex) =>
        canonicalSpanToOffsets(fragment, span, `#/claims/${claimIndex}/supportSpans/${spanIndex}`)
      );
      const rawStatementSpanIndex = claim.supportSpans.findIndex(
        (span) => span.text === claim.rawStatement
      );
      if (rawStatementSpanIndex === -1) {
        throw new ProviderDtoError('canonical_raw_statement_has_no_span', {
          code: 'CANONICAL_SPAN_INVALID',
          claimIndex
        });
      }
      const confidence = claim.assessmentDraft.confidenceByAspect.value;
      return {
        supportSpanStartBytes: offsets.map(([start]) => start),
        supportSpanEndBytes: offsets.map(([, end]) => end),
        rawStatementSpanIndex,
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
