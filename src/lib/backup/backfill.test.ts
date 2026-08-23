import { describe, expect, it } from 'vitest';
import { BACKUP_TABLES, type BackupRow, type BackupTable } from './types';
import { CURRENT_SCHEMA_VERSION, backfillBackupTables } from './backfill';

function tables(overrides: Partial<Record<BackupTable, BackupRow[]>> = {}) {
  return Object.fromEntries(
    BACKUP_TABLES.map((table) => [table, overrides[table] ?? []]),
  ) as Record<BackupTable, BackupRow[]>;
}

const PULL_UP: BackupRow = {
  id: 'ex-1',
  name: 'Traction',
  primaryMuscle: 'lats',
  secondaryMuscles: ['biceps'],
  equipment: 'bodyweight',
  measurementType: 'reps_only',
  isCustom: 1,
};

describe('backfillBackupTables', () => {
  describe('v9 — le coefficient de poids du corps des exercices perso', () => {
    it('donne son coefficient à une traction perso qui n’en a pas', () => {
      const migrated = backfillBackupTables(tables({ exercises: [PULL_UP] }), 8);

      expect(migrated.exercises[0]?.bodyweightLoadFactor).toBe(1);
    });

    it('ne touche pas un coefficient déjà réglé par le pratiquant', () => {
      const migrated = backfillBackupTables(
        tables({ exercises: [{ ...PULL_UP, bodyweightLoadFactor: 0.7 }] }),
        8,
      );

      expect(migrated.exercises[0]?.bodyweightLoadFactor).toBe(0.7);
    });

    it('laisse le catalogue tranquille — c’est l’affaire du seed', () => {
      const migrated = backfillBackupTables(
        tables({ exercises: [{ ...PULL_UP, isCustom: 0, slug: 'pull-up' }] }),
        8,
      );

      expect(migrated.exercises[0]?.bodyweightLoadFactor).toBeUndefined();
    });

    it('ne donne rien à un matériel qui fournit sa propre résistance', () => {
      const migrated = backfillBackupTables(
        tables({ exercises: [{ ...PULL_UP, equipment: 'cable' }] }),
        8,
      );

      expect(migrated.exercises[0]?.bodyweightLoadFactor).toBeUndefined();
    });
  });

  describe('v2 — l’instantané d’exercice et le fuseau de la séance', () => {
    it('gèle l’identité de l’exercice sur une ligne qui n’en porte aucune', () => {
      const migrated = backfillBackupTables(
        tables({
          exercises: [PULL_UP],
          workoutExercises: [{ id: 'we-1', workoutId: 'w-1', exerciseId: 'ex-1' }],
        }),
        1,
      );

      expect(migrated.workoutExercises[0]).toMatchObject({
        exerciseName: 'Traction',
        exerciseMeasurementType: 'reps_only',
        exercisePrimaryMuscle: 'lats',
        exerciseSecondaryMuscles: ['biceps'],
        exerciseEquipment: 'bodyweight',
      });
    });

    it('ne réécrit jamais un instantané existant avec le catalogue d’aujourd’hui', () => {
      const migrated = backfillBackupTables(
        tables({
          exercises: [PULL_UP],
          workoutExercises: [
            {
              id: 'we-1',
              workoutId: 'w-1',
              exerciseId: 'ex-1',
              exerciseName: 'Traction supination',
              exercisePrimaryMuscle: 'lats',
            },
          ],
        }),
        1,
      );

      expect(migrated.workoutExercises[0]?.exerciseName).toBe('Traction supination');
    });

    it('donne un décalage horaire à une séance qui n’en porte pas', () => {
      const startedAt = Date.UTC(2026, 6, 27, 18, 20);
      const migrated = backfillBackupTables(
        tables({ workouts: [{ id: 'w-1', startedAt }] }),
        1,
      );

      expect(migrated.workouts[0]?.startedTimezoneOffsetMinutes).toBe(
        -new Date(startedAt).getTimezoneOffset(),
      );
    });

    it('respecte le décalage qu’une séance porte déjà', () => {
      const migrated = backfillBackupTables(
        tables({ workouts: [{ id: 'w-1', startedAt: 0, startedTimezoneOffsetMinutes: 330 }] }),
        1,
      );

      expect(migrated.workouts[0]?.startedTimezoneOffsetMinutes).toBe(330);
    });
  });

  describe('v4 — les muscles secondaires de l’instantané', () => {
    it('complète une ligne déjà instantanée mais sans secondaires', () => {
      const migrated = backfillBackupTables(
        tables({
          exercises: [PULL_UP],
          workoutExercises: [
            { id: 'we-1', exerciseId: 'ex-1', exerciseName: 'Traction', exercisePrimaryMuscle: 'lats' },
          ],
        }),
        3,
      );

      expect(migrated.workoutExercises[0]?.exerciseSecondaryMuscles).toEqual(['biceps']);
    });

    it('laisse intacte une ligne jamais instantanée — elle retombe sur la bibliothèque', () => {
      const migrated = backfillBackupTables(
        tables({
          exercises: [PULL_UP],
          workoutExercises: [{ id: 'we-1', exerciseId: 'ex-1' }],
        }),
        3,
      );

      expect(migrated.workoutExercises[0]?.exerciseSecondaryMuscles).toBeUndefined();
      expect(migrated.workoutExercises[0]?.exerciseName).toBeUndefined();
    });
  });

  describe('v7 — l’intention de semaine', () => {
    it('traduit une prescription en pourcentage en indice de charge', () => {
      const migrated = backfillBackupTables(
        tables({
          programWeeks: [
            { id: 'pw-1', prescriptionKind: 'percent_1rm', prescriptionValue: 85, isDeload: 0 },
          ],
        }),
        6,
      );

      expect(migrated.programWeeks[0]).toMatchObject({ loadIndex: 85, phase: 'construction' });
      expect(migrated.programWeeks[0]?.prescriptionKind).toBeUndefined();
      expect(migrated.programWeeks[0]?.prescriptionValue).toBeUndefined();
      expect(migrated.programWeeks[0]?.isDeload).toBeUndefined();
    });

    it('reconnaît une semaine de décharge', () => {
      const migrated = backfillBackupTables(
        tables({
          programWeeks: [
            { id: 'pw-1', prescriptionKind: 'percent_1rm', prescriptionValue: 60, isDeload: 1 },
          ],
        }),
        6,
      );

      expect(migrated.programWeeks[0]).toMatchObject({ loadIndex: 60, phase: 'deload' });
    });

    it('ramène une prescription en RPE à l’indice neutre', () => {
      const migrated = backfillBackupTables(
        tables({ programWeeks: [{ id: 'pw-1', prescriptionKind: 'target_rpe', prescriptionValue: 8 }] }),
        6,
      );

      expect(migrated.programWeeks[0]).toMatchObject({ loadIndex: 100, phase: 'construction' });
    });

    it('ne retouche pas une semaine qui porte déjà son indice', () => {
      const migrated = backfillBackupTables(
        tables({ programWeeks: [{ id: 'pw-1', loadIndex: 105, phase: 'overload' }] }),
        6,
      );

      expect(migrated.programWeeks[0]).toMatchObject({ loadIndex: 105, phase: 'overload' });
    });
  });

  describe('v8 — les champs de cycle abandonnés', () => {
    it('retire le versionnage d’une routine', () => {
      const migrated = backfillBackupTables(
        tables({
          routines: [
            { id: 'r-1', name: 'Poussée', version: 3, versionState: 'published', originRoutineId: 'r-0' },
          ],
        }),
        7,
      );

      expect(migrated.routines[0]).toEqual({ id: 'r-1', name: 'Poussée' });
    });
  });

  describe('v10 — le drapeau unilatéral de l’instantané', () => {
    // Même garde que la v4 : seules les lignes déjà instantanées. Une ligne
    // sans instantané retombe sur la bibliothèque en bloc, et lui donner ce
    // seul champ casserait ce repli.
    it('remplit les lignes déjà instantanées depuis la bibliothèque du fichier', () => {
      const migrated = backfillBackupTables(
        tables({
          exercises: [{ ...PULL_UP, isUnilateral: 1 }],
          workoutExercises: [
            {
              id: 'we-1',
              exerciseId: 'ex-1',
              exerciseName: 'Traction',
              exercisePrimaryMuscle: 'lats',
            },
            { id: 'we-2', exerciseId: 'ex-1' },
          ],
        }),
        9,
      );

      expect(migrated.workoutExercises[0]?.exerciseIsUnilateral).toBe(1);
      expect(migrated.workoutExercises[1]).not.toHaveProperty('exerciseIsUnilateral');
    });

    // Écraser un instantané gelé avec le catalogue d'aujourd'hui est
    // précisément la réécriture de l'histoire que les instantanés empêchent.
    it('n’écrase jamais un drapeau déjà gelé', () => {
      const migrated = backfillBackupTables(
        tables({
          exercises: [{ ...PULL_UP, isUnilateral: 1 }],
          workoutExercises: [
            {
              id: 'we-1',
              exerciseId: 'ex-1',
              exercisePrimaryMuscle: 'lats',
              exerciseIsUnilateral: 0,
            },
          ],
        }),
        9,
      );

      expect(migrated.workoutExercises[0]?.exerciseIsUnilateral).toBe(0);
    });
  });

  describe('v11 — l’allègement à zéro du journal du coach', () => {
    const missed: BackupRow = {
      id: 'reco-1',
      exerciseId: 'lateral-raise',
      code: 'range_missed',
      status: 'pending',
      nextLoadKg: 0,
      evidence: [
        { label: 'current_load_kg', value: 3.5 },
        { label: 'next_load_kg', value: 0 },
      ],
    };

    it('retire un 0 kg qui ne charge rien, sans toucher au constat', () => {
      const migrated = backfillBackupTables(tables({ coachRecommendations: [missed] }), 10);

      const row = migrated.coachRecommendations[0]!;
      expect(row.nextLoadKg).toBeUndefined();
      expect(row.evidence).toEqual([{ label: 'current_load_kg', value: 3.5 }]);
    });

    it('laisse un allègement qui charge vraiment quelque chose', () => {
      const migrated = backfillBackupTables(
        tables({ coachRecommendations: [{ ...missed, nextLoadKg: 77.5 }] }),
        10,
      );

      expect(migrated.coachRecommendations[0]?.nextLoadKg).toBe(77.5);
    });

    it('garde le 0 kg d’une machine assistée dont l’assistance disparaît', () => {
      const migrated = backfillBackupTables(
        tables({
          coachRecommendations: [{ ...missed, code: 'range_ceiling_reached' }],
        }),
        10,
      );

      expect(migrated.coachRecommendations[0]?.nextLoadKg).toBe(0);
    });
  });

  describe('la porte de version', () => {
    it('ne fait rien sur une sauvegarde déjà au schéma courant', () => {
      const source = tables({ exercises: [PULL_UP] });
      const migrated = backfillBackupTables(source, CURRENT_SCHEMA_VERSION);

      expect(migrated.exercises[0]).toEqual(PULL_UP);
    });

    it('rattrape tout quand le fichier ne dit pas d’où il vient', () => {
      const migrated = backfillBackupTables(tables({ exercises: [PULL_UP] }), 0);

      expect(migrated.exercises[0]?.bodyweightLoadFactor).toBe(1);
    });

    it('n’altère jamais les tables qu’on lui a passées', () => {
      const source = tables({ exercises: [PULL_UP] });
      backfillBackupTables(source, 0);

      expect(source.exercises[0]).toEqual(PULL_UP);
    });

    it('rejoue sans effet un rattrapage déjà appliqué', () => {
      const once = backfillBackupTables(tables({ exercises: [PULL_UP] }), 0);
      const twice = backfillBackupTables(once, 0);

      expect(twice).toEqual(once);
    });
  });
});
