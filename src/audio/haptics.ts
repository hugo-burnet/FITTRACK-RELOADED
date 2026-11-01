/** The end of a rest, felt. Two taps — the 10 ms tick already means "threshold crossed". */
export function buzzRestOver(): void {
  navigator.vibrate?.([80, 60, 80]);
}

/**
 * Une série validée, dans le thème Cyber : un coup franc et son écho, au tempo de l'impact. Sans
 * réglage, comme les autres vibrations de l'app (les 10 ms des seuils) : elle ne gêne personne.
 */
export function buzzSetImpact(): void {
  navigator.vibrate?.([40, 20, 12]);
}
