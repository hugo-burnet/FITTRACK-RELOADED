// Mapping déterministe E2, versionné. Toute phrase absente de ces tables
// reste UNRESOLVED : pas de plus-proche-voisin.

export const E2_MAPPING_VERSION = '0.1.0';

export function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/’/g, "'")
    .toLowerCase()
    .trim();
}

export const CONFIDENCE_LEVELS = [
  { term: 'very_low', phrases: ['tres faible'] },
  { term: 'high', phrases: ['eleve'] },
  { term: 'moderate', phrases: ['modere'] },
  { term: 'low', phrases: ['faible'] }
];

// Uniquement des libellés attestés par confidence-aspect.vocab.json (corpusRef / label).
export const CONFIDENCE_ASPECTS = [
  { aspect: 'dose_response_shape', phrases: ['la forme de la courbe', 'forme de la courbe'] },
  { aspect: 'descriptive_accuracy', phrases: ['description'] },
  { aspect: 'equivalence', phrases: ['equivalence des methodes'] },
  { aspect: 'distribution', phrases: ['la distribution'] },
  { aspect: 'threshold', phrases: ['un plafond chiffre', 'le seuil'] },
  { aspect: 'chronic_effect', phrases: ['impact chronique'] },
  { aspect: 'acute_effect', phrases: ["l'aigu"] },
  { aspect: 'direction', phrases: ['la direction'] }
];

// Plus long d'abord pour que « méta-analyse en réseau » gagne sur « méta-analyse ».
export const EVIDENCE_TYPE_PATTERNS = [
  { term: 'network_meta_analysis', phrases: ['meta-analyse en reseau', 'nma bayesienne', 'nma'] },
  { term: 'meta_regression', phrases: ['meta-regression', 'meta-regressions'] },
  { term: 'umbrella_review', phrases: ['umbrella review', 'revue parapluie'] },
  { term: 'scoping_review', phrases: ['revue de portee'] },
  { term: 'within_participant_trial', phrases: ['rct intra-sujet', 'crossover randomise', 'essai intra-sujet'] },
  { term: 'systematic_review', phrases: ['revue systematique'] },
  { term: 'meta_analysis', phrases: ['meta-analyse', 'meta-analyses'] },
  { term: 'position_stand', phrases: ['position stand'] },
  { term: 'narrative_review', phrases: ['revue narrative'] },
  { term: 'cross_sectional_survey', phrases: ['enquete transversale'] },
  { term: 'consensus_statement', phrases: ['consensus'] },
  { term: 'randomized_trial', phrases: ['rct parallele', 'petit rct', 'rct'] },
  { term: 'medical_body_recommendation', phrases: ['recommandations officielles'] },
  { term: 'biomechanical_study', phrases: ['biomechanique'] },
  { term: 'emg_study', phrases: ['emg'] },
  { term: 'expert_practice', phrases: ['inference pratique', 'synthese pratique'] }
];

export function splitSemicolon(raw) {
  if (raw == null || raw === '') return [];
  return String(raw)
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function matchLevel(foldedSegment) {
  for (const row of CONFIDENCE_LEVELS) {
    for (const phrase of row.phrases) {
      if (foldedSegment === phrase || foldedSegment.startsWith(phrase + ' ')) return row.term;
    }
  }
  return null;
}

export function matchAspect(foldedTail) {
  const tail = foldedTail.replace(/^[.,:\s]+/, '').trim();
  for (const row of CONFIDENCE_ASPECTS) {
    for (const phrase of row.phrases) {
      if (tail === phrase) return row.aspect;
    }
  }
  return null;
}

export function matchEvidenceTypes(foldedSegment) {
  const hits = [];
  for (const row of EVIDENCE_TYPE_PATTERNS) {
    for (const phrase of row.phrases) {
      if (foldedSegment.includes(phrase)) {
        hits.push(row.term);
        break;
      }
    }
  }
  return [...new Set(hits)];
}
