import { db } from '@/data/db';
import type { Milestone } from '@/data/types';
import type { HistoricalWorkout } from '@/lib/historyProjection';
import { earnMilestones } from '@/lib/milestones/engine';
import type { EarnedMilestone, MilestoneSet } from '@/lib/milestones/types';
import { effectiveLoadKg } from '@/lib/volume';
import { volumeEntriesOf } from '@/lib/volumeSource';
import { alive, newEntity, softDelete, touch } from './base';
import { listHistoricalWorkouts } from './historicalWorkouts';

/**
 * Les paliers en base : une projection de l'historique, plus une mémoire.
 *
 * **La projection** se recalcule en entier à chaque appel, comme les records.
 * C'est ce qui fait qu'un import de dix ans de Hevy rend ses paliers à leurs
 * vraies dates, et qu'une séance corrigée après coup ne laisse pas un palier
 * faux derrière elle.
 *
 * **La mémoire** est ce qui ne se recalcule pas : `acknowledgedAt`. Sans elle la
 * même carte reviendrait à chaque ouverture de l'accueil, ce qui est la
 * définition du spam — et la seule chose qui puisse tuer la fonctionnalité.
 */

const PROJECTION_KEY = 'milestonesProjectionVersion';
const RETROSPECTIVES_KEY = 'milestoneRetrospectivesSeen';

export const MILESTONES_PROJECTION_VERSION = 1;

/**
 * Une séance archivée, traduite pour le moteur.
 *
 * **Toutes les séries d'une séance portent l'instant de la séance**, et non
 * celui de leur validation. La projection d'historique ne transporte pas
 * `performedAt`, et c'est sans conséquence ici : un palier se date d'un jour,
 * pas d'une minute. L'ordre à l'intérieur d'une séance reste celui des
 * exercices puis des séries, que `listHistoricalWorkouts` garantit et que le tri
 * stable du moteur préserve.
 */
function milestoneSetsOf(workout: HistoricalWorkout): MilestoneSet[] {
  return workout.exercises.flatMap((exercise) => {
    // Le même calcul de tonnage que partout ailleurs, obtenu du même endroit :
    // un palier de volume qui contredirait le rapport mensuel serait pire que
    // pas de palier du tout.
    const entries = volumeEntriesOf(exercise);

    return exercise.sets.map((set, index) => {
      const entry = entries[index];

      return {
        workoutId: workout.workoutId,
        performedAt: workout.startedAt,
        ...(exercise.slug === undefined ? {} : { slug: exercise.slug }),
        ...(exercise.equipment === undefined ? {} : { equipment: exercise.equipment }),
        ...(exercise.measurementType === undefined
          ? {}
          : { measurementType: exercise.measurementType }),
        isUnilateral: exercise.isUnilateral === 1,
        setType: set.setType,
        ...(set.weight === undefined ? {} : { weight: set.weight }),
        ...(set.reps === undefined ? {} : { reps: set.reps }),
        ...(set.durationSeconds === undefined ? {} : { durationSeconds: set.durationSeconds }),
        tonnageKg:
          entry === undefined
            ? 0
            : effectiveLoadKg(entry, workout.bodyWeightKg) * (set.reps ?? 0),
      };
    });
  });
}

async function readEarned(): Promise<EarnedMilestone[]> {
  const workouts = await listHistoricalWorkouts({ kind: 'all-history' });

  return earnMilestones({
    sets: workouts.flatMap(milestoneSetsOf),
    sessions: workouts.map((workout) => ({
      workoutId: workout.workoutId,
      startedAt: workout.startedAt,
    })),
  });
}

export interface MilestoneSyncOptions {
  /**
   * `true` après une séance : les paliers nouveaux naissent non acquittés et
   * seront montrés une fois.
   *
   * `false` pour un rattrapage — premier démarrage, import CSV, restauration.
   * Un historique de dix ans franchit quarante paliers d'un coup, et quarante
   * célébrations simultanées n'en valent aucune : ils entrent acquittés, donc
   * consultables dans l'écran des paliers et silencieux ailleurs. Les
   * anniversaires, eux, les retrouveront un par un.
   */
  celebrate: boolean;
}

/**
 * Recalcule la projection et rend **ce qui vient d'être franchi**.
 *
 * Le retour est la liste des lignes créées non acquittées, donc vide dès le
 * deuxième appel sans nouvelle séance : c'est ce qui rend l'opération sûre à
 * rejouer, et ce qui permet de l'appeler sans savoir si elle a déjà tourné.
 */
export async function syncMilestones({
  celebrate,
}: MilestoneSyncOptions): Promise<Milestone[]> {
  const earned = await readEarned();

  return db.transaction('rw', db.milestones, async () => {
    const existing = alive(await db.milestones.toArray());
    const byDefinition = new Map(existing.map((row) => [row.definitionId, row]));
    const now = Date.now();
    const created: Milestone[] = [];

    for (const item of earned) {
      const row = byDefinition.get(item.definitionId);
      byDefinition.delete(item.definitionId);

      if (row === undefined) {
        const fresh = newEntity<Milestone>({
          definitionId: item.definitionId,
          achievedAt: item.achievedAt,
          workoutId: item.workoutId,
          value: item.value,
          acknowledgedAt: celebrate ? 0 : now,
        });
        await db.milestones.add(fresh);
        if (celebrate) created.push(fresh);
        continue;
      }

      // Une séance corrigée peut déplacer la date ou la valeur d'un palier déjà
      // acquis. On réécrit, sans jamais toucher `acknowledgedAt` : le palier
      // n'est pas nouveau, il est seulement mieux daté.
      if (
        row.achievedAt !== item.achievedAt ||
        row.value !== item.value ||
        row.workoutId !== item.workoutId
      ) {
        await db.milestones.put(
          touch(row, {
            achievedAt: item.achievedAt,
            value: item.value,
            workoutId: item.workoutId,
          }),
        );
      }
    }

    /*
     * Ce qui reste dans la table n'est plus franchi par aucune séance : la
     * séance qui le portait a été supprimée ou corrigée.
     *
     * **Le retirer est le choix honnête, et il ne contredit pas la promesse.**
     * « Acquis pour de bon » veut dire qu'une pause, une blessure ou trois mois
     * d'arrêt ne reprennent rien — pas qu'un palier survit à l'effacement de sa
     * preuve. Effacer la séance des 100 kg est un geste délibéré et rare, et
     * garder le palier laisserait l'app affirmer un jour qu'on a soulevé une
     * charge dont plus aucune trace n'existe.
     */
    for (const orphan of byDefinition.values()) {
      await softDelete(db.milestones, orphan.id);
    }

    return created;
  });
}

/**
 * Le rattrapage du premier démarrage, et lui seul.
 *
 * Silencieux par construction, et **non bloquant** : un échec ici laisse l'app
 * s'ouvrir sans paliers plutôt que de refuser de démarrer. C'est le statut que
 * la projection des records a depuis le Lot 7, pour la même raison — rien de ce
 * qui est recalculable ne mérite d'empêcher une séance de commencer.
 */
export async function ensureMilestoneProjection(): Promise<void> {
  const stored = await db.settings.get(PROJECTION_KEY);
  if (stored?.value === MILESTONES_PROJECTION_VERSION) return;

  await syncMilestones({ celebrate: false });
  await db.settings.put({
    key: PROJECTION_KEY,
    value: MILESTONES_PROJECTION_VERSION,
    updatedAt: Date.now(),
  });
}

/** Tout ce qui est acquis, du plus récent au plus ancien. */
export async function listMilestones(): Promise<Milestone[]> {
  const rows = alive(await db.milestones.toArray());
  return rows.sort((left, right) => right.achievedAt - left.achievedAt);
}

/** Ce qui n'a pas encore été montré — au plus quelques lignes, presque toujours zéro. */
export async function listUnacknowledgedMilestones(): Promise<Milestone[]> {
  const rows = alive(await db.milestones.where('acknowledgedAt').equals(0).toArray());
  return rows.sort((left, right) => left.achievedAt - right.achievedAt);
}

/** Vu. Une carte célébrée deux fois est une carte qu'on apprend à ignorer. */
export async function acknowledgeMilestones(ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  const now = Date.now();
  await db.transaction('rw', db.milestones, async () => {
    for (const id of ids) {
      await db.milestones.update(id, { acknowledgedAt: now, updatedAt: now });
    }
  });
}

/**
 * Les anniversaires déjà montrés.
 *
 * Dans les réglages plutôt que dans une table : ce sont quelques clés par an,
 * lues d'un bloc à chaque ouverture de l'accueil, et jamais interrogées une par
 * une. Une table entière pour ça aurait coûté une version Dexie de plus.
 */
export async function listSeenRetrospectives(): Promise<Set<string>> {
  const stored = await db.settings.get(RETROSPECTIVES_KEY);
  const value: unknown = stored?.value;
  if (!Array.isArray(value)) return new Set();
  return new Set(value.filter((item): item is string => typeof item === 'string'));
}

export async function markRetrospectiveSeen(key: string): Promise<void> {
  const seen = await listSeenRetrospectives();
  if (seen.has(key)) return;
  seen.add(key);
  await db.settings.put({
    key: RETROSPECTIVES_KEY,
    value: [...seen],
    updatedAt: Date.now(),
  });
}
