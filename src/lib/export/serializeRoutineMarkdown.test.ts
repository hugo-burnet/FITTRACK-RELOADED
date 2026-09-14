import { describe, expect, it } from 'vitest';
import { serializeRoutineMarkdown } from './serializeRoutineMarkdown';
import type { ExportRoutine, ExportRoutineExercise, RoutineExport } from './types';

function bench(overrides: Partial<ExportRoutineExercise> = {}): ExportRoutineExercise {
  return {
    name: 'Développé couché',
    measurementType: 'weight_reps',
    primaryMuscle: 'chest',
    equipment: 'barbell',
    supersetGroup: 0,
    restSeconds: 0,
    sets: [
      { number: 1, type: 'normal', targetReps: 8, targetRepsMax: 12, targetWeight: 80 },
      { number: 2, type: 'normal', targetReps: 8, targetRepsMax: 12, targetWeight: 80 },
    ],
    ...overrides,
  };
}

function routine(overrides: Partial<ExportRoutine> = {}): ExportRoutine {
  return { name: 'Poussée A', exercises: [bench()], ...overrides };
}

function routineExport(overrides: Partial<RoutineExport> = {}): RoutineExport {
  const routines = overrides.routines ?? [routine()];
  return {
    format: 'fittrack-routine-export',
    schemaVersion: 1,
    exportedAt: '2026-09-13T09:00:00.000Z',
    scope: { kind: 'routine', routineId: 'r1' },
    ...overrides,
    routines,
    routineCount: overrides.routineCount ?? routines.length,
  };
}

const write = (overrides: Partial<RoutineExport> = {}) =>
  serializeRoutineMarkdown(routineExport(overrides));

describe('serializeRoutineMarkdown — document', () => {
  it('ouvre sur un titre et un récapitulatif', () => {
    const text = write();

    expect(text.startsWith('# Routines FitTrack\n')).toBe(true);
    expect(text).toContain('Périmètre : la routine « Poussée A »');
    expect(text).toContain('Routines : 1');
    expect(text).toContain('Export du 13 septembre 2026');
  });

  it('nomme le dossier d’un périmètre de dossier', () => {
    expect(
      write({ scope: { kind: 'folder', folderId: 'f1' }, folderName: 'Haut du corps' }),
    ).toContain('Périmètre : le dossier « Haut du corps »');
  });

  it('dit la racine sans lui inventer un nom de dossier', () => {
    expect(write({ scope: { kind: 'folder', folderId: '' } })).toContain(
      'Périmètre : les routines hors dossier',
    );
  });

  it('titre chaque routine, avec son sous-titre et son dossier', () => {
    const text = write({
      routines: [routine({ subtitle: 'Pectoraux, épaules', folderName: 'Haut du corps' })],
    });

    expect(text).toContain('## Poussée A');
    expect(text).toContain('Pectoraux, épaules · Dossier : Haut du corps');
  });

  it('dit « hors dossier » plutôt que de laisser la place vide', () => {
    expect(write()).toContain('Hors dossier');
  });

  it('finit sur une seule fin de ligne', () => {
    const text = write();
    expect(text.endsWith('\n')).toBe(true);
    expect(text.endsWith('\n\n')).toBe(false);
  });

  it('le dit quand il n’y a rien à décrire', () => {
    expect(write({ routines: [], routineCount: 0 })).toContain('Aucune routine sur ce périmètre.');
    expect(write({ routines: [routine({ exercises: [] })] })).toContain(
      'Aucun exercice dans cette routine.',
    );
  });
});

describe('serializeRoutineMarkdown — tableau des exercices', () => {
  it('donne une ligne par exercice, dans l’ordre reçu', () => {
    const text = write({
      routines: [
        routine({
          exercises: [bench(), bench({ name: 'Élévations latérales', sets: bench().sets })],
        }),
      ],
    });
    const rows = text.split('\n').filter((line) => line.startsWith('| '));

    // En-tête + deux exercices.
    expect(rows).toHaveLength(3);
    expect(rows[1]).toContain('Développé couché');
    expect(rows[2]).toContain('Élévations latérales');
  });

  it('écrit la fourchette de répétitions comme l’app la lit', () => {
    expect(write()).toContain('8 – 12');
  });

  it('joint une seule fois ce que toutes les séries répètent', () => {
    // Quatre séries identiques : « 8 – 12 » une fois, pas quatre.
    const sets = [1, 2, 3, 4].map((number) => ({
      number,
      type: 'normal' as const,
      targetReps: 8,
      targetRepsMax: 12,
      targetWeight: 80,
    }));
    const row = write({ routines: [routine({ exercises: [bench({ sets })] })] })
      .split('\n')
      .find((line) => line.includes('Développé couché'));

    expect(row).toContain('| 8 – 12 |');
    expect(row).toContain('| 80 kg |');
  });

  it('écrit toutes les marches d’une montée en charge', () => {
    const sets = [
      { number: 1, type: 'normal' as const, targetReps: 12, targetWeight: 40 },
      { number: 2, type: 'normal' as const, targetReps: 10, targetWeight: 50 },
      { number: 3, type: 'normal' as const, targetReps: 8, targetWeight: 60 },
    ];
    const row = write({ routines: [routine({ exercises: [bench({ sets })] })] })
      .split('\n')
      .find((line) => line.includes('Développé couché'));

    expect(row).toContain('12 · 10 · 8');
    expect(row).toContain('40 kg · 50 kg · 60 kg');
  });

  it('signale les séries d’échauffement dans le compte', () => {
    const withWarmups = bench({
      sets: [
        { number: 1, type: 'warmup', targetReps: 10, targetWeight: 20 },
        { number: 2, type: 'normal', targetReps: 8, targetWeight: 80 },
        { number: 3, type: 'normal', targetReps: 8, targetWeight: 80 },
      ],
    });

    expect(write({ routines: [routine({ exercises: [withWarmups] })] })).toContain(
      '2 + 1 échauffement',
    );
  });

  it('accorde la mention au pluriel', () => {
    const withWarmups = bench({
      sets: [
        { number: 1, type: 'warmup', targetReps: 10, targetWeight: 20 },
        { number: 2, type: 'warmup', targetReps: 8, targetWeight: 40 },
        { number: 3, type: 'normal', targetReps: 8, targetWeight: 80 },
      ],
    });

    expect(write({ routines: [routine({ exercises: [withWarmups] })] })).toContain(
      '1 + 2 échauffements',
    );
  });

  it('porte la durée cible d’un gainage, et pas de colonne de reps', () => {
    const plank = bench({
      name: 'Planche',
      measurementType: 'time_only',
      sets: [
        { number: 1, type: 'normal', targetDurationSeconds: 45 },
        { number: 2, type: 'normal', targetDurationSeconds: 90 },
      ],
    });
    const text = write({ routines: [routine({ exercises: [plank] })] });

    expect(text).toContain('Durée');
    expect(text).toContain('45 s · 1:30 min');
    expect(text).not.toContain('Reps');
  });

  it('n’ouvre pas une colonne que personne ne remplit', () => {
    // Une routine de force n'a ni durée ni distance à montrer.
    const text = write();

    expect(text).toContain('| Exercice | Séries | Reps | Charge |');
    expect(text).not.toContain('Durée');
    expect(text).not.toContain('Distance');
  });

  it('porte la note de la ligne, et seulement s’il y en a une', () => {
    expect(write()).not.toContain('Note');

    const text = write({
      routines: [routine({ exercises: [bench({ notes: 'Poulie cran 3.\nBuste incliné.' })] })],
    });
    expect(text).toContain('| Note |');
    // Les sauts de ligne d'une note ne peuvent pas casser la case.
    expect(text).toContain('Poulie cran 3. Buste incliné.');
  });

  it('nomme un exercice que la bibliothèque ne porte plus', () => {
    const text = write({
      routines: [routine({ exercises: [bench({ name: undefined, measurementType: undefined })] })],
    });

    expect(text).toContain('Exercice inconnu');
  });

  it('nomme les supersets sous le tableau plutôt que dans une colonne', () => {
    const text = write({
      routines: [
        routine({
          exercises: [
            bench({ supersetGroup: 1 }),
            bench({ name: 'Tirage horizontal', supersetGroup: 1 }),
            bench({ name: 'Gainage' }),
          ],
        }),
      ],
    });

    expect(text).toContain('- Superset : Développé couché + Tirage horizontal');
    expect(text).not.toContain('| Superset |');
  });

  it('ne dit rien des supersets quand il n’y en a pas', () => {
    expect(write()).not.toContain('Superset');
  });
});
