import { beforeEach, describe, expect, it } from 'vitest';
import { projectRoutineExport } from '@/lib/export/projectRoutineExport';
import { serializeRoutineMarkdown } from '@/lib/export/serializeRoutineMarkdown';
import { DEFAULT_EXPORT_OPTIONS, type RoutineExportScope } from '@/lib/export/types';
import { resetDb } from '@/test/resetDb';
import { createCustomExercise } from './exercises';
import {
  addExercisesToRoutine,
  addRoutineSet,
  createFolder,
  createRoutine,
  deleteRoutine,
  getRoutineDetail,
  updateRoutine,
  updateRoutineExercise,
  updateRoutineSet,
} from './routines';
import { readRoutineExportSources } from './routineExport';

/**
 * La lecture du périmètre, et le document au bout.
 *
 * Les deux modules purs ont chacun leurs tests ; celui-ci tient ce qu'aucun des
 * deux ne peut voir seul — qu'une routine lue dans Dexie ressort avec son
 * dossier, ses exercices dans l'ordre, et ce qu'on vient d'y taper.
 */

async function anExercise(name: string, unilateral: 0 | 1 = 0): Promise<string> {
  const exercise = await createCustomExercise({
    name,
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'barbell',
    measurementType: 'weight_reps',
    isUnilateral: unilateral,
  });
  return exercise.id;
}

const documentOf = async (scope: RoutineExportScope): Promise<string> => {
  const { sources, folderName } = await readRoutineExportSources(scope);
  return serializeRoutineMarkdown(
    projectRoutineExport(scope, sources, DEFAULT_EXPORT_OPTIONS, Date.UTC(2026, 8, 13), folderName),
  );
};

describe('readRoutineExportSources', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('ne rend que la routine demandée, avec son graphe', async () => {
    const bench = await anExercise('Développé couché');
    const kept = await createRoutine('Poussée');
    const other = await createRoutine('Tirage');
    await addExercisesToRoutine(kept.id, [bench]);
    await addExercisesToRoutine(other.id, [bench]);

    const { sources } = await readRoutineExportSources({
      kind: 'routine',
      routineId: kept.id,
    });

    expect(sources).toHaveLength(1);
    expect(sources[0]?.routine.name).toBe('Poussée');
    expect(sources[0]?.exercises[0]?.exercise?.name).toBe('Développé couché');
    expect(sources[0]?.exercises[0]?.sets).toHaveLength(1);
  });

  it('rend toutes les routines d’un dossier, et le nom du dossier', async () => {
    const folder = await createFolder('Haut du corps');
    const first = await createRoutine('Poussée', folder.id);
    const second = await createRoutine('Tirage', folder.id);
    await createRoutine('Jambes');

    const { sources, folderName } = await readRoutineExportSources({
      kind: 'folder',
      folderId: folder.id,
    });

    expect(folderName).toBe('Haut du corps');
    expect(sources.map(({ routine }) => routine.id).sort()).toEqual([first.id, second.id].sort());
    expect(sources.every(({ folderName: name }) => name === 'Haut du corps')).toBe(true);
  });

  it('rend les routines hors dossier sur un périmètre racine', async () => {
    const folder = await createFolder('Haut du corps');
    await createRoutine('Poussée', folder.id);
    const loose = await createRoutine('Jambes');

    const { sources, folderName } = await readRoutineExportSources({
      kind: 'folder',
      folderId: '',
    });

    expect(folderName).toBeUndefined();
    expect(sources.map(({ routine }) => routine.id)).toEqual([loose.id]);
  });

  it('laisse dehors une routine supprimée', async () => {
    const gone = await createRoutine('Ancienne');
    await deleteRoutine(gone.id);

    const { sources } = await readRoutineExportSources({ kind: 'folder', folderId: '' });

    expect(sources).toHaveLength(0);
  });
});

describe('le document markdown d’une routine', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('porte le nom, le sous-titre, le dossier, les cibles et la note', async () => {
    const folder = await createFolder('Haut du corps');
    const bench = await anExercise('Développé couché');
    const created = await createRoutine('Poussée A', folder.id);
    await updateRoutine(created.id, { subtitle: 'Pectoraux, épaules' });
    await addExercisesToRoutine(created.id, [bench]);

    const line = (await getRoutineDetail(created.id))?.exercises[0];
    if (line === undefined) throw new Error('ligne de routine absente');
    await updateRoutineExercise(line.row.id, { notes: 'Barre à hauteur 7.' });
    await updateRoutineSet(line.sets[0]!.id, {
      targetReps: 8,
      targetRepsMax: 12,
      targetWeight: 80,
    });

    const text = await documentOf({ kind: 'routine', routineId: created.id });

    expect(text).toContain('## Poussée A');
    expect(text).toContain('Pectoraux, épaules · Dossier : Haut du corps');
    expect(text).toContain('Développé couché');
    expect(text).toContain('8 – 12');
    expect(text).toContain('80 kg');
    expect(text).toContain('Barre à hauteur 7.');
  });

  it('rassemble les routines d’un dossier dans un seul document', async () => {
    const folder = await createFolder('Haut du corps');
    const bench = await anExercise('Développé couché');
    for (const name of ['Poussée', 'Tirage']) {
      const created = await createRoutine(name, folder.id);
      await addExercisesToRoutine(created.id, [bench]);
    }

    const text = await documentOf({ kind: 'folder', folderId: folder.id });

    expect(text).toContain('Périmètre : le dossier « Haut du corps »');
    expect(text).toContain('Routines : 2');
    expect(text).toContain('## Poussée');
    expect(text).toContain('## Tirage');
  });

  it('signale l’échauffement comme l’export d’historique', async () => {
    const bench = await anExercise('Développé couché');
    const created = await createRoutine('Poussée');
    await addExercisesToRoutine(created.id, [bench]);

    const line = (await getRoutineDetail(created.id))?.exercises[0];
    if (line === undefined) throw new Error('ligne de routine absente');
    // La seconde série d'abord : `addRoutineSet` recopie la précédente, type
    // compris, et marquer l'échauffement avant l'ajout en produirait deux.
    await addRoutineSet(line.row.id);
    await updateRoutineSet(line.sets[0]!.id, { setType: 'warmup' });

    expect(await documentOf({ kind: 'routine', routineId: created.id })).toContain(
      '1 + 1 échauffement',
    );
  });

  it('écrit le nom nu d’un exercice unilatéral, sans le suffixe d’écran', async () => {
    // Le suffixe « (unilatéral) » est une lecture d'écran : un document qu'on
    // recolle au catalogue a besoin du nom tel qu'il est stocké.
    const oneSided = await anExercise('Extension triceps corde', 1);
    const created = await createRoutine('Bras');
    await addExercisesToRoutine(created.id, [oneSided]);

    const text = await documentOf({ kind: 'routine', routineId: created.id });

    expect(text).toContain('Extension triceps corde');
    expect(text).not.toContain('unilatéral');
  });
});
