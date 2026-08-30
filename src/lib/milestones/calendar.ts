/**
 * Le même jour, N années plus tard — en calendrier local, jamais en millisecondes.
 *
 * Ajouter `365 * 86 400 000` aurait dérivé d'un jour par bissextile : au bout de
 * dix ans, l'anniversaire des dix ans serait tombé deux jours avant la date. Ce
 * décalage est invisible en test unitaire à un an et faux à cinq.
 *
 * Le 29 février n'existe pas trois années sur quatre ; `setFullYear` le reporte
 * alors au 1er mars, ce qui est le comportement de JavaScript et la seule
 * convention qu'un calendrier grégorien permette sans arbitrage. Les deux
 * lecteurs de cette fonction tolèrent le report : le moteur cherche la première
 * séance *à partir de* cette date, la rétrospective ouvre une fenêtre d'une
 * semaine.
 *
 * Partagée par le moteur et la rétrospective : deux implémentations de
 * l'anniversaire, ce sont deux écrans qui ne fêtent pas le même jour.
 */
export function anniversaryOf(from: number, years: number): number {
  const date = new Date(from);
  date.setFullYear(date.getFullYear() + years);
  return date.getTime();
}
