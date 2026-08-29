import { describe, expect, it } from 'vitest';
import { parseBackup } from './parse';
import { BACKUP_FORMAT, BACKUP_VERSION, serializeBackup, type BackupFile } from './types';

function file(overrides: Partial<BackupFile> = {}): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: 1_700_000_000_000,
    app: { name: 'FitTrack', schemaVersion: 8 },
    preferences: { 'fittrack:theme': 'light' },
    tables: {
      exercises: [{ id: 'ex-1', name: 'Développé couché' }],
      externalExerciseBindings: [],
      routineFolders: [],
      routines: [{ id: 'r-1', name: 'Poussée' }],
      routineExercises: [],
      routineSets: [],
      workouts: [{ id: 'w-1' }, { id: 'w-2' }],
      workoutExercises: [],
      workoutSets: [],
      personalRecords: [],
      milestones: [],
      coachRecommendations: [],
      bodyMeasurements: [],
      progressPhotos: [],
      programs: [],
      programWeeks: [],
      programScheduleRevisions: [],
      programScheduleEntries: [],
      settings: [{ key: 'oneRepMaxFormula', value: 'brzycki' }],
    },
    ...overrides,
  };
}

describe('parseBackup', () => {
  it('relit un fichier écrit par l’app, avec ses comptes', () => {
    const result = parseBackup(serializeBackup(file()));
    if (!result.ok) throw new Error(`refusé : ${result.problem}`);

    expect(result.counts.workouts).toBe(2);
    expect(result.total).toBe(5);
    expect(result.backup.preferences).toEqual({ 'fittrack:theme': 'light' });
  });

  it('refuse ce qui n’est pas du JSON', () => {
    expect(parseBackup('title,reps\r\nLOWER A,12')).toEqual({
      ok: false,
      problem: 'not-json',
    });
  });

  it('refuse un JSON qui n’est pas une sauvegarde FitTrack', () => {
    expect(parseBackup('{"hello":true}')).toEqual({ ok: false, problem: 'not-a-backup' });
  });

  it('refuse un fichier écrit par une version plus récente', () => {
    const result = parseBackup(
      serializeBackup(file({ version: BACKUP_VERSION + 1 })),
    );
    expect(result).toEqual({ ok: false, problem: 'unsupported-version' });
  });

  it('refuse un fichier vide plutôt que de vider l’app pour rien', () => {
    const empty = file({ preferences: {} });
    for (const key of Object.keys(empty.tables)) {
      empty.tables[key as keyof typeof empty.tables] = [];
    }
    expect(parseBackup(serializeBackup(empty))).toEqual({ ok: false, problem: 'empty' });
  });

  it('accepte un fichier plus ancien à qui il manque une table', () => {
    const older = JSON.parse(serializeBackup(file())) as Record<string, unknown>;
    delete (older.tables as Record<string, unknown>).programs;

    const result = parseBackup(JSON.stringify(older));
    if (!result.ok) throw new Error(`refusé : ${result.problem}`);
    expect(result.backup.tables.programs).toEqual([]);
  });

  it('jette les lignes qui ne sont pas des enregistrements', () => {
    const dirty = JSON.parse(serializeBackup(file())) as Record<string, unknown>;
    (dirty.tables as Record<string, unknown>).workouts = [{ id: 'w-1' }, 'w-2', null];

    const result = parseBackup(JSON.stringify(dirty));
    if (!result.ok) throw new Error(`refusé : ${result.problem}`);
    expect(result.backup.tables.workouts).toEqual([{ id: 'w-1' }]);
  });
});
