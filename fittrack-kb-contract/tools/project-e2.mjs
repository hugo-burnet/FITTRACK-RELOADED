// E2 — projection déterministe des cellules typées vers les six axes.
// N'écrit jamais dans curated/. Ne reformule pas rawStatement.

import { createHash } from 'node:crypto';
import {
  E2_MAPPING_VERSION,
  fold,
  matchAspect,
  matchEvidenceTypes,
  matchLevel,
  splitSemicolon
} from './e2-mappings.mjs';

export const EXTRACTOR_VERSION = '0.1.0-e2';
export const EXTRACTED_AT = '2026-08-23T00:00:00.000Z';

const sha256 = (value) =>
  'sha256:' + createHash('sha256').update(value, 'utf8').digest('hex');

function cellRaw(candidate, headers) {
  const cells = candidate?.payload?.cells;
  if (!Array.isArray(cells)) return null;
  for (const header of headers) {
    const hit = cells.find((c) => c.header === header);
    if (hit) return hit;
  }
  return null;
}

export function projectConfidence(raw) {
  const text = raw ?? '';
  const out = {
    raw: text,
    simple: null,
    range: null,
    byAspect: [],
    unresolved: []
  };
  if (!text.trim()) {
    out.unresolved.push({ rawValue: text, reason: 'empty_confidence' });
    return out;
  }

  const segments = splitSemicolon(text);
  const rangeRe = /^(tres faible|eleve|modere|faible) a (tres faible|eleve|modere|faible)$/;

  for (const segment of segments) {
    const foldedSeg = fold(segment);
    const rangeHit = rangeRe.exec(foldedSeg);
    if (rangeHit) {
      out.range = { from: matchLevel(rangeHit[1]), to: matchLevel(rangeHit[2]) };
      continue;
    }

    const pour = /^(tres faible|eleve|modere|faible)\s+pour\s+(.+)$/.exec(foldedSeg);
    if (pour) {
      const level = matchLevel(pour[1]);
      const aspect = matchAspect(pour[2]);
      if (level && aspect) {
        out.byAspect.push({ aspect, confidence: level, rawValue: segment });
      } else {
        out.unresolved.push({
          rawValue: segment,
          level,
          reason: 'unknown_confidence_expression'
        });
      }
      continue;
    }

    const simple = matchLevel(foldedSeg);
    if (simple && foldedSeg === fold(segment).split(/\s+/)[0] && !foldedSeg.includes(' pour ')) {
      // Exact level, or level + qualifier that is not an aspect.
      const rest = foldedSeg.slice(fold(simple === 'very_low' ? 'tres faible' : simple === 'high' ? 'eleve' : simple === 'moderate' ? 'modere' : 'faible').length).trim();
      if (!rest) {
        out.simple = simple;
        continue;
      }
      out.unresolved.push({
        rawValue: segment,
        level: simple,
        qualifier: segment.slice(segment.search(/\s/) + 1),
        reason: 'confidence_qualifier_unresolved'
      });
      continue;
    }

    if (simple) {
      out.unresolved.push({
        rawValue: segment,
        level: simple,
        reason: 'unknown_confidence_expression'
      });
      continue;
    }

    out.unresolved.push({ rawValue: segment, reason: 'unknown_confidence_expression' });
  }

  if (out.byAspect.length) out.simple = null;
  return out;
}

export function projectEvidenceTypes(raw) {
  const text = raw ?? '';
  const mapped = [];
  const unresolved = [];
  if (!text.trim()) return { raw: text, mapped, unresolved };

  for (const segment of splitSemicolon(text)) {
    const terms = matchEvidenceTypes(fold(segment));
    if (terms.length === 0) {
      unresolved.push({ rawValue: segment, reason: 'unknown_evidence_type' });
      continue;
    }
    for (const term of terms) mapped.push({ rawValue: segment, term });
  }
  return { raw: text, mapped, unresolved };
}

export function projectListCell(raw) {
  const text = raw ?? '';
  return {
    raw: text,
    items: splitSemicolon(text).map((rawValue) => ({ rawValue }))
  };
}

export function projectPopulation(raw) {
  const text = raw ?? '';
  const folded = fold(text);
  const out = { raw: text, rawDescription: text };

  const qualified = /^(principalement|surtout|souvent|generalement)\b/.test(folded);
  if (qualified) {
    out.generalizationWarnings = [text];
  }

  const status = [];
  if (/(non-entraines|non entrai|non-entrainees|debutants)/.test(folded)) status.push('untrained');
  if (/\bavances\b/.test(folded)) status.push('advanced');
  if (/\bentraines\b/.test(folded) && !/(non-entraines|non entrai|non-entrainees)/.test(folded.replace(/\bentraines\b/g, 'X'))) {
    // "entraînés" present; untrained already captured separately for mixed cells.
  }
  if (/\bentraines\b/.test(folded) || /\bentraine\b/.test(folded)) {
    const withoutUntrained = folded
      .replace(/non-entraines/g, '')
      .replace(/non entrai[^\s;,]*/g, '')
      .replace(/non-entrainees/g, '');
    if (/\bentraines\b/.test(withoutUntrained) || /\bentraine\b/.test(withoutUntrained)) status.push('trained');
  }
  if (status.length) out.trainingStatus = [...new Set(status)];

  if (!qualified) {
    if (/adultes ages|personnes agees/.test(folded)) out.ageBand = 'older_adult';
    else if (/jeunes adultes|adultes jeunes/.test(folded)) out.ageBand = 'young_adult';
    else if (/\badultes\b/.test(folded)) out.ageBand = 'adult';
  }

  const sexBits = [];
  if (/79 % hommes|79% hommes/.test(folded)) sexBits.push(text);
  else if (/hommes/.test(folded) || /femmes/.test(folded)) sexBits.push(text);
  if (sexBits.length) out.sexDistributionNote = sexBits[0];

  const warningBits = [];
  if (/surtout|principalement|souvent|generalisation prudente|majorite/.test(folded) && !out.generalizationWarnings) {
    warningBits.push(text);
  }
  if (warningBits.length) out.generalizationWarnings = warningBits;
  return out;
}

function knowledgeTypeFromEvidence(mappedTerms) {
  const set = new Set(mappedTerms);
  const empirical = [
    'position_stand',
    'umbrella_review',
    'systematic_review',
    'meta_analysis',
    'meta_regression',
    'network_meta_analysis',
    'randomized_trial',
    'within_participant_trial',
    'cross_sectional_survey',
    'consensus_statement',
    'medical_body_recommendation',
    'narrative_review',
    'scoping_review'
  ];
  const hasEmpirical = [...set].some((t) => empirical.includes(t));
  const hasEmg = set.has('emg_study');
  const hasBiomech = set.has('biomechanical_study');
  const hasExpert = set.has('expert_practice');
  const kinds = [];
  if (hasEmpirical) kinds.push('EVIDENCE');
  if (hasEmg) kinds.push('EMG_OBSERVATION');
  if (hasBiomech) kinds.push('BIOMECHANICAL_OBSERVATION');
  if (hasExpert) kinds.push('EXPERT_PRACTICE');
  if (kinds.length === 1) return { term: kinds[0], unresolved: false };
  if (kinds.length > 1) return { term: null, unresolved: true, reasons: kinds };
  return { term: null, unresolved: mappedTerms.length === 0 };
}

function directnessFromEvidence(mappedTerms) {
  const set = new Set(mappedTerms);
  if (set.size === 1 && set.has('emg_study')) return 'emg_only';
  if (set.size === 1 && set.has('biomechanical_study')) return 'biomechanical_only';
  if (set.size === 1 && set.has('expert_practice')) return 'expert_only';
  return null;
}

function epistemicStatusFromConfidence(confidence) {
  const dir = confidence.byAspect.find((a) => a.aspect === 'direction' && a.confidence === 'high');
  const weaker = confidence.byAspect.some((a) => a.aspect !== 'direction' && a.confidence !== 'high');
  if (dir && weaker) return 'established_direction';
  return null;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function projectE2Candidate(candidate) {
  if (!candidate || typeof candidate !== 'object' || !candidate.payload || !candidate.candidateId) {
    return {
      claim: null,
      assessment: null,
      diagnostics: [
        {
          type: 'invalid_e1_candidate',
          schema: 'extraction-candidate.schema.json',
          value: candidate,
          message: 'Candidat E1 illisible : candidateId/payload absents.'
        }
      ]
    };
  }

  const diagnostics = [];
  if (candidate.targetKind !== 'claim') {
    diagnostics.push({
      type: 'skipped_not_claim_table',
      candidateId: candidate.candidateId,
      corpusFileRef: candidate.corpusFileRef,
      targetKind: candidate.targetKind,
      message: 'E2 ne projette les six axes que sur les lignes d affirmation.'
    });
    return { claim: null, assessment: null, skipped: candidate, diagnostics };
  }

  const claim = cloneJson(candidate);
  const confiance = cellRaw(candidate, ['Confiance']);
  const population = cellRaw(candidate, ['Population']);
  const typePreuve = cellRaw(candidate, ['Type de preuve']);
  const nuance = cellRaw(candidate, [
    'Sources contradictoires / nuances',
    'Contradictions / nuances'
  ]);
  const limites = cellRaw(candidate, ['Limites', 'Limites et application']);
  const pratique = cellRaw(candidate, ['Interprétation pratique']);
  const cannot = cellRaw(candidate, ['Ce qu’on ne peut PAS conclure', "Ce qu'on ne peut PAS conclure"]);

  const confidence = projectConfidence(confiance?.raw ?? '');
  const evidenceTypes = projectEvidenceTypes(typePreuve?.raw ?? '');
  const knowledge = knowledgeTypeFromEvidence(evidenceTypes.mapped.map((m) => m.term));
  const e2 = {
    mappingVersion: E2_MAPPING_VERSION,
    extractorVersion: EXTRACTOR_VERSION,
    method: 'deterministic_table_cell',
    cannotConclude: projectListCell(cannot?.raw ?? ''),
    limitations: projectListCell(limites?.raw ?? ''),
    practicalInterpretation: { raw: pratique?.raw ?? '' },
    population: projectPopulation(population?.raw ?? ''),
    evidenceTypes,
    confidence,
    nuance: { raw: nuance?.raw ?? '', links: nuance?.links ?? [] },
    knowledgeType: knowledge.term,
    epistemicStatus: epistemicStatusFromConfidence(confidence),
    directness: directnessFromEvidence(evidenceTypes.mapped.map((m) => m.term)),
    hierarchyHint: candidate.corpusFileRef?.includes('.f1.')
      ? 'training'
      : candidate.corpusFileRef?.includes('.f2.')
        ? 'biomechanics'
        : null
  };

  for (const u of confidence.unresolved) {
    diagnostics.push({
      type: u.reason ?? 'unknown_confidence_expression',
      candidateId: candidate.candidateId,
      corpusFileRef: candidate.corpusFileRef,
      startLine: candidate.payload.startLine,
      rawValue: u.rawValue,
      schema: 'confidence-level / confidence-aspect'
    });
  }
  for (const u of evidenceTypes.unresolved) {
    diagnostics.push({
      type: 'unknown_evidence_type',
      candidateId: candidate.candidateId,
      corpusFileRef: candidate.corpusFileRef,
      startLine: candidate.payload.startLine,
      rawValue: u.rawValue,
      schema: 'evidence-type'
    });
  }
  if (knowledge.unresolved && knowledge.reasons) {
    diagnostics.push({
      type: 'mixed_knowledge_type',
      candidateId: candidate.candidateId,
      rawValue: knowledge.reasons.join(','),
      schema: 'knowledge-type'
    });
  }

  const assessmentId = `cand.e2.${sha256(candidate.candidateId + '\n' + (confiance?.raw ?? '') + '\n' + (typePreuve?.raw ?? '')).slice(7, 23)}`;
  e2.assessmentCandidateId = assessmentId;
  claim.payload.e2 = e2;
  if (e2.cannotConclude.items.length) {
    claim.payload.cannotConclude = e2.cannotConclude.items.map((i) => i.rawValue);
  }
  if (e2.limitations.items.length) {
    claim.payload.limitations = e2.limitations.items.map((i) => i.rawValue);
  }
  if (e2.practicalInterpretation.raw) {
    claim.payload.practicalInterpretation = e2.practicalInterpretation.raw;
  }

  const assessment = {
    candidateId: assessmentId,
    targetKind: 'evidence-assessment',
    fragmentRef: candidate.fragmentRef,
    corpusFileRef: candidate.corpusFileRef,
    extraction: {
      method: 'deterministic_table_cell',
      runId: candidate.extraction?.runId ?? 'run.e2',
      extractedAt: EXTRACTED_AT,
      extractorVersion: EXTRACTOR_VERSION
    },
    payload: {
      claimCandidateId: candidate.candidateId,
      assessedBy: 'deterministic_rule',
      assessedAt: '2026-08-23',
      hierarchyHint: e2.hierarchyHint,
      knowledgeType: e2.knowledgeType,
      directness: e2.directness,
      evidenceTypes: evidenceTypes.mapped.map((m) => m.term),
      confidenceByAspect: confidence.byAspect.map((a) => ({
        aspect: a.aspect,
        confidence: a.confidence,
        rationale: a.rawValue
      })),
      raw: {
        confiance: confiance?.raw ?? '',
        typeDePreuve: typePreuve?.raw ?? ''
      }
    },
    verbatimSpan: candidate.verbatimSpan,
    reviewState: 'pending_human_review'
  };

  return { claim, assessment, skipped: null, diagnostics };
}

export function projectE2Document(e1Doc) {
  const claims = [];
  const assessments = [];
  const skipped = [];
  const diagnostics = [];
  for (const candidate of e1Doc.candidates ?? []) {
    const out = projectE2Candidate(candidate);
    diagnostics.push(...out.diagnostics);
    if (out.skipped) skipped.push({ candidateId: candidate.candidateId, targetKind: candidate.targetKind });
    if (out.claim) claims.push(out.claim);
    if (out.assessment) assessments.push(out.assessment);
  }
  return { claims, assessments, skipped, diagnostics };
}
