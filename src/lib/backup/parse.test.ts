import { describe, expect, it } from 'vitest';
import { backupAccountTables } from '@/test/backupAccount';
import { CURRENT_SCHEMA_VERSION } from './backfill';
import { parseBackup } from './parse';
import { BACKUP_FORMAT, BACKUP_VERSION, serializeBackup, type BackupFile } from './types';

function file(overrides: Partial<BackupFile> = {}): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: 1_700_000_000_000,
    app: { name: 'FitTrack', schemaVersion: CURRENT_SCHEMA_VERSION },
    preferences: { 'fittrack:theme': 'light' },
    tables: backupAccountTables(),
    ...overrides,
  };
}

/** Le fichier tel qu'il arrive : du JSON quelconque, à trafiquer avant lecture. */
function loose(overrides: Partial<BackupFile> = {}): Record<string, unknown> {
  return JSON.parse(serializeBackup(file(overrides))) as Record<string, unknown>;
}

function tablesOf(raw: Record<string, unknown>): Record<string, unknown> {
  return raw.tables as Record<string, unknown>;
}

describe('parseBackup', () => {
  it('relit un fichier écrit par l’app, avec ses comptes', () => {
    const result = parseBackup(serializeBackup(file()));
    if (!result.ok) throw new Error(`refusé : ${result.problem}`);

    expect(result.counts.workouts).toBe(1);
    expect(result.counts.workoutSets).toBe(1);
    expect(result.total).toBe(9);
    expect(result.orphans).toEqual([]);
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

  it('refuse un fichier écrit par une version plus récente du format', () => {
    const result = parseBackup(serializeBackup(file({ version: BACKUP_VERSION + 1 })));
    expect(result).toEqual({ ok: false, problem: 'unsupported-version' });
  });

  it('refuse un fichier écrit contre un schéma que cette version ne connaît pas', () => {
    // Le rattrapage ne va que vers l'avant : une base plus récente porte des
    // champs dont aucune migration d'ici ne sait quoi faire.
    const result = parseBackup(
      serializeBackup(file({ app: { name: 'FitTrack', schemaVersion: CURRENT_SCHEMA_VERSION + 1 } })),
    );
    expect(result).toEqual({ ok: false, problem: 'unsupported-schema' });
  });

  it('refuse un en-tête dont une valeur n’a pas le bon type', () => {
    const raw = loose();
    raw.exportedAt = 'hier';
    expect(parseBackup(JSON.stringify(raw))).toEqual({ ok: false, problem: 'not-a-backup' });
  });

  it('refuse un fichier vide plutôt que de vider l’app pour rien', () => {
    const raw = loose({ preferences: {} });
    for (const key of Object.keys(tablesOf(raw))) {
      tablesOf(raw)[key] = [];
    }
    expect(parseBackup(JSON.stringify(raw))).toEqual({ ok: false, problem: 'empty' });
  });

  it('accepte un fichier plus ancien à qui il manque une table récente', () => {
    const raw = loose({ app: { name: 'FitTrack', schemaVersion: 4 } });
    delete tablesOf(raw).programs;
    delete tablesOf(raw).milestones;
    delete tablesOf(raw).coachRecommendations;

    const result = parseBackup(JSON.stringify(raw));
    if (!result.ok) throw new Error(`refusé : ${JSON.stringify(result)}`);
    expect(result.backup.tables.programs).toEqual([]);
    expect(result.backup.tables.milestones).toEqual([]);
  });

  it('refuse l’absence d’une table essentielle', () => {
    const raw = loose();
    delete tablesOf(raw).workoutSets;

    const result = parseBackup(JSON.stringify(raw));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toBe('invalid-structure');
    expect(result.flaws).toContainEqual({ kind: 'missing-table', table: 'workoutSets' });
  });

  it('refuse les lignes qui ne sont pas des enregistrements au lieu de les jeter', () => {
    // Avant, elles disparaissaient sans un mot : le fichier annonçait deux
    // séances, l'app en restaurait une, et personne ne l'apprenait.
    const raw = loose();
    tablesOf(raw).workouts = [(tablesOf(raw).workouts as unknown[])[0], 'w-2', null];

    const result = parseBackup(JSON.stringify(raw));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toBe('invalid-structure');
    expect(result.flaws).toContainEqual({ kind: 'not-a-record', table: 'workouts', index: 1 });
  });

  it('refuse une table malformée au lieu de la lire comme vide', () => {
    const raw = loose();
    tablesOf(raw).workoutSets = { id: 'ws-1' };

    const result = parseBackup(JSON.stringify(raw));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.flaws).toContainEqual({ kind: 'not-a-list', table: 'workoutSets' });
  });

  it('refuse une séance réduite à son identifiant', () => {
    // Le cas exact de l'audit : en-tête et version corrects, contenu inutilisable.
    const raw = loose();
    tablesOf(raw).workouts = [{ id: 'broken' }];

    const result = parseBackup(JSON.stringify(raw));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.problem).toBe('invalid-structure');
    expect((result.flawCount ?? 0)).toBeGreaterThan(0);
  });

  it('refuse une préférence qui n’est pas une chaîne', () => {
    const raw = loose();
    raw.preferences = { 'fittrack:theme': { mode: 'light' } };
    expect(parseBackup(JSON.stringify(raw))).toEqual({ ok: false, problem: 'not-a-backup' });
  });

  it('accepte un fichier avec une référence cassée, mais la signale', () => {
    const raw = loose();
    (tablesOf(raw).workoutSets as Record<string, unknown>[])[0]!.workoutExerciseId = 'we-disparu';

    const result = parseBackup(JSON.stringify(raw));
    if (!result.ok) throw new Error(`refusé : ${JSON.stringify(result)}`);
    expect(result.orphans).toContainEqual({
      table: 'workoutSets',
      field: 'workoutExerciseId',
      count: 1,
    });
  });
});
