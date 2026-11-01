/** Cinq barres pour une barre de temps de 7 px : une tranche par ligne et demie. */
const BARS = 5;

/**
 * Le temps perdu, défait en fines barres horizontales qui montent, s'étirent, s'amincissent et
 * s'évaporent (« des barres qui s'évaporent pour les temps »). La barre de repos reste une barre jusque
 * dans sa perte ; le compteur de séries, lui, se déchire en lambeaux (`LossShreds`). Chaque barre a sa
 * hauteur, sa vitesse et son retard, dans la feuille du thème, par son rang.
 */
export function LossBars() {
  return Array.from({ length: BARS }, (_, index) => (
    <span key={index} data-bar="" style={{ top: `${(index * 100) / BARS}%` }} />
  ));
}
