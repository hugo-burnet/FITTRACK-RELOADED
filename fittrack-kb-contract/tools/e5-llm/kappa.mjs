// Accord corrigé du hasard. L'accord brut ment quand une catégorie domine : deux
// annotateurs qui cochent « probable » 90 % du temps s'accordent à 0,90 sans se
// concerter. Le kappa retire cette part et répond à la seule question utile — est-ce
// que la consigne d'annotation est assez claire pour que deux personnes convergent
// autrement que par hasard ?
//
// Repère de métier pour une grille d'évaluation LLM : viser 0,70 à 0,85 par critère.
// Sous 0,70 la grille est ambiguë et les étiquettes sont du bruit ; au-dessus de 0,90
// elle ne capture généralement que les cas évidents.

// Bande cible : [0,70 ; 0,90[. Sous le plancher, l'étiquette est du bruit ; à partir
// de 0,90, la grille ne distingue généralement plus que les cas évidents, donc elle
// ne mesure plus grand-chose. Viser 0,70–0,85 à l'intérieur de cette bande.
export const RELIABILITY_FLOOR = 0.7;
export const RELIABILITY_TOO_COARSE = 0.9;

function totals(matrix) {
  let total = 0;
  let agreed = 0;
  const rowSums = {};
  const colSums = {};
  for (const [gold, predictions] of Object.entries(matrix)) {
    for (const [predicted, count] of Object.entries(predictions)) {
      total += count;
      if (gold === predicted) agreed += count;
      rowSums[gold] = (rowSums[gold] ?? 0) + count;
      colSums[predicted] = (colSums[predicted] ?? 0) + count;
    }
  }
  return { total, agreed, rowSums, colSums };
}

export function observedAgreement(matrix) {
  const { total, agreed } = totals(matrix);
  return total === 0 ? null : agreed / total;
}

export function cohensKappa(matrix) {
  const { total, agreed, rowSums, colSums } = totals(matrix);
  if (total === 0) return null;
  const po = agreed / total;
  let pe = 0;
  for (const label of new Set([...Object.keys(rowSums), ...Object.keys(colSums)])) {
    pe += ((rowSums[label] ?? 0) / total) * ((colSums[label] ?? 0) / total);
  }
  // Accord parfait ET distribution dégénérée : tout le monde a coché la même case.
  // Le kappa est indéfini ; on rend 1 quand l'accord est total, sinon 0.
  if (pe === 1) return po === 1 ? 1 : 0;
  return (po - pe) / (1 - pe);
}

// Regroupe une échelle fine en une échelle plus grossière. Les désaccords internes à
// un groupe deviennent des accords : c'est précisément l'effet qu'on veut chiffrer
// avant de décider de simplifier le vocabulaire.
export function collapseConfusionMatrix(matrix, mapping) {
  const collapsed = {};
  for (const [gold, predictions] of Object.entries(matrix)) {
    const goldGroup = mapping[gold];
    if (goldGroup === undefined) throw new Error(`unmapped_label:${gold}`);
    for (const [predicted, count] of Object.entries(predictions)) {
      const predictedGroup = mapping[predicted];
      if (predictedGroup === undefined) throw new Error(`unmapped_label:${predicted}`);
      collapsed[goldGroup] ??= {};
      collapsed[goldGroup][predictedGroup] = (collapsed[goldGroup][predictedGroup] ?? 0) + count;
    }
  }
  return collapsed;
}

export function reliabilityVerdict(kappa) {
  if (kappa === null || kappa === undefined) return 'non_mesurable';
  if (kappa < RELIABILITY_FLOOR) return 'bruit';
  if (kappa >= RELIABILITY_TOO_COARSE) return 'trop_grossier';
  return 'utilisable';
}
