// Projection minimale d'une Claim vers une entrée de wiki.
//
// Cette projection est volontairement pauvre : son rôle dans cette phase n'est
// pas de produire un wiki, c'est de rendre INV-004 exécutable. Une projection
// est l'endroit exact où « ce qu'on ne peut PAS conclure » disparaît en
// pratique, parce que c'est la colonne qu'on est tenté de couper pour tenir
// dans une carte. Le test l'interdit ici, sur du code réel, plutôt que dans une
// consigne que la prochaine projection ne lira pas.
//
// Toute projection future — index vectoriel, context pack, dataset — doit
// exposer une fonction du même contrat et passer la même assertion.

export function projectClaimToWikiEntry(claim) {
  return {
    id: claim.id,
    slug: claim.slug,
    title: claim.canonicalStatement ?? claim.rawStatement,
    // rawStatement est toujours conservé : la normalisation ne remplace jamais
    // le texte extrait.
    rawStatement: claim.rawStatement,
    knowledgeType: claim.knowledgeType,
    epistemicStatus: claim.epistemicStatus,
    // Champ non facultatif de la projection. Le couper serait la perte
    // d'information la plus coûteuse du système.
    cannotConclude: [...(claim.cannotConclude ?? [])],
    limitations: [...(claim.limitations ?? [])],
    conditions: [...(claim.conditions ?? [])],
    provenance: (claim.provenance ?? []).map((p) => ({
      fragmentRef: p.fragmentRef,
      corpusFileRef: p.corpusFileRef
    })),
    assessmentRefs: [...(claim.assessmentRefs ?? [])]
  };
}

// Contrat que toute projection doit satisfaire, exposé pour être réutilisé par
// les projections futures plutôt que réécrit.
export const PROJECTION_PRESERVED_FIELDS = ['rawStatement', 'cannotConclude', 'provenance'];
