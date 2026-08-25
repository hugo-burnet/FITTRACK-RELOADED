// Projette les sorties d'extraction en un corpus utilisable, en ne conservant que ce
// qui a été MESURÉ fiable. Le principe est celui déjà inscrit dans le prompt, appliqué
// cette fois au niveau du champ : mieux vaut un champ vide qu'un champ faux.
//
// Pour du fine-tuning, ce n'est pas une précaution de style. Entraîner un petit modèle
// sur une étiquette de certitude fausse une fois sur deux lui apprend une mauvaise
// calibration — il vaut mieux qu'il n'apprenne rien de cet axe que le contraire de la
// vérité.
//
// Chiffres de référence, run DEV-100 (`fd82c1d8b1eb10fc`, 186 claims de GOLD) :
//
// | Champ                       | Fiabilité mesurée      | Décision          |
// |-----------------------------|------------------------|-------------------|
// | rawStatement + supportSpans | verbatim, 0 invention  | conservé, vérifié |
// | epistemicStatus = refuted   | précision 1,00 (5/5)   | conservé, vérifié |
// | epistemicStatus, autres     | 0,46 global            | vidé              |
// | knowledgeType               | 0,689                  | vidé              |
// | citationOccurrenceRefs      | précision 0,766        | conservé, non sûr |
//
// Les 100 fragments annotés par des humains gardent tous leurs champs : leur accord
// inter-annotateur sur epistemicStatus est de 0,889 (kappa), très au-dessus du modèle.

// Le seul statut épistémique que le modèle affirme sans jamais se tromper, mesuré deux
// fois indépendamment (DEV-20 puis DEV-100).
export const TRUSTED_MODEL_STATUSES = Object.freeze(['refuted']);

export const FIELD_TRUST = Object.freeze({
  human: {
    rawStatement: 'human',
    supportSpans: 'human',
    epistemicStatus: 'human',
    knowledgeType: 'human',
    citationOccurrenceRefs: 'human'
  },
  model: {
    rawStatement: 'verified',
    supportSpans: 'verified',
    epistemicStatus: 'unresolved',
    knowledgeType: 'unresolved',
    citationOccurrenceRefs: 'unverified'
  }
});

function firstSpan(claim) {
  return (claim.supportSpans ?? [])[0] ?? null;
}

function spanLength(span) {
  return span ? span.relativeEndByte - span.relativeStartByte : 0;
}

// Une claim dont le span est STRICTEMENT contenu dans celui d'une autre est un
// morceau détaché de cette autre. Mesuré sur DEV-100 : ces claims ne correspondent à
// la référence que dans 27 % des cas, contre 77 % pour les autonomes, et la règle tient
// séparément sur F2 et sur F3. Deux claims au span identique sont toutes deux gardées —
// la GOLD elle-même en empile sur un span unique.
export function dropContainedClaims(claims) {
  const spans = claims.map(firstSpan);
  return claims.filter((claim, index) => {
    const mine = spans[index];
    if (!mine) return true;
    return !spans.some(
      (other, otherIndex) =>
        otherIndex !== index &&
        other &&
        other.relativeStartByte <= mine.relativeStartByte &&
        other.relativeEndByte >= mine.relativeEndByte &&
        spanLength(other) > spanLength(mine)
    );
  });
}

export function projectClaim(claim, { source }) {
  const trust = { ...FIELD_TRUST[source] };
  const human = source === 'human';
  const status = claim.epistemicStatus ?? null;
  const keepStatus = human || TRUSTED_MODEL_STATUSES.includes(status);
  if (!human && keepStatus) trust.epistemicStatus = 'verified';
  return {
    rawStatement: claim.rawStatement,
    supportSpans: claim.supportSpans ?? [],
    epistemicStatus: keepStatus ? status : null,
    knowledgeType: human ? (claim.knowledgeType ?? null) : null,
    citationOccurrenceRefs:
      claim.citationOccurrenceRefs ?? claim.citationOccurrenceIds ?? [],
    source,
    trust
  };
}

export function projectCorpus({ human = [], model = [] }) {
  const claims = [];
  let droppedAsContained = 0;
  let rejectedFragments = 0;

  for (const annotation of human) {
    for (const claim of annotation.expectedClaims ?? []) {
      claims.push({ fragmentId: annotation.fragmentId, ...projectClaim(claim, { source: 'human' }) });
    }
  }

  for (const record of model) {
    if (record.status === 'REJECTED' || !record.prediction) {
      rejectedFragments += 1;
      continue;
    }
    const produced = record.prediction.claims ?? [];
    const kept = dropContainedClaims(produced);
    droppedAsContained += produced.length - kept.length;
    for (const claim of kept) {
      claims.push({ fragmentId: record.fragmentId, ...projectClaim(claim, { source: 'model' }) });
    }
  }

  const humanClaims = claims.filter((item) => item.source === 'human').length;
  return {
    schemaVersion: '1.0.0-e5-corpus-projection',
    claims,
    summary: {
      fragments: human.length + model.length,
      claims: claims.length,
      humanClaims,
      modelClaims: claims.length - humanClaims,
      droppedAsContained,
      rejectedFragments,
      claimsWithTrustedStatus: claims.filter(
        (item) => item.trust.epistemicStatus === 'human' || item.trust.epistemicStatus === 'verified'
      ).length
    }
  };
}
