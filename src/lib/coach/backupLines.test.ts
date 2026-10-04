import { describe, expect, it } from 'vitest';
import { BACKUP_TABLES, type BackupFile, type BackupRow } from '@/lib/backup/types';
import { coachLinesFromBackup } from './backupLines';

const day = 86_400_000;
const t0 = Date.UTC(2026, 8, 1, 18);

function backup(tables: Partial<Record<(typeof BACKUP_TABLES)[number], BackupRow[]>>): BackupFile {
  const empty = Object.fromEntries(BACKUP_TABLES.map((name) => [name, [] as BackupRow[]]));
  return {
    format: 'fittrack-backup',
    version: 1,
    exportedAt: t0,
    app: { name: 'FitTrack', schemaVersion: 13 },
    preferences: {},
    tables: { ...empty, ...tables } as BackupFile['tables'],
  };
}

const exercise = {
  id: 'row',
  name: 'Rowing',
  measurementType: 'weight_reps',
  equipment: 'machine',
  deletedAt: 0,
};

function workout(id: string, startedAt: number, extra: BackupRow = {}): BackupRow {
  return { id, name: id, status: 'completed', startedAt, deletedAt: 0, ...extra };
}

function row(id: string, workoutId: string, extra: BackupRow = {}): BackupRow {
  return {
    id,
    workoutId,
    exerciseId: 'row',
    order: 0,
    exerciseMeasurementType: 'weight_reps',
    exerciseEquipment: 'machine',
    deletedAt: 0,
    ...extra,
  };
}

function set(id: string, rowId: string, workoutId: string, extra: BackupRow = {}): BackupRow {
  return {
    id,
    workoutExerciseId: rowId,
    workoutId,
    exerciseId: 'row',
    order: 0,
    setType: 'normal',
    weight: 70,
    reps: 12,
    targetReps: 10,
    targetRepsMax: 12,
    isCompleted: 1,
    performedAt: 1,
    deletedAt: 0,
    ...extra,
  };
}

describe('coachLinesFromBackup', () => {
  it('rend une ligne par exercice de séance terminée, séries dans l’ordre', () => {
    const lines = coachLinesFromBackup(
      backup({
        exercises: [exercise],
        workouts: [workout('w1', t0)],
        workoutExercises: [row('r1', 'w1')],
        workoutSets: [
          set('s2', 'r1', 'w1', { order: 1, reps: 11, performedAt: t0 + 200 }),
          set('s1', 'r1', 'w1', { order: 0, performedAt: t0 + 100 }),
        ],
      }),
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      exerciseId: 'row',
      workoutId: 'w1',
      workoutStartedAt: t0,
      measurementType: 'weight_reps',
      equipment: 'machine',
    });
    expect(lines[0]!.sets.map((s) => s.reps)).toEqual([12, 11]);
  });

  it('écarte les séances supprimées ou encore en cours', () => {
    const lines = coachLinesFromBackup(
      backup({
        exercises: [exercise],
        workouts: [
          workout('deleted', t0, { deletedAt: t0 + day }),
          workout('active', t0 + day, { status: 'active' }),
        ],
        workoutExercises: [row('r1', 'deleted'), row('r2', 'active')],
        workoutSets: [set('s1', 'r1', 'deleted'), set('s2', 'r2', 'active')],
      }),
    );
    expect(lines).toEqual([]);
  });

  it('écarte les séries non validées, supprimées ou sans horodatage', () => {
    const lines = coachLinesFromBackup(
      backup({
        exercises: [exercise],
        workouts: [workout('w1', t0)],
        workoutExercises: [row('r1', 'w1')],
        workoutSets: [
          set('kept', 'r1', 'w1', { performedAt: t0 }),
          set('open', 'r1', 'w1', { isCompleted: 0 }),
          set('gone', 'r1', 'w1', { deletedAt: t0 }),
          set('untimed', 'r1', 'w1', { performedAt: 0 }),
        ],
      }),
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]!.sets).toHaveLength(1);
  });

  it('se replie sur l’instantané de la ligne quand l’exercice manque', () => {
    const lines = coachLinesFromBackup(
      backup({
        workouts: [workout('w1', t0)],
        workoutExercises: [row('r1', 'w1', { exerciseEquipment: 'cable' })],
        workoutSets: [set('s1', 'r1', 'w1')],
      }),
    );
    expect(lines[0]).toMatchObject({ measurementType: 'weight_reps', equipment: 'cable' });
  });

  it('reporte le pas de charge réglé sur l’exercice', () => {
    const lines = coachLinesFromBackup(
      backup({
        exercises: [{ ...exercise, loadIncrementKg: 2.5 }],
        workouts: [workout('w1', t0)],
        workoutExercises: [row('r1', 'w1')],
        workoutSets: [set('s1', 'r1', 'w1')],
      }),
    );
    expect(lines[0]!.loadIncrementKg).toBe(2.5);
  });
});
