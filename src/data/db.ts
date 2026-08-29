import Dexie, { type EntityTable } from 'dexie';
import { defaultBodyweightLoadFactor } from '@/lib/bodyweightLoad';
import { snapshotOf } from '@/lib/exerciseSnapshot';
import { localOffsetMinutes } from '@/lib/timezone';
import type {
  BodyMeasurement,
  CoachRecommendation,
  Exercise,
  ExternalExerciseBinding,
  Milestone,
  PersonalRecord,
  ProgressPhoto,
  Program,
  ProgramScheduleEntry,
  ProgramScheduleRevision,
  ProgramWeek,
  Routine,
  RoutineExercise,
  RoutineFolder,
  RoutineSet,
  Setting,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from './types';

/** Photo binaries live apart so listing photos never loads megabytes into memory. */
export interface PhotoBlob {
  key: string;
  blob: Blob;
}

export class FitTrackDB extends Dexie {
  exercises!: EntityTable<Exercise, 'id'>;
  externalExerciseBindings!: EntityTable<ExternalExerciseBinding, 'id'>;
  routineFolders!: EntityTable<RoutineFolder, 'id'>;
  routines!: EntityTable<Routine, 'id'>;
  routineExercises!: EntityTable<RoutineExercise, 'id'>;
  routineSets!: EntityTable<RoutineSet, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  workoutExercises!: EntityTable<WorkoutExercise, 'id'>;
  workoutSets!: EntityTable<WorkoutSet, 'id'>;
  personalRecords!: EntityTable<PersonalRecord, 'id'>;
  milestones!: EntityTable<Milestone, 'id'>;
  coachRecommendations!: EntityTable<CoachRecommendation, 'id'>;
  bodyMeasurements!: EntityTable<BodyMeasurement, 'id'>;
  /**
   * Déclarées, vides, et **volontairement sans lecteur** — décision du 2026-08-29.
   *
   * Les photos de progression étaient la seconde moitié du Lot 11. Elles ne
   * seront pas écrites : elles demandent la caméra, des `Blob` en base et une
   * surface de données personnelles que cette app n'a aucune raison d'ouvrir
   * pour une fonctionnalité de confort. Aucun code de `src/` ne les touche, et
   * c'est l'état voulu — pas un chantier qu'on aurait oublié.
   *
   * Les tables restent parce que les retirer coûterait une migration Dexie sur
   * des bases réelles, pour supprimer deux tables vides : le remède serait plus
   * risqué que le mal. `lib/backup/types.ts` explique séparément pourquoi la
   * sauvegarde ignore `photoBlobs`.
   */
  progressPhotos!: EntityTable<ProgressPhoto, 'id'>;
  photoBlobs!: EntityTable<PhotoBlob, 'key'>;
  settings!: EntityTable<Setting, 'key'>;
  programs!: EntityTable<Program, 'id'>;
  programWeeks!: EntityTable<ProgramWeek, 'id'>;
  programScheduleRevisions!: EntityTable<ProgramScheduleRevision, 'id'>;
  programScheduleEntries!: EntityTable<ProgramScheduleEntry, 'id'>;

  constructor() {
    super('fittrack');

    // MIGRATION RULE FOR THE WHOLE PROJECT: never touch this version(1) block.
    // To change the schema, append `this.version(2).stores({…}).upgrade(…)`.
    // Editing a version that already shipped corrupts the databases of the
    // devices that already ran it.
    this.version(1).stores({
      exercises: 'id, name, primaryMuscle, equipment, isCustom, updatedAt, deletedAt',
      routineFolders: 'id, order, updatedAt, deletedAt',
      routines: 'id, folderId, order, updatedAt, deletedAt',
      routineExercises: 'id, routineId, [routineId+order], deletedAt',
      routineSets: 'id, routineExerciseId, [routineExerciseId+order], deletedAt',
      workouts: 'id, status, startedAt, routineId, updatedAt, deletedAt',
      workoutExercises: 'id, workoutId, [workoutId+order], exerciseId, deletedAt',
      workoutSets:
        'id, workoutExerciseId, [workoutExerciseId+order], workoutId, [exerciseId+performedAt], deletedAt',
      personalRecords: 'id, exerciseId, [exerciseId+type], achievedAt, deletedAt',
      bodyMeasurements: 'id, type, [type+measuredAt], deletedAt',
      progressPhotos: 'id, takenAt, deletedAt',
      photoBlobs: 'key',
      settings: 'key',
    });

    // Backfills the exercise snapshot and the session's original UTC offset.
    // No `.stores()`: none of the five fields is indexed, so the schema itself
    // is unchanged and version 1's declaration carries over.
    //
    // Both backfills are the best information available and the only one there
    // is. A row whose exercise was renamed before this ran records the new
    // name — undetectable, and no worse than the status quo it replaces. The
    // offsets are exact: the platform's zone database knows what the offset was
    // on the day of each session.
    this.version(2).upgrade(async (tx) => {
      const exercises = await tx.table<Exercise>('exercises').toArray();
      const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));

      await tx
        .table<WorkoutExercise>('workoutExercises')
        .toCollection()
        .modify((row) => {
          Object.assign(row, snapshotOf(byId.get(row.exerciseId)));
        });

      await tx
        .table<Workout>('workouts')
        .toCollection()
        .modify((workout) => {
          workout.startedTimezoneOffsetMinutes = localOffsetMinutes(workout.startedAt);
        });
    });

    this.version(3).stores({
      exercises: 'id, name, primaryMuscle, equipment, isCustom, updatedAt, deletedAt',
      externalExerciseBindings: 'id, [source+identityKey], exerciseId, updatedAt, deletedAt',
      routineFolders: 'id, order, updatedAt, deletedAt',
      routines: 'id, folderId, order, updatedAt, deletedAt',
      routineExercises: 'id, routineId, [routineId+order], deletedAt',
      routineSets: 'id, routineExerciseId, [routineExerciseId+order], deletedAt',
      workouts: 'id, status, startedAt, routineId, updatedAt, deletedAt',
      workoutExercises: 'id, workoutId, [workoutId+order], exerciseId, deletedAt',
      workoutSets:
        'id, workoutExerciseId, [workoutExerciseId+order], workoutId, [exerciseId+performedAt], deletedAt',
      personalRecords: 'id, exerciseId, [exerciseId+type], achievedAt, deletedAt',
      bodyMeasurements: 'id, type, [type+measuredAt], deletedAt',
      progressPhotos: 'id, takenAt, deletedAt',
      photoBlobs: 'key',
      settings: 'key',
    });

    /**
     * Backfills the snapshot's secondary muscles.
     *
     * No `.stores()`, for the same reason as version 2: the field is not
     * indexed, so the schema itself is unchanged and version 3's declaration
     * carries over.
     *
     * **This does not reopen the rule that snapshots exist to enforce.** That
     * rule forbids *reading today's library at display time* to interpret a past
     * session — which is how the same session once had two names on one screen.
     * Writing today's library into the snapshot **once**, now, is the opposite
     * move: from here on the row answers for itself and stops depending on the
     * catalogue at all. It is the same trade version 2 already made and
     * documented — the best information available, and the only one there is. A
     * row whose exercise gained or lost a secondary muscle before this ran
     * records today's list; undetectable, and no worse than the nothing it
     * replaces.
     *
     * Only rows that were already snapshotted are touched. A row with no
     * snapshot at all keeps falling through to the library as a whole, which is
     * what `resolveExerciseIdentity` expects of it.
     */
    this.version(4).upgrade(async (tx) => {
      const exercises = await tx.table<Exercise>('exercises').toArray();
      const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));

      await tx
        .table<WorkoutExercise>('workoutExercises')
        .toCollection()
        .modify((row) => {
          if (row.exercisePrimaryMuscle === undefined) return;
          const secondaries = byId.get(row.exerciseId)?.secondaryMuscles ?? [];
          if (secondaries.length > 0) row.exerciseSecondaryMuscles = [...secondaries];
        });
    });

    // Lot 18 — journal of coach recommendations (signals the user saw).
    // Incremental stores declaration: only the new table is listed.
    this.version(5).stores({
      coachRecommendations:
        'id, exerciseId, status, [exerciseId+status], recommendedAt, deletedAt',
    });

    this.version(6)
      .stores({
        programs: 'id, status, startsAt, updatedAt, deletedAt',
        programWeeks: 'id, programId, [programId+weekIndex], deletedAt',
        programScheduleRevisions: 'id, programId, [programId+effectiveFromWeekIndex], deletedAt',
        programScheduleEntries: 'id, revisionId, [revisionId+order], routineId, deletedAt',
      })
      .upgrade(async (tx) => {
        // The field this stamps is dropped again by version(8); the write is kept
        // as it shipped, because editing a version a device already ran corrupts it.
        await tx
          .table('routines')
          .toCollection()
          .modify((routine: Record<string, unknown>) => {
            routine.versionState = 'published';
          });
      });

    // Lot 17 — week intention: loadIndex + phase replace %1RM / RPE / isDeload.
    // No `.stores()`: none of the new fields is indexed.
    this.version(7).upgrade(async (tx) => {
      await tx.table('programWeeks').toCollection().modify((week: Record<string, unknown>) => {
        const kind = week.prescriptionKind;
        const value = week.prescriptionValue;
        const deload = week.isDeload === 1;
        if (kind === 'target_rpe') {
          week.loadIndex = 100;
          week.phase = 'construction';
        } else {
          week.loadIndex = typeof value === 'number' ? value : 100;
          week.phase = deload ? 'deload' : 'construction';
        }
        delete week.prescriptionKind;
        delete week.prescriptionValue;
        delete week.isDeload;
      });
    });

    // Blocks no longer govern routines: a block points at a routine and nothing
    // points back. Versioning, sealing and publication went with the cycle —
    // what they protected (the targets of a past session) is already frozen by
    // the workout snapshot. Any draft left behind becomes a plain routine of
    // the library rather than being dropped: no data loss.
    // No `.stores()`: none of the three fields was indexed.
    this.version(8).upgrade(async (tx) => {
      await tx
        .table('routines')
        .toCollection()
        .modify((routine: Record<string, unknown>) => {
          delete routine.version;
          delete routine.versionState;
          delete routine.originRoutineId;
        });
    });

    /**
     * Gives the exercises you made yourself the bodyweight coefficient the form
     * would write for them today.
     *
     * The field was optional and the form left it blank, so a self-made pull-up
     * carried no coefficient — and an exercise measured against the body with no
     * coefficient weighs **zero** in `effectiveLoadKg`. Fourteen repetitions, no
     * tonnage, no session record, and nothing on any screen printing the zero to
     * be suspicious about. Reported from the phone, twice, in exactly those
     * words: "les tractions non lestées ne comptent toujours pas le poids du
     * corps".
     *
     * Only rows with **no coefficient at all** (nothing is overwritten), only
     * `isCustom: 1` (a catalogue row is the catalogue's business, and
     * `seedDatabase` would realign it back on the next launch anyway), and only
     * the equipment where the body genuinely is the load — `lib/bodyweightLoad`
     * owns that judgement and this upgrade restates none of it.
     *
     * The same trade as version 2 and version 4, and stated the same way: the
     * best information available, and the only one there is. A self-made crunch
     * comes out at 100 % of a body, which it is not — and it now says so, in
     * figures, on its own sheet, where one tap corrects it. That is strictly
     * better than the silent zero it replaces.
     *
     * No `.stores()`: neither field is indexed, so version 8's declaration
     * carries over.
     */
    this.version(9).upgrade(async (tx) => {
      await tx
        .table<Exercise>('exercises')
        .toCollection()
        .modify((exercise) => {
          if (exercise.isCustom !== 1 || exercise.bodyweightLoadFactor !== undefined) return;
          const factor = defaultBodyweightLoadFactor(
            exercise.measurementType,
            exercise.equipment,
          );
          if (factor === undefined) return;
          exercise.bodyweightLoadFactor = factor;
        });
    });

    /**
     * Gèle le drapeau unilatéral sur les lignes de séance déjà instantanées.
     *
     * Le champ vient d'entrer dans `snapshotOf` : les lignes créées à partir de
     * maintenant le portent, celles d'avant non. Sans ce rattrapage, une séance
     * passée sur un exercice unilatéral lirait le drapeau **d'aujourd'hui** — la
     * réécriture de l'histoire que les instantanés existent pour empêcher, le
     * jour où ce drapeau est décoché.
     *
     * Seules les lignes **déjà instantanées**, exactement comme la version 4 :
     * une ligne sans instantané du tout retombe sur la bibliothèque en bloc, et
     * lui donner ce seul champ casserait ce repli.
     *
     * Le même compromis que les versions 2, 4 et 9, et il se dit de la même
     * façon : la meilleure information disponible, et la seule qu'il y ait. Une
     * ligne dont l'exercice a changé de drapeau avant ce passage enregistre
     * celui d'aujourd'hui — indétectable, et pas pire que le rien qu'il remplace.
     *
     * Pas de `.stores()` : le champ n'est pas indexé.
     */
    this.version(10).upgrade(async (tx) => {
      const exercises = await tx.table<Exercise>('exercises').toArray();
      const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));

      await tx
        .table<WorkoutExercise>('workoutExercises')
        .toCollection()
        .modify((row) => {
          if (row.exercisePrimaryMuscle === undefined) return;
          const flag = byId.get(row.exerciseId)?.isUnilateral;
          if (flag !== undefined) row.exerciseIsUnilateral = flag;
        });
    });

    /**
     * Efface l'allègement à zéro qu'un `range_missed` a pu écrire au journal.
     *
     * Le moteur prenait la dégressive pour la charge de travail, puis retirait
     * un incrément de *cette* charge-là : 3,5 kg moins un pas de 2,5 kg
     * retombait sur la grille à 0. La ligne reste « en attente », et son chiffre
     * s'applique d'un doigt aux séries restantes — charger zéro kilo n'est pas
     * un objectif, c'est une barre vide. Le constat, lui, est vrai et reste.
     *
     * `range_missed` seul, et zéro seul. Sur une machine assistée, alléger veut
     * dire *ajouter* du poids, donc jamais zéro ; et un `range_ceiling_reached`
     * à 0 kg sur cette même machine est une vraie étape — l'assistance qui
     * disparaît — qu'effacer serait une perte.
     *
     * Pas de `.stores()` : le champ n'est pas indexé.
     */
    this.version(11).upgrade(async (tx) => {
      await tx
        .table<CoachRecommendation>('coachRecommendations')
        .toCollection()
        .modify((row) => {
          if (row.code !== 'range_missed' || row.nextLoadKg !== 0) return;
          delete row.nextLoadKg;
          if (Array.isArray(row.evidence)) {
            row.evidence = row.evidence.filter((item) => item.label !== 'next_load_kg');
          }
        });
    });

    /**
     * Les paliers — une table neuve, donc une déclaration `.stores()` et aucun
     * `upgrade()`.
     *
     * **Rien à rattraper ici, et c'est délibéré.** Le contenu de cette table est
     * entièrement recalculable depuis l'historique : le remplir dans une
     * migration Dexie obligerait à embarquer le catalogue et le moteur dans
     * `db.ts`, que `lib/` importe déjà en sens inverse. Le rattrapage se fait
     * donc au démarrage, dans `initializePersistentData`, où il peut échouer
     * sans empêcher l'app de s'ouvrir — exactement le statut que la projection
     * des records a depuis le Lot 7.
     *
     * `definitionId` est indexé sans être unique : l'unicité est une invariante
     * de la réconciliation, et un index unique aurait fait échouer une écriture
     * concurrente au lieu de la laisser converger.
     */
    this.version(12).stores({
      milestones: 'id, definitionId, achievedAt, acknowledgedAt, deletedAt',
    });
  }
}

export const db = new FitTrackDB();
