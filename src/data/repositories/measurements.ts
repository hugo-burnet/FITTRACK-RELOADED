import Dexie from 'dexie';
import { db } from '@/data/db';
import { alive, newEntity, softDelete, touch } from '@/data/repositories/base';
import type { BodyMeasurement } from '@/data/types';
import {
  BODY_WEIGHT_TYPE,
  compareMeasurementTypes,
  isPlausibleMeasurement,
  localDayBounds,
  presetUnit,
  roundMeasurement,
} from '@/lib/bodyMeasurements';
import { deleteBodyWeight, saveBodyWeight } from './bodyMeasurements';

/**
 * Les mesures du corps, toutes — poids compris. Cf. `docs/design/specs/2026-10-14-mensurations-design.md`.
 *
 * `bodyMeasurements.ts` possède le poids **et ce qu'il fait aux records** (tonnage au poids du
 * corps) ; ce fichier possède la liste, la saisie et la suppression des mesures en général, et
 * renvoie le poids à son dépôt dès qu'il le rencontre. Un seul écran lit les deux : il ne doit pas
 * avoir à savoir lequel écrit quoi.
 */

export interface MeasurementReading {
  id: string;
  type: string;
  value: number;
  unit: string;
  measuredAt: number;
}

/** Une mesure suivie, telle que la liste la montre. */
export interface MeasuredType {
  type: string;
  /** L'unité de la dernière ligne : l'historique garde la sienne, pas celle du catalogue. */
  unit: string;
  count: number;
  latest: MeasurementReading;
  /** La mesure d'avant la dernière : de quoi dire « −0,3 cm » sans relire toute la série. */
  previous?: MeasurementReading;
}

function asReading(row: BodyMeasurement): MeasurementReading {
  return {
    id: row.id,
    type: row.type,
    value: row.value,
    unit: row.unit,
    measuredAt: row.measuredAt,
  };
}

/** Les mesures vivantes d'un type, la plus ancienne d'abord. */
export async function listMeasurements(type: string): Promise<MeasurementReading[]> {
  const rows = await db.bodyMeasurements
    .where('[type+measuredAt]')
    .between([type, Dexie.minKey], [type, Dexie.maxKey])
    .toArray();

  return alive(rows)
    .sort((left, right) => left.measuredAt - right.measuredAt || left.createdAt - right.createdAt)
    .map(asReading);
}

/**
 * Les mesures qui ont au moins une ligne vivante, dans l'ordre de la liste : le catalogue d'abord,
 * puis les champs libres. Un type dont toutes les lignes sont supprimées n'y figure plus — il n'y a
 * rien à montrer, et rien à promettre en le nommant.
 */
export async function listMeasurementTypes(): Promise<MeasuredType[]> {
  const types = (await db.bodyMeasurements.orderBy('type').uniqueKeys()) as string[];

  const entries = await Promise.all(
    types.map(async (type): Promise<MeasuredType | undefined> => {
      const readings = await listMeasurements(type);
      const latest = readings[readings.length - 1];
      if (latest === undefined) return undefined;

      const previous = readings[readings.length - 2];
      return {
        type,
        unit: latest.unit,
        count: readings.length,
        latest,
        ...(previous === undefined ? {} : { previous }),
      };
    }),
  );

  return entries
    .filter((entry): entry is MeasuredType => entry !== undefined)
    .sort((left, right) => compareMeasurementTypes(left.type, right.type));
}

export interface MeasurementInput {
  type: string;
  value: number;
  unit: string;
  /** Défaut : maintenant. Une date passée est une saisie rétroactive. */
  measuredAt?: number;
}

/**
 * Enregistre une mesure : **une par type et par jour local**, la valeur d'un jour déjà mesuré est
 * remplacée et garde son instant — la règle du poids, que `saveBodyWeight` applique depuis le
 * début, étendue à tout.
 *
 * Le poids de corps passe par `saveBodyWeight`, sans exception : il nourrit les records, et une
 * saisie rétrodatée doit refaire le tonnage des séances qu'elle touche. Une mesure du catalogue
 * prend l'unité du catalogue, quoi que dise l'appelant ; un champ libre garde la sienne. Hors
 * plage, la valeur est refusée avant toute écriture (cf. `isPlausibleMeasurement`).
 */
export async function saveMeasurement(input: MeasurementInput): Promise<void> {
  const { type, measuredAt = Date.now() } = input;
  const unit = presetUnit(type) ?? input.unit;
  if (type === '' || unit === '' || !isPlausibleMeasurement(type, unit, input.value)) {
    throw new RangeError('Measurement must be a plausible positive number with a type and a unit');
  }
  const value = roundMeasurement(input.value);

  if (type === BODY_WEIGHT_TYPE) {
    await saveBodyWeight(value, measuredAt);
    return;
  }

  const [dayStart, nextDayStart] = localDayBounds(measuredAt);
  await db.transaction('rw', db.bodyMeasurements, async () => {
    const sameDay = alive(
      await db.bodyMeasurements
        .where('[type+measuredAt]')
        .between([type, dayStart], [type, nextDayStart], true, false)
        .toArray(),
    );
    const existing = sameDay[0];

    if (existing === undefined) {
      await db.bodyMeasurements.add(newEntity<BodyMeasurement>({ type, value, unit, measuredAt }));
    } else {
      // Une correction change la valeur du jour, pas l'instant qui la date.
      await db.bodyMeasurements.put(touch(existing, { value, unit }));
    }
  });
}

/**
 * Supprime une mesure, doucement (ADR-002). Un poids repasse par son dépôt, qui refait les records
 * des séances qu'il couvrait ; une ligne inconnue ou déjà supprimée n'est pas une erreur.
 */
export async function deleteMeasurement(measurementId: string): Promise<void> {
  const row = await db.bodyMeasurements.get(measurementId);
  if (row === undefined || row.deletedAt !== 0) return;

  if (row.type === BODY_WEIGHT_TYPE) {
    await deleteBodyWeight(measurementId);
    return;
  }
  await softDelete(db.bodyMeasurements, measurementId);
}
