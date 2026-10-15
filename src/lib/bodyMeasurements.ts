/**
 * Les mesures du corps : ce qui se mesure, ce qui est plausible, à quelle date, et ce que dit
 * une série. Pur par construction (architecture §7) — pas de Dexie, pas d'horloge : l'instant
 * présent arrive en paramètre, comme dans `lib/analytics/periods.ts`.
 *
 * Cf. `docs/design/specs/2026-10-14-mensurations-design.md`.
 */

/** Le seul type que le reste de l'app lit : il nourrit le tonnage au poids du corps. */
export const BODY_WEIGHT_TYPE = 'body_weight';

const CUSTOM_PREFIX = 'custom:';

/** Un nom de champ libre tient sur une ligne de liste ; au-delà il serait coupé à l'écran. */
export const CUSTOM_NAME_MAX = 40;

export type MeasurementUnit = 'kg' | '%' | 'cm';

/**
 * Le catalogue, dans l'ordre où l'écran le montre. Les paires gauche et droite existent parce
 * qu'une asymétrie est ce qu'un pratiquant cherche à voir ; la clé est en anglais (cf.
 * `BodyMeasurement.type`), le libellé français vit dans `fr.ts`.
 */
export const PRESET_MEASUREMENTS = [
  { type: BODY_WEIGHT_TYPE, unit: 'kg' },
  { type: 'body_fat', unit: '%' },
  { type: 'neck', unit: 'cm' },
  { type: 'shoulders', unit: 'cm' },
  { type: 'chest', unit: 'cm' },
  { type: 'waist', unit: 'cm' },
  { type: 'hips', unit: 'cm' },
  { type: 'left_biceps', unit: 'cm' },
  { type: 'right_biceps', unit: 'cm' },
  { type: 'left_forearm', unit: 'cm' },
  { type: 'right_forearm', unit: 'cm' },
  { type: 'left_thigh', unit: 'cm' },
  { type: 'right_thigh', unit: 'cm' },
  { type: 'left_calf', unit: 'cm' },
  { type: 'right_calf', unit: 'cm' },
] as const satisfies readonly { type: string; unit: MeasurementUnit }[];

export type PresetMeasurementType = (typeof PRESET_MEASUREMENTS)[number]['type'];

/** Les unités qu'un champ libre peut prendre : celles qu'on sait juger plausibles. */
export const CUSTOM_UNITS: readonly MeasurementUnit[] = ['cm', 'kg', '%'];

const PRESET_RANK = new Map<string, number>(
  PRESET_MEASUREMENTS.map((preset, index) => [preset.type, index]),
);
const PRESET_UNIT = new Map<string, MeasurementUnit>(
  PRESET_MEASUREMENTS.map((preset) => [preset.type, preset.unit]),
);

export function isPresetType(type: string): type is PresetMeasurementType {
  return PRESET_RANK.has(type);
}

/** L'unité du catalogue, ou rien : un champ libre choisit la sienne. */
export function presetUnit(type: string): MeasurementUnit | undefined {
  return PRESET_UNIT.get(type);
}

export function isCustomType(type: string): boolean {
  return type.startsWith(CUSTOM_PREFIX);
}

/**
 * Le `type` sous lequel un champ libre est rangé, ou rien quand le nom est vide.
 *
 * Le préfixe n'est pas décoratif : sans lui, un champ libre nommé « body_weight » se rangerait
 * sous la clé du poids — qui touche aux records — avec l'unité qu'on lui aurait donnée. Le nom
 * garde sa casse et n'est jamais traduit.
 */
export function customType(name: string): string | undefined {
  const normalized = name.replace(/\s+/g, ' ').trim().slice(0, CUSTOM_NAME_MAX).trim();
  return normalized === '' ? undefined : `${CUSTOM_PREFIX}${normalized}`;
}

/** Le nom saisi d'un champ libre, tel quel ; rien pour une mesure du catalogue. */
export function customName(type: string): string | undefined {
  if (!isCustomType(type)) return undefined;
  const name = type.slice(CUSTOM_PREFIX.length);
  return name === '' ? undefined : name;
}

/**
 * Une valeur qui a une chance d'être juste. Une faute de frappe (825 cm de tour de taille) ne
 * doit pas écraser pour toujours l'échelle d'une courbe dont les bornes sont celles des données.
 *
 * **Le poids de corps garde la règle du 2026-08-10** — tout nombre fini strictement positif, pas
 * de maximum arbitraire — parce que c'est celle de `saveBodyWeight`, que cet écran ne doit pas
 * contredire. Une unité inconnue (une donnée venue d'ailleurs) n'est pas jugée.
 */
export function isPlausibleMeasurement(type: string, unit: string, value: number): boolean {
  if (!Number.isFinite(value) || value <= 0) return false;
  if (type === BODY_WEIGHT_TYPE) return true;

  switch (unit) {
    case '%':
      return value < 100;
    case 'cm':
      return value <= 300;
    case 'kg':
      return value <= 1000;
    default:
      return true;
  }
}

/**
 * Deux décimales : ce qui est enregistré est ce qui s'affiche. Passer par la chaîne (« 1.005e2 »)
 * et non par `value * 100` : en flottants, 1,005 × 100 vaut 100,49999999999999 et s'arrondirait
 * à 1 au lieu de 1,01.
 */
export function roundMeasurement(value: number): number {
  const shifted = Number(`${value}e2`);
  // Une valeur déjà notée en exposant (1e-7) ne se décale pas par la chaîne.
  const rounded = Number.isNaN(shifted) ? Math.round(value * 100) : Math.round(shifted);
  const result = rounded / 100;
  // −0 s'afficherait « −0 » et ne serait pas égal à 0 : un écart nul doit être nul.
  return result === 0 ? 0 : result;
}

/** `AAAA-MM-JJ` en jour **local** : la valeur d'un `<input type="date">`. */
export function dayInputValue(timestamp: number): string {
  const date = new Date(timestamp);
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * `[début, début du lendemain[` du jour local qui contient l'instant. Par le calendrier et non par
 * 24 heures : le jour du changement d'heure en compte 23 ou 25.
 */
export function localDayBounds(timestamp: number): readonly [number, number] {
  const start = new Date(timestamp);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return [start.getTime(), end.getTime()];
}

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * L'instant qu'une date saisie donne à la mesure, ou rien quand la date est refusée.
 *
 * **Aujourd'hui** s'enregistre à l'instant présent : c'est ce que fait déjà la tuile de l'accueil,
 * et une séance de ce matin ne doit pas découvrir un poids pesé ce soir. **Un autre jour**
 * s'enregistre au début de ce jour local : le poids du 3 octobre vaut pour toutes les séances du 3.
 * Demain et au-delà sont refusés — on ne mesure pas l'avenir —, comme un jour que le calendrier
 * n'a pas : `new Date(2026, 1, 30)` glisserait au 2 mars sans le dire.
 */
export function measuredAtForDay(day: string, now: number): number | undefined {
  const match = DAY_PATTERN.exec(day);
  if (match === null) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const date = Number(match[3]);
  const start = new Date(year, month, date);
  if (start.getFullYear() !== year || start.getMonth() !== month || start.getDate() !== date) {
    return undefined;
  }

  if (day === dayInputValue(now)) return now;
  return start.getTime() > now ? undefined : start.getTime();
}

export interface DatedValue {
  value: number;
  measuredAt: number;
}

/**
 * Ce que la série a fait : la différence entre la dernière mesure et la première, et la date de
 * celle-ci. Rien avec moins de deux mesures — un écart demande deux points.
 *
 * Arrondi à deux décimales : 84,3 − 82,8 vaut 1,5000000000000142 en flottants, et une série
 * stable doit dire 0, pas 5,5e-17.
 */
export function readingChange(
  readings: readonly DatedValue[],
): { change: number; since: number } | undefined {
  if (readings.length < 2) return undefined;

  const ordered = [...readings].sort((left, right) => left.measuredAt - right.measuredAt);
  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;
  return { change: roundMeasurement(last.value - first.value), since: first.measuredAt };
}

/**
 * L'ordre des mesures d'une liste : le catalogue d'abord, dans son ordre, puis tout le reste par
 * ordre alphabétique du nom qu'on lit. Un type inconnu (une donnée venue d'ailleurs) tombe avec
 * les champs libres plutôt que de disparaître.
 */
export function compareMeasurementTypes(left: string, right: string): number {
  const leftRank = PRESET_RANK.get(left) ?? Number.POSITIVE_INFINITY;
  const rightRank = PRESET_RANK.get(right) ?? Number.POSITIVE_INFINITY;
  if (leftRank !== rightRank) return leftRank < rightRank ? -1 : 1;

  return (customName(left) ?? left).localeCompare(customName(right) ?? right, 'fr');
}
