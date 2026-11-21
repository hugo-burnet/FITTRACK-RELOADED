import type { WeeklyVolumeBucket } from './volume';
import type { WeekBucket } from './weeks';

/**
 * Ce que les tuiles de Progression composent à partir des fonctions de calcul des écrans qu'elles ouvrent.
 *
 * Rien ici ne relit la base ni ne découpe une semaine : les seaux arrivent de `weeklyVolumeBuckets` et de
 * `weeklySessionCounts`, qui rangent une séance dans la semaine de **son** fuseau (`weekStartOf`). Une tuile
 * qui recalculerait sa semaine autrement dirait, après un voyage, un autre nombre que la page qu'elle ouvre.
 */

/** Les points de la mini-courbe de la tuile « Tonnage ». */
export const SPARKLINE_WEEKS = 8;
/** La fenêtre de la moyenne : celle que l'écran Volume ouvre par défaut (`12w`). */
export const AVERAGE_WEEKS = 12;

export interface WeekTonnage {
  /** La semaine en cours : le dernier seau. */
  current: number;
  /** Les huit dernières semaines, la plus ancienne d'abord, la semaine en cours en dernier. */
  series: number[];
  /** Moyenne des douze dernières semaines connues, semaine en cours comprise, zéros compris. */
  average: number;
  /** Le nombre de semaines que `average` porte : douze au plus, moins quand l'histoire est plus courte. */
  averageWeeks: number;
}

/**
 * `buckets` finit toujours à la semaine en cours (`periodBounds` borne `to` à la fin de cette semaine) ;
 * vide seulement quand aucune séance n'existe — alors rien à montrer, et `null`.
 */
export function weekTonnage(buckets: readonly WeeklyVolumeBucket[]): WeekTonnage | null {
  const last = buckets[buckets.length - 1];
  if (last === undefined) return null;

  const window = buckets.slice(-AVERAGE_WEEKS);
  const total = window.reduce((sum, bucket) => sum + bucket.tonnage, 0);

  return {
    current: last.tonnage,
    series: buckets.slice(-SPARKLINE_WEEKS).map((bucket) => bucket.tonnage),
    average: total / window.length,
    averageWeeks: window.length,
  };
}

/**
 * Les semaines tenues d'affilée, en remontant depuis la semaine en cours.
 *
 * La semaine en cours compte quand elle est tenue, et **ne casse rien** quand elle ne l'est pas encore : un
 * mardi à une séance sur trois n'est pas une série perdue. Même règle que `calculateWeeklyRegularity`, sur
 * le découpage de l'écran « Séances par semaine ». Une semaine sans objectif n'est pas tenue.
 */
export function heldWeeksStreak(buckets: readonly WeekBucket[]): number {
  let index = buckets.length - 1;
  const current = buckets[index];
  if (current === undefined) return 0;
  if (current.goal === null || current.sessions < current.goal) index -= 1;

  let streak = 0;
  for (; index >= 0; index -= 1) {
    const week = buckets[index]!;
    if (week.goal === null || week.sessions < week.goal) break;
    streak += 1;
  }
  return streak;
}

export interface WeekSessions {
  done: number;
  goal: number | null;
  streak: number;
}

export function weekSessions(buckets: readonly WeekBucket[]): WeekSessions | null {
  const current = buckets[buckets.length - 1];
  if (current === undefined) return null;
  return { done: current.sessions, goal: current.goal, streak: heldWeeksStreak(buckets) };
}

/**
 * L'écart avec la pesée précédente, arrondi au centième : `82,4 − 84,1` vaut `−1,6999999999999886`, et
 * personne ne doit lire cela — ni un « 0 » qui n'en est pas un.
 */
export function weightChange(latestKg: number, previousKg: number | undefined): number | undefined {
  if (previousKg === undefined) return undefined;
  const change = Math.round((latestKg - previousKg) * 100) / 100;
  return change === 0 ? 0 : change;
}

/**
 * Le dernier jour d'un programme : sept jours par semaine depuis `startsAt`, moins le jour de départ.
 * `setDate` plutôt que `+ n × 86 400 000` : une semaine ne fait pas toujours 168 heures.
 */
export function programEndDate(startsAt: number, durationWeeks: number): number {
  const date = new Date(startsAt);
  date.setDate(date.getDate() + durationWeeks * 7 - 1);
  return date.getTime();
}

/**
 * « 85 kg » → le chiffre et son unité, que `Tile` met en forme séparément. Ce qui ne se termine pas par un
 * mot sans chiffre (« 27 », « 1 h 05 ») reste un seul morceau : couper « 1 h » de « 05 » le rendrait faux.
 */
export function splitReading(reading: string): { value: string; unit?: string } {
  const cut = reading.lastIndexOf(' ');
  if (cut === -1) return { value: reading };
  const unit = reading.slice(cut + 1);
  if (/\d/.test(unit)) return { value: reading };
  return { value: reading.slice(0, cut), unit };
}
