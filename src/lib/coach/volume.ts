import { MUSCLE_GROUPS, type MuscleGroup } from '@/data/types';
import { MUSCLE_SCOPE } from '@/lib/analytics/muscles';
import { addLocalWeeks, startOfLocalWeek } from '@/lib/history';

/**
 * R6 — le muscle et la semaine. Cf. `docs/design/specs/2026-10-04-coach-v2-design.md`, R6, et son
 * amendement du 2026-10-14.
 *
 * Pur : des séances en entrée, un instant en paramètre, des constats en sortie. Le volume est celui
 * de `muscleBalance` — des **séries directes comptées**, muscle principal pour 1, jamais pondérées :
 * un nombre de séries se vérifie dans l'historique, un score se croit sur parole.
 *
 * **Aucun chiffre universel.** Les bornes viennent de ce que la personne a déjà tenu, et c'est elle
 * qui les corrige (décision Q3). Chaque seuil ci-dessous est une politique de l'app, pas une vérité.
 */

/** Les semaines complètes lues pour dire ce que la personne tient d'habitude. */
export const VOLUME_REFERENCE_WEEKS = 6;
/** En dessous, l'historique ne dit rien du muscle : la règle se tait (invariant 2). */
export const VOLUME_MIN_WEEKS_WORKED = 3;
/** Semaines consécutives sous le plancher posé avant de le dire. */
export const VOLUME_LOW_WEEKS = 2;

const DAY_MS = 86_400_000;

/** Les séries de travail d'un muscle dans une séance : ce que la lecture du volume consomme. */
export interface VolumeEntry {
  /** Le début de la séance. */
  at: number;
  /** Le muscle principal tel que la séance l'a enregistré ; `undefined` s'il n'a pas pu être lu. */
  muscle: MuscleGroup | undefined;
  /** Séries de travail (l'échauffement n'entre jamais, cf. `isWorkingSet`). */
  sets: number;
}

export interface VolumeBounds {
  /** Séries par semaine en dessous desquelles la personne veut qu'on le lui dise. */
  floor?: number;
  /** Séries par semaine au-delà desquelles le coach ne propose plus d'en ajouter. */
  ceiling?: number;
}

export type VolumeBoundsByMuscle = Partial<Record<MuscleGroup, VolumeBounds>>;

/** Au-delà, ce n'est plus un nombre de séries par semaine mais une faute de frappe. */
export const VOLUME_BOUND_MAX = 99;

/** Une borne est un nombre entier de séries, de 1 à `VOLUME_BOUND_MAX`. */
export function isVolumeBound(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= VOLUME_BOUND_MAX
  );
}

/**
 * Les bornes telles qu'un réglage les relit. La sauvegarde ne valide pas la valeur d'un réglage — une
 * clé et une date lui suffisent — : une valeur abîmée à la main ne doit ni casser l'écran ni
 * inventer une borne. Ce qui est juste est gardé, le reste tombe, et un muscle sans borne disparaît.
 */
export function normalizeVolumeBounds(value: unknown): VolumeBoundsByMuscle {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};

  const stored = value as Record<string, unknown>;
  const bounds: VolumeBoundsByMuscle = {};
  for (const muscle of MUSCLE_GROUPS) {
    if (MUSCLE_SCOPE[muscle] !== 'region') continue;

    const entry = stored[muscle];
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;

    const { floor, ceiling } = entry as Record<string, unknown>;
    const kept: VolumeBounds = {
      ...(isVolumeBound(floor) ? { floor } : {}),
      ...(isVolumeBound(ceiling) ? { ceiling } : {}),
    };
    if (kept.floor !== undefined || kept.ceiling !== undefined) bounds[muscle] = kept;
  }
  return bounds;
}

/** Un lundi 00:00 local, et le lundi suivant (borne haute exclue). */
export interface LocalWeek {
  start: number;
  end: number;
}

/** Les séries directes d'un muscle sur les sept derniers jours glissants, `now` compris. */
export function rollingWeekSets(
  entries: readonly VolumeEntry[],
  muscle: MuscleGroup,
  now: number,
): number {
  const since = now - 7 * DAY_MS;
  return entries
    .filter((entry) => entry.muscle === muscle && entry.at > since && entry.at <= now)
    .reduce((total, entry) => total + entry.sets, 0);
}

/**
 * Les semaines complètes qui précèdent la semaine en cours, de la plus ancienne à la dernière.
 *
 * Lundi à lundi, en jour local — par le calendrier et non par 168 heures : une semaine en compte 167
 * ou 169 deux fois l'an. La semaine en cours est incomplète : elle ne juge personne.
 */
export function completeWeeks(now: number, count = VOLUME_REFERENCE_WEEKS): LocalWeek[] {
  const current = startOfLocalWeek(now);
  return Array.from({ length: count }, (_, index) => {
    const start = addLocalWeeks(current, index - count);
    return { start, end: addLocalWeeks(start, 1) };
  });
}

function setsIn(entries: readonly VolumeEntry[], muscle: MuscleGroup, week: LocalWeek): number {
  return entries
    .filter((entry) => entry.muscle === muscle && entry.at >= week.start && entry.at < week.end)
    .reduce((total, entry) => total + entry.sets, 0);
}

/** Une semaine où la personne s'est entraînée, quel que soit le muscle. */
function isActiveWeek(entries: readonly VolumeEntry[], week: LocalWeek): boolean {
  return entries.some((entry) => entry.sets > 0 && entry.at >= week.start && entry.at < week.end);
}

function median(sorted: readonly number[]): number {
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export interface VolumeOverview {
  /** Les séries des sept derniers jours glissants. */
  rollingSets: number;
  /** Les séries de chacune des six semaines complètes, de la plus ancienne à la dernière. */
  weeks: number[];
  /** Les semaines, sur les six, où le muscle a été travaillé. */
  weeksWorked: number;
  /** La médiane des semaines **travaillées** : ce que la personne fait quand elle le travaille. */
  median?: number;
  /** Le plus haut volume hebdomadaire des six semaines : ce que la personne a déjà tenu. */
  max?: number;
}

/**
 * Ce que l'historique dit d'un muscle. La médiane est celle des semaines travaillées, pas des six :
 * deux semaines de repos sur six feraient une médiane de zéro, et un plancher qui s'en inspirerait
 * serait absurde.
 */
export function volumeOverview(
  entries: readonly VolumeEntry[],
  muscle: MuscleGroup,
  now: number,
): VolumeOverview {
  const weeks = completeWeeks(now).map((week) => setsIn(entries, muscle, week));
  const worked = weeks.filter((sets) => sets > 0).sort((left, right) => left - right);

  return {
    rollingSets: rollingWeekSets(entries, muscle, now),
    weeks,
    weeksWorked: worked.length,
    ...(worked.length === 0 ? {} : { median: median(worked), max: worked[worked.length - 1]! }),
  };
}

/**
 * Le plafond au-delà duquel le coach ne propose plus d'ajouter une série.
 *
 * Celui que la personne a posé, sinon **le plus haut volume qu'elle a déjà tenu** — à condition que
 * l'historique le dise : il faut au moins trois semaines où le muscle a été travaillé. La règle
 * n'empêche pas de progresser en volume ; elle empêche le coach de proposer d'aller au-delà de ce
 * qui a déjà été tenu. Un plancher seul ne pose pas de plafond.
 */
export function effectiveCeiling(
  overview: VolumeOverview,
  bounds?: VolumeBounds,
): number | undefined {
  if (bounds?.ceiling !== undefined) return bounds.ceiling;
  return overview.weeksWorked >= VOLUME_MIN_WEEKS_WORKED ? overview.max : undefined;
}

/** Ce que le moteur lit : le volume de la semaine et le plafond. Rien quand la règle se tait. */
export interface MuscleVolumeContext {
  rollingSets: number;
  ceiling: number;
  /** Le plafond a été posé par la personne, pas tiré de son historique : la carte le dit autrement. */
  userSet: boolean;
}

export function muscleVolumeContext(
  entries: readonly VolumeEntry[],
  muscle: MuscleGroup,
  bounds: VolumeBoundsByMuscle | undefined,
  now: number,
): MuscleVolumeContext | undefined {
  // Un groupe qui n'est pas une région (cardio, tout le corps, autre) n'a pas de volume à borner :
  // un zéro n'y dit rien.
  if (MUSCLE_SCOPE[muscle] !== 'region') return undefined;

  const overview = volumeOverview(entries, muscle, now);
  const ceiling = effectiveCeiling(overview, bounds?.[muscle]);
  if (ceiling === undefined) return undefined;

  return {
    rollingSets: overview.rollingSets,
    ceiling,
    userSet: bounds?.[muscle]?.ceiling !== undefined,
  };
}

export interface VolumeLow {
  muscle: MuscleGroup;
  floor: number;
  /** Les séries des deux dernières semaines complètes, la plus ancienne d'abord. */
  weeks: number[];
}

/**
 * Les muscles sous le plancher que la personne a posé, deux semaines complètes de suite.
 *
 * **Sans plancher posé, jamais** : l'app ne décide pas que 3,8 séries d'ischios, c'est trop peu —
 * c'est peut-être un choix. Et **une semaine sans séance n'est pas un volume bas** : deux semaines
 * de vacances ne doivent pas faire autant d'alertes qu'il y a de planchers. Il faut une séance, tous
 * muscles confondus, dans chacune des deux semaines.
 */
export function volumeLowMuscles(
  entries: readonly VolumeEntry[],
  bounds: VolumeBoundsByMuscle,
  now: number,
): VolumeLow[] {
  const weeks = completeWeeks(now, VOLUME_LOW_WEEKS);
  if (!weeks.every((week) => isActiveWeek(entries, week))) return [];

  const lows: VolumeLow[] = [];
  for (const muscle of MUSCLE_GROUPS) {
    const floor = bounds[muscle]?.floor;
    if (floor === undefined || floor <= 0 || MUSCLE_SCOPE[muscle] !== 'region') continue;

    const sets = weeks.map((week) => setsIn(entries, muscle, week));
    if (sets.every((count) => count < floor)) lows.push({ muscle, floor, weeks: sets });
  }
  return lows;
}
