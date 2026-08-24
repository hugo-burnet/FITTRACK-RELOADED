import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import { providerPredictionToCanonical } from './provider-dto.mjs';

const RETRYABLE_CODES = new Set([
  'INVALID_JSON',
  'SCHEMA_FAILURE',
  'INVALID_FRAGMENT_ID',
  'WRONG_SPAN',
  'SPAN_HALLUCINATION',
  'INVENTED_CITATION',
  'CITATION_BLEED',
  'CLAIM_WITHOUT_SPAN'
]);

const URL_RE = /https?:\/\/[^\s)\]}>"']+/giu;
const DOI_RE = /\b10\.\d{4,9}\/[-._;()/:a-z0-9]+\b/giu;
const PMID_RE = /\bPMID\s*:?\s*\d+\b/giu;

function hash16(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex').slice(0, 16);
}

function diagnostic(code, message, detail = {}, critical = true) {
  return {
    code,
    message,
    critical,
    retryable: RETRYABLE_CODES.has(code),
    ...detail
  };
}

function occurrencesOf(text, needle) {
  if (!needle) return [];
  const positions = [];
  let from = 0;
  while (from <= text.length) {
    const index = text.indexOf(needle, from);
    if (index === -1) break;
    positions.push(index);
    from = index + Math.max(needle.length, 1);
  }
  return positions;
}

function byteOffset(text, charIndex) {
  return Buffer.byteLength(text.slice(0, charIndex), 'utf8');
}

function resolveSpan(fragment, span) {
  const positions = occurrencesOf(fragment.rawText, span.text);
  const charStart = positions[span.occurrence - 1];
  if (charStart === undefined) return null;
  const relativeStartByte = byteOffset(fragment.rawText, charStart);
  const relativeEndByte = relativeStartByte + Buffer.byteLength(span.text, 'utf8');
  const reread = Buffer.from(fragment.rawText, 'utf8')
    .subarray(relativeStartByte, relativeEndByte)
    .toString('utf8');
  if (reread !== span.text) return null;
  return {
    text: span.text,
    relativeStartByte,
    relativeEndByte,
    absoluteStartByte: fragment.startByte + relativeStartByte,
    absoluteEndByte: fragment.startByte + relativeEndByte
  };
}

function axisCoherence(axis, label, diagnostics, claimRef) {
  const resolved = axis.state === 'RESOLVED';
  if (resolved && axis.value === null) {
    diagnostics.push(
      diagnostic('SCHEMA_FAILURE', `${label} RESOLVED exige une valeur`, { claimRef, axis: label })
    );
  }
  if (!resolved && axis.value !== null) {
    diagnostics.push(
      diagnostic('SCHEMA_FAILURE', `${label} non résolu exige value=null`, {
        claimRef,
        axis: label
      })
    );
  }
}

function nonVerbatimText(claim) {
  return [
    ...claim.conditions,
    ...claim.limitations,
    ...claim.cannotConclude,
    ...claim.unresolved,
    claim.knowledgeType.reason,
    claim.epistemicStatus.reason,
    claim.assessmentDraft.confidenceByAspect.reason,
    claim.assessmentDraft.confidenceByAspect.raw,
    claim.assessmentDraft.directness.reason,
    claim.assessmentDraft.evidenceTypes.reason,
    ...(claim.assessmentDraft.confidenceByAspect.value ?? []).flatMap((item) => [
      item.rationale
    ])
  ]
    .filter(Boolean)
    .join('\n');
}

function containsNewPattern(text, fragmentText, pattern) {
  return [...text.matchAll(pattern)].some((match) => !fragmentText.includes(match[0]));
}

function hasNegativeScope(text) {
  return /\b(?:ne|n[’']|pas|non|sans|aucun|aucune|ni|n'est|n’équivaut)\b/iu.test(text);
}

function semanticGuardrails(fragment, claim, diagnostics) {
  const claimRef = claim.technicalClaimRef;
  const raw = claim.rawStatement;
  const lower = raw.toLocaleLowerCase('fr');
  const kt = claim.knowledgeType.value;
  const status = claim.epistemicStatus.value;
  const directness = claim.assessmentDraft.directness.value;
  const freeText = nonVerbatimText(claim);

  if (containsNewPattern(freeText, fragment.rawText, URL_RE)) {
    diagnostics.push(diagnostic('INVENTED_SOURCE', 'URL absente du fragment ajoutée dans un champ libre', { claimRef }));
  }
  if (
    containsNewPattern(freeText, fragment.rawText, DOI_RE) ||
    containsNewPattern(freeText, fragment.rawText, PMID_RE)
  ) {
    diagnostics.push(diagnostic('INVENTED_SOURCE', 'DOI ou PMID absent du fragment ajouté', { claimRef }));
  }
  if (['PRODUCT_POLICY', 'MODELING_DECISION'].includes(kt)) {
    diagnostics.push(
      diagnostic('UNSUPPORTED_INFERENCE', 'Une politique produit ou décision de modélisation doit être ZERO_CLAIM en E5 v0', {
        claimRef
      })
    );
  }
  if (
    ['EXPERT_PRACTICE', 'HYPOTHESIS'].includes(kt) &&
    ['established', 'established_direction', 'probable', 'refuted'].includes(status)
  ) {
    diagnostics.push(
      diagnostic('EVIDENCE_INFLATION', `${kt} ne peut porter le statut ${status}`, { claimRef })
    );
  }
  if (
    kt === 'EMG_OBSERVATION' &&
    ['established', 'established_direction'].includes(status)
  ) {
    diagnostics.push(
      diagnostic('EVIDENCE_INFLATION', 'Une observation EMG ne peut être établie', { claimRef })
    );
  }
  if (
    (kt === 'EMG_OBSERVATION' || directness === 'emg_only') &&
    claim.assessmentDraft.supportsHypertrophySuperiority !== false
  ) {
    diagnostics.push(
      diagnostic('EMG_HYPERTROPHY_LEAP', 'Une preuve EMG ne peut soutenir une supériorité hypertrophique', {
        claimRef
      })
    );
  }
  if (
    ['biomechanical_only', 'mechanistic_hypothesis', 'animal_model'].includes(directness) &&
    claim.assessmentDraft.supportsDemonstratedClinicalRisk !== false
  ) {
    diagnostics.push(
      diagnostic('BIOMECHANICS_RISK_LEAP', 'Une preuve mécanique indirecte ne peut soutenir un risque clinique démontré', {
        claimRef
      })
    );
  }
  if (
    kt === 'BIOMECHANICAL_OBSERVATION' &&
    /\b(?:dangereu|blessure|contre-indiqu|lésion|dommage)\w*/iu.test(lower) &&
    !hasNegativeScope(lower)
  ) {
    diagnostics.push(
      diagnostic('BIOMECHANICS_RISK_LEAP', 'Observation biomécanique transformée en danger clinique', {
        claimRef
      })
    );
  }
  if (
    /\b(?:vous avez|diagnostique|confirme (?:un|une|la)|prouve (?:un|une|la))\b/iu.test(lower) &&
    !hasNegativeScope(lower)
  ) {
    diagnostics.push(diagnostic('INVENTED_DIAGNOSIS', 'Diagnostic affirmatif extrait', { claimRef }));
  }
  if (
    fragment.corpusFileId.startsWith('corpus.f3.') &&
    /\b(?:interdit|contre-indiqu|obligatoire|doit être banni)\w*/iu.test(lower) &&
    !hasNegativeScope(lower)
  ) {
    diagnostics.push(
      diagnostic('CLINICAL_OVERREACH', 'Conseil clinique transformé en interdiction universelle', { claimRef })
    );
  }
  if (
    fragment.corpusFileId.startsWith('corpus.f3.') &&
    /\b(?:toujours|jamais|universel(?:le)?|toute douleur|toute pathologie)\b/iu.test(lower) &&
    kt !== 'MYTH_REFUTATION' &&
    !hasNegativeScope(lower)
  ) {
    diagnostics.push(
      diagnostic('CLINICAL_OVERREACH', 'Universalisation clinique non prudente', { claimRef })
    );
  }
  if (
    ['established', 'established_direction'].includes(status) &&
    /\b(?:peut|pourrait|semble|probable|incertain|non démontr|pas de preuve|faible)\b/iu.test(lower)
  ) {
    diagnostics.push(
      diagnostic('EVIDENCE_INFLATION', 'Le statut durcit un modal ou une incertitude verbatim', { claimRef })
    );
  }
}

export function createPredictionValidator(schema) {
  const ajv = new Ajv2020({ strict: false, allErrors: true, allowUnionTypes: true });
  return ajv.compile(schema);
}

export function validateProviderAndMaterialize({
  rawResponse,
  expectedFragment,
  citationCatalog,
  providerSchemaValidator,
  canonicalSchemaValidator,
  runConfig
}) {
  let providerPrediction;
  try {
    providerPrediction = JSON.parse(rawResponse);
  } catch (error) {
    return {
      accepted: false,
      prediction: null,
      diagnostics: [
        diagnostic('INVALID_JSON', 'Réponse provider non JSON', {
          detail: error instanceof Error ? error.message : String(error)
        })
      ],
      retryable: true
    };
  }
  if (!providerSchemaValidator(providerPrediction)) {
    return {
      accepted: false,
      prediction: null,
      diagnostics: [
        diagnostic('SCHEMA_FAILURE', 'Réponse non conforme au Provider DTO', {
          schemaErrors: structuredClone(providerSchemaValidator.errors ?? [])
        })
      ],
      retryable: true
    };
  }
  let canonicalPrediction;
  try {
    canonicalPrediction = providerPredictionToCanonical(
      providerPrediction,
      expectedFragment,
      citationCatalog
    );
  } catch (error) {
    const detail =
      error instanceof Error && 'providerDtoDiagnostic' in error
        ? error.providerDtoDiagnostic
        : { message: error instanceof Error ? error.message : String(error) };
    const code = detail.code === 'INVENTED_CITATION'
      ? 'INVENTED_CITATION'
      : detail.code === 'PROVIDER_SPAN_INVALID'
        ? 'WRONG_SPAN'
        : 'SCHEMA_FAILURE';
    return {
      accepted: false,
      prediction: null,
      diagnostics: [diagnostic(code, 'Provider DTO impossible à reconstruire canoniquement', { detail })],
      retryable: RETRYABLE_CODES.has(code)
    };
  }
  return validateAndMaterialize({
    rawResponse: JSON.stringify(canonicalPrediction),
    expectedFragment,
    citationCatalog,
    schemaValidator: canonicalSchemaValidator,
    runConfig
  });
}

export function validateAndMaterialize({
  rawResponse,
  expectedFragment,
  citationCatalog,
  schemaValidator,
  runConfig
}) {
  const diagnostics = [];
  let parsed;
  try {
    parsed = JSON.parse(rawResponse);
  } catch (error) {
    diagnostics.push(
      diagnostic('INVALID_JSON', 'Réponse non JSON', { detail: error instanceof Error ? error.message : String(error) })
    );
    return { accepted: false, prediction: null, diagnostics, retryable: true };
  }
  if (!schemaValidator(parsed)) {
    diagnostics.push(
      diagnostic('SCHEMA_FAILURE', 'Réponse non conforme au schéma', {
        schemaErrors: structuredClone(schemaValidator.errors ?? [])
      })
    );
    return { accepted: false, prediction: null, diagnostics, retryable: true };
  }
  if (parsed.fragmentId !== expectedFragment.fragmentId) {
    diagnostics.push(
      diagnostic('INVALID_FRAGMENT_ID', 'fragmentId différent du fragment attendu', {
        expected: expectedFragment.fragmentId,
        actual: parsed.fragmentId
      })
    );
  }
  if (parsed.annotationPrediction === 'ZERO_CLAIM' && parsed.claims.length !== 0) {
    diagnostics.push(
      diagnostic('SCHEMA_FAILURE', 'ZERO_CLAIM exige claims=[]', {
        claimCount: parsed.claims.length
      })
    );
  }
  if (parsed.annotationPrediction === 'CLAIMS' && parsed.claims.length === 0) {
    diagnostics.push(
      diagnostic('SCHEMA_FAILURE', 'CLAIMS exige au moins une claim', { claimCount: 0 })
    );
  }
  const citationsById = new Map(citationCatalog.map((item) => [item.candidateId, item]));
  const technicalRefs = new Set();
  const materializedClaims = [];
  parsed.claims.forEach((claim, index) => {
    const claimRef = claim.technicalClaimRef;
    if (technicalRefs.has(claimRef) || claimRef !== `tmp.claim.${String(index + 1).padStart(2, '0')}`) {
      diagnostics.push(
        diagnostic('SCHEMA_FAILURE', 'technicalClaimRef dupliqué ou hors ordre', { claimRef, index })
      );
    }
    technicalRefs.add(claimRef);
    if (!claim.supportSpans.length) {
      diagnostics.push(diagnostic('CLAIM_WITHOUT_SPAN', 'Claim sans support span', { claimRef }));
      return;
    }
    const spans = [];
    for (const span of claim.supportSpans) {
      const resolved = resolveSpan(expectedFragment, span);
      if (!resolved) {
        const exists = expectedFragment.rawText.includes(span.text);
        diagnostics.push(
          diagnostic(exists ? 'WRONG_SPAN' : 'SPAN_HALLUCINATION', 'Support span invérifiable', {
            claimRef,
            span
          })
        );
      } else {
        spans.push(resolved);
      }
    }
    spans.sort((left, right) => left.relativeStartByte - right.relativeStartByte);
    for (let spanIndex = 1; spanIndex < spans.length; spanIndex += 1) {
      if (spans[spanIndex].relativeStartByte < spans[spanIndex - 1].relativeEndByte) {
        diagnostics.push(diagnostic('WRONG_SPAN', 'Support spans se chevauchent', { claimRef }));
      }
    }
    if (!claim.supportSpans.some((span) => span.text === claim.rawStatement)) {
      diagnostics.push(
        diagnostic('WRONG_SPAN', 'rawStatement doit égaler un supportSpan exact', { claimRef })
      );
    }
    for (const citationId of claim.citationOccurrenceRefs) {
      const citation = citationsById.get(citationId);
      if (!citation) {
        diagnostics.push(
          diagnostic('INVENTED_CITATION', 'CitationOccurrence absente du catalogue fermé', {
            claimRef,
            citationId
          })
        );
      } else if (citation.fragmentRef !== expectedFragment.fragmentId) {
        diagnostics.push(
          diagnostic('CITATION_BLEED', 'CitationOccurrence issue d’un autre fragment', {
            claimRef,
            citationId
          })
        );
      }
    }
    if (claim.citationAttributionState === 'ATTACHED' && claim.citationOccurrenceRefs.length === 0) {
      diagnostics.push(diagnostic('SCHEMA_FAILURE', 'ATTACHED exige au moins une citation', { claimRef }));
    }
    if (claim.citationAttributionState === 'NOT_CITED' && claim.citationOccurrenceRefs.length !== 0) {
      diagnostics.push(diagnostic('SCHEMA_FAILURE', 'NOT_CITED exige une liste de citations vide', { claimRef }));
    }
    axisCoherence(claim.knowledgeType, 'knowledgeType', diagnostics, claimRef);
    axisCoherence(claim.epistemicStatus, 'epistemicStatus', diagnostics, claimRef);
    axisCoherence(claim.assessmentDraft.confidenceByAspect, 'confidenceByAspect', diagnostics, claimRef);
    axisCoherence(claim.assessmentDraft.directness, 'directness', diagnostics, claimRef);
    axisCoherence(claim.assessmentDraft.evidenceTypes, 'evidenceTypes', diagnostics, claimRef);
    const expectedHierarchy = expectedFragment.corpusFileId.startsWith('corpus.f2.')
      ? 'biomechanics'
      : 'clinical';
    if (claim.assessmentDraft.hierarchyHint !== expectedHierarchy) {
      diagnostics.push(
        diagnostic('SCHEMA_FAILURE', 'hierarchyHint contredit la règle déterministe du corpus', {
          claimRef,
          expected: expectedHierarchy,
          actual: claim.assessmentDraft.hierarchyHint
        })
      );
    }
    semanticGuardrails(expectedFragment, claim, diagnostics);
    const candidateId = `cand.e5-benchmark-claim.${hash16(
      JSON.stringify({
        corpusFileContentHash: expectedFragment.corpusFileContentHash,
        fragmentId: expectedFragment.fragmentId,
        spans,
        rawStatement: claim.rawStatement,
        domain: claim.domain,
        knowledgeType: claim.knowledgeType,
        epistemicStatus: claim.epistemicStatus,
        assessmentDraft: claim.assessmentDraft,
        citationOccurrenceRefs: claim.citationOccurrenceRefs,
        limitations: claim.limitations,
        cannotConclude: claim.cannotConclude
      })
    )}`;
    materializedClaims.push({
      candidateId,
      technicalClaimRef: claimRef,
      rawStatement: claim.rawStatement,
      supportSpans: spans,
      domain: claim.domain,
      knowledgeType: claim.knowledgeType.value,
      epistemicStatus: claim.epistemicStatus.value,
      assessmentDraft: claim.assessmentDraft,
      axisResolution: {
        knowledgeType: claim.knowledgeType,
        epistemicStatus: claim.epistemicStatus,
        confidenceByAspect: claim.assessmentDraft.confidenceByAspect,
        directness: claim.assessmentDraft.directness,
        evidenceTypes: claim.assessmentDraft.evidenceTypes,
        hierarchyHint: {
          state: 'RESOLVED',
          value: expectedHierarchy,
          reason: 'deterministic_corpus_rule'
        }
      },
      citationOccurrenceRefs: claim.citationOccurrenceRefs,
      citationAttributionState: claim.citationAttributionState,
      conditions: claim.conditions,
      limitations: claim.limitations,
      cannotConclude: claim.cannotConclude,
      unresolved: claim.unresolved,
      flags: claim.flags,
      reviewState: 'pending_human_review'
    });
  });
  const critical = diagnostics.filter((item) => item.critical);
  const accepted = critical.length === 0;
  return {
    accepted,
    prediction: accepted
      ? {
          schemaVersion: runConfig.schemaVersion,
          runId: runConfig.runId,
          fragmentId: expectedFragment.fragmentId,
          annotationPrediction: parsed.annotationPrediction,
          claims: materializedClaims
        }
      : null,
    diagnostics,
    retryable: critical.length > 0 && critical.every((item) => item.retryable)
  };
}
