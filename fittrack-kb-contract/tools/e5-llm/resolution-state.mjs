// Un axe est soit tranché, soit pas. Le schéma déclare quatre états sans en définir
// aucun, et deux d'entre eux — `UNRESOLVED` et `NOT_STATED` — disent la même chose :
// l'information n'est pas dans le fragment.
//
// Ce n'est pas une lecture d'opinion, c'est mesuré. Deux annotateurs entraînés ne
// parviennent pas à appliquer la distinction (kappa 0,17 sur `confidenceByAspect` ;
// l'un écrit `NOT_STATED` là où l'autre écrit `UNRESOLVED` 54 fois sur 85). Et le
// prompt système n'enseignait que `UNRESOLVED`, alors que la GOLD emploie
// `NOT_STATED` 256 fois : le modèle obéissait à sa consigne et se faisait compter
// faux 43 fois sur un vocabulaire qu'on ne lui avait jamais donné.
//
// La distinction qui compte réellement, et la seule qui porte un risque, est
// ailleurs : le modèle a-t-il TRANCHÉ là où la référence s'abstient ? Trancher à tort
// invente de la certitude. Choisir l'autre synonyme n'invente rien.
export const RESOLVED_STATE = 'RESOLVED';
export const NOT_RESOLVED_STATES = Object.freeze(['UNRESOLVED', 'NOT_STATED', 'NOT_APPLICABLE']);

export function isResolved(state) {
  return state === RESOLVED_STATE;
}

export function sameResolutionState(left, right) {
  return isResolved(left) === isResolved(right);
}

// Sépare les désaccords d'axe en trois familles, parce qu'elles n'ont pas du tout la
// même gravité et que les confondre a produit un score faux.
export function classifyResolutionDisagreement(goldenState, predictedState) {
  if (sameResolutionState(goldenState, predictedState)) {
    return goldenState === predictedState ? 'IDENTICAL' : 'VOCABULARY_ONLY';
  }
  return isResolved(predictedState) ? 'OVER_RESOLVED' : 'OVER_ABSTAINED';
}
