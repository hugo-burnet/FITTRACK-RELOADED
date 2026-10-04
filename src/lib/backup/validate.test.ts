import { describe, expect, it } from 'vitest';
import { backupAccountTables as account } from '@/test/backupAccount';
import { validateBackupTables } from './validate';
import type { BackupRow, BackupTable } from './types';

/** Le schéma courant : rien n'est « absent parce que le fichier est vieux ». */
const NOW_SCHEMA = 12;

describe('validateBackupTables', () => {
  it('accepte un compte complet, sans orphelin', () => {
    const result = validateBackupTables(account(), NOW_SCHEMA);

    if (!result.ok) throw new Error(`refusé : ${JSON.stringify(result.flaws)}`);
    expect(result.orphans).toEqual([]);
    expect(result.tables.workoutSets).toHaveLength(1);
  });

  it('refuse une table malformée plutôt que de la lire comme vide', () => {
    const tables = { ...account(), workouts: { id: 'w-1' } as unknown as BackupRow[] };

    const result = validateBackupTables(tables, NOW_SCHEMA);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.flaws).toContainEqual({ kind: 'not-a-list', table: 'workouts' });
  });

  it('refuse une ligne qui n’est pas un enregistrement', () => {
    const tables = account();
    tables.workouts = [tables.workouts[0]!, 'w-2' as unknown as BackupRow];

    const result = validateBackupTables(tables, NOW_SCHEMA);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.flaws).toContainEqual({ kind: 'not-a-record', table: 'workouts', index: 1 });
  });

  it('refuse une séance réduite à son identifiant', () => {
    const tables = account();
    tables.workouts = [{ id: 'broken' }];

    const result = validateBackupTables(tables, NOW_SCHEMA);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.flaws).toContainEqual({
      kind: 'missing-field',
      table: 'workouts',
      index: 0,
      field: 'startedAt',
    });
  });

  it('refuse une valeur hors du vocabulaire', () => {
    const tables = account();
    tables.exercises[0]!.primaryMuscle = 'pectoraux';

    const result = validateBackupTables(tables, NOW_SCHEMA);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.flaws).toContainEqual({
      kind: 'invalid-field',
      table: 'exercises',
      index: 0,
      field: 'primaryMuscle',
    });
  });

  it('refuse un instant négatif', () => {
    // Un `deletedAt` négatif fait passer une ligne effacée pour vivante, et
    // rien en aval ne relit ce nombre avec méfiance.
    const tables = account();
    tables.workoutSets[0]!.performedAt = -1;

    const result = validateBackupTables(tables, NOW_SCHEMA);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.flaws).toContainEqual({
      kind: 'invalid-field',
      table: 'workoutSets',
      index: 0,
      field: 'performedAt',
    });
  });

  it('refuse un rang qui n’est pas un entier positif', () => {
    const tables = account();
    tables.routineSets[0]!.order = 1.5;

    const result = validateBackupTables(tables, NOW_SCHEMA);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.flaws).toContainEqual({
      kind: 'invalid-field',
      table: 'routineSets',
      index: 0,
      field: 'order',
    });
  });

  it('accepte un décalage horaire négatif', () => {
    // À l'ouest de Greenwich il l'est toujours : un plancher à zéro y refuserait
    // la moitié du monde, et il se met tout seul par symétrie avec les voisins.
    const tables = account();
    tables.workouts[0]!.startedTimezoneOffsetMinutes = -300;

    expect(validateBackupTables(tables, NOW_SCHEMA).ok).toBe(true);
  });

  it('refuse deux lignes qui portent le même identifiant', () => {
    // `bulkPut` en écraserait une sans un mot : deux séances entrent, une seule
    // ressort, et le fichier disait pourtant qu'il y en avait deux.
    const tables = account();
    tables.workouts = [tables.workouts[0]!, { ...tables.workouts[0]! }];

    const result = validateBackupTables(tables, NOW_SCHEMA);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.flaws).toContainEqual({ kind: 'duplicate-key', table: 'workouts', key: 'w-1' });
  });

  it('refuse un réglage sans clé', () => {
    const tables = account();
    tables.settings = [{ value: 'brzycki', updatedAt: 1 }];

    const result = validateBackupTables(tables, NOW_SCHEMA);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.flaws).toContainEqual({
      kind: 'missing-field',
      table: 'settings',
      index: 0,
      field: 'key',
    });
  });

  it('refuse l’absence d’une table essentielle', () => {
    const tables = account();
    delete (tables as Partial<Record<BackupTable, BackupRow[]>>).workoutSets;

    const result = validateBackupTables(tables, NOW_SCHEMA);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.flaws).toContainEqual({ kind: 'missing-table', table: 'workoutSets' });
  });

  it('accepte l’absence d’une table que le schéma du fichier ne connaissait pas', () => {
    const tables = account();
    for (const table of ['programs', 'programWeeks', 'milestones'] as const) {
      delete (tables as Partial<Record<BackupTable, BackupRow[]>>)[table];
    }

    // Schéma 4 : ni les blocs (6) ni les paliers (12) n'existaient encore.
    const result = validateBackupTables(tables, 4);

    if (!result.ok) throw new Error(`refusé : ${JSON.stringify(result.flaws)}`);
    expect(result.tables.programs).toEqual([]);
    expect(result.tables.milestones).toEqual([]);
  });

  it('refuse l’absence d’une table que le schéma du fichier connaissait', () => {
    const tables = account();
    delete (tables as Partial<Record<BackupTable, BackupRow[]>>).programs;

    const result = validateBackupTables(tables, NOW_SCHEMA);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.flaws).toContainEqual({ kind: 'missing-table', table: 'programs' });
  });

  it('signale une référence qui ne mène nulle part sans refuser le fichier', () => {
    // Une ligne orpheline ne justifie pas de refuser la seule sauvegarde de
    // quelqu'un : elle se dit, et c'est l'utilisateur qui tranche.
    const tables = account();
    tables.workoutSets[0]!.workoutExerciseId = 'we-disparu';

    const result = validateBackupTables(tables, NOW_SCHEMA);

    if (!result.ok) throw new Error(`refusé : ${JSON.stringify(result.flaws)}`);
    expect(result.orphans).toContainEqual({
      table: 'workoutSets',
      field: 'workoutExerciseId',
      count: 1,
    });
  });

  it('ne prend pas une absence de parent pour un orphelin', () => {
    const tables = account();
    tables.routines[0]!.folderId = '';
    tables.workouts[0]!.routineId = '';

    const result = validateBackupTables(tables, NOW_SCHEMA);

    if (!result.ok) throw new Error(`refusé : ${JSON.stringify(result.flaws)}`);
    expect(result.orphans).toEqual([]);
  });

  it('compte tous les défauts mais n’en détaille qu’une poignée', () => {
    const tables = account();
    tables.workouts = Array.from({ length: 40 }, (_, index) => ({ id: `w-${index}` }));

    const result = validateBackupTables(tables, NOW_SCHEMA);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.flawCount).toBeGreaterThan(result.flaws.length);
    expect(result.flaws.length).toBeLessThanOrEqual(20);
  });

  it('accepte un palier sans séance — « pas de parent » n’est pas un orphelin', () => {
    // noclip n'a été franchi par aucune séance : `workoutId` vaut `''`, comme `routineId` d'une
    // séance libre. Un orphelin est une référence qui ne mène nulle part, pas une absence de référence.
    const tables = account();
    tables.milestones = [
      {
        id: 'm-noclip',
        createdAt: 1,
        updatedAt: 1,
        deletedAt: 0,
        definitionId: 'noclip',
        achievedAt: 1,
        workoutId: '',
        value: 1,
        acknowledgedAt: 1,
      },
    ];

    const result = validateBackupTables(tables, NOW_SCHEMA);

    if (!result.ok) throw new Error(`refusé : ${JSON.stringify(result.flaws)}`);
    expect(result.orphans).toEqual([]);
    expect(result.tables.milestones).toHaveLength(1);
  });
});

describe('validateBackupTables — un split sur plusieurs semaines', () => {
  const STAMPS = { createdAt: 1, updatedAt: 1, deletedAt: 0 };

  /** Un bloc d'un cycle de deux semaines, écrit à la main : la fixture n'a pas de bloc. */
  function accountWithCycle() {
    const tables = account();
    tables.programs = [
      {
        id: 'p-1',
        ...STAMPS,
        name: 'Haut / bas puis PPL',
        startsAt: 1,
        durationWeeks: 4,
        status: 'draft',
      },
    ];
    tables.programScheduleRevisions = [
      { id: 'rev-1', ...STAMPS, programId: 'p-1', effectiveFromWeekIndex: 0, cycleWeeks: 2 },
    ];
    tables.programScheduleEntries = [
      {
        id: 'entry-1',
        ...STAMPS,
        revisionId: 'rev-1',
        routineId: 'r-1',
        dayOfWeek: 1,
        order: 0,
        cycleWeek: 1,
      },
    ];
    return tables;
  }

  it('accepte la longueur du cycle et la semaine de chaque séance', () => {
    const result = validateBackupTables(accountWithCycle(), NOW_SCHEMA);

    if (!result.ok) throw new Error(`refusé : ${JSON.stringify(result.flaws)}`);
    expect(result.orphans).toEqual([]);
  });

  it('accepte une sauvegarde écrite avant les cycles, sans l’un ni l’autre', () => {
    const tables = accountWithCycle();
    delete tables.programScheduleRevisions[0]!.cycleWeeks;
    delete tables.programScheduleEntries[0]!.cycleWeek;

    expect(validateBackupTables(tables, NOW_SCHEMA).ok).toBe(true);
  });

  it.each([0, -1, 1.5, '2'])('refuse une longueur de cycle de %s', (cycleWeeks) => {
    const tables = accountWithCycle();
    tables.programScheduleRevisions[0]!.cycleWeeks = cycleWeeks as number;

    const result = validateBackupTables(tables, NOW_SCHEMA);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.flaws).toContainEqual({
      kind: 'invalid-field',
      table: 'programScheduleRevisions',
      index: 0,
      field: 'cycleWeeks',
    });
  });

  it.each([-1, 0.5, '1'])('refuse une semaine de cycle de %s', (cycleWeek) => {
    const tables = accountWithCycle();
    tables.programScheduleEntries[0]!.cycleWeek = cycleWeek as number;

    const result = validateBackupTables(tables, NOW_SCHEMA);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.flaws).toContainEqual({
      kind: 'invalid-field',
      table: 'programScheduleEntries',
      index: 0,
      field: 'cycleWeek',
    });
  });
});

