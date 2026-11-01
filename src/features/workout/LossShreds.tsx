/** Sept lambeaux : assez pour que la perte se déchire, assez peu pour rester lisible sur 30 px. */
const SHREDS = 7;

/**
 * Le morceau de vie perdu, déchiré en lambeaux qui montent et s'évaporent (« bien découpés, comme des
 * lambeaux »). Chaque lambeau a son bord déchiré, sa dérive, sa rotation et son retard — dans la feuille
 * du thème, par son rang : rien de tiré au sort, le même geste donne la même déchirure. Décoratif ;
 * caché hors du thème Cyber avec son conteneur.
 */
export function LossShreds() {
  return Array.from({ length: SHREDS }, (_, index) => (
    <span key={index} data-shred="" style={{ left: `${(index * 100) / SHREDS}%` }} />
  ));
}
