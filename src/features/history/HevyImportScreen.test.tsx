import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { parseHevyCsv } from '@/lib/hevyCsv';
import { resetDb } from '@/test/resetDb';
import fixture from './__fixtures__/hevy-workout-data-real-anonymized.csv?raw';
import { HevyImportScreen } from './HevyImportScreen';

function renderImportScreen() {
  return render(
    <MemoryRouter initialEntries={['/history/import-hevy']}>
      <Routes>
        <Route path="/history/import-hevy" element={<HevyImportScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

function exactTextPattern(value: string): RegExp {
  return new RegExp(
    `^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:À confirmer|Confirmé)`,
  );
}

async function chooseFixture(user: ReturnType<typeof userEvent.setup>) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (input === null) throw new Error('champ de fichier introuvable');
  await user.upload(
    input,
    new File([fixture], 'workout_data.csv', { type: 'text/csv' }),
  );
}

async function importedTableCounts() {
  return {
    exercises: await db.exercises.count(),
    externalExerciseBindings: await db.externalExerciseBindings.count(),
    workouts: await db.workouts.count(),
    workoutExercises: await db.workoutExercises.count(),
    workoutSets: await db.workoutSets.count(),
    routineFolders: await db.routineFolders.count(),
    routines: await db.routines.count(),
    routineExercises: await db.routineExercises.count(),
    routineSets: await db.routineSets.count(),
  };
}

describe('HevyImportScreen — parcours CSV réel', () => {
  beforeEach(resetDb);

  afterEach(() => vi.restoreAllMocks());

  it('ne conserve que des performances synthétiques dans la fixture anonymisée', () => {
    const parsed = parseHevyCsv(fixture);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const sets = parsed.data.workouts.flatMap((workout) =>
      workout.exercises.flatMap((exercise) => exercise.sets),
    );

    expect(new Set(sets.flatMap((set) => set.weight === undefined ? [] : [set.weight]))).toEqual(
      new Set([20]),
    );
    expect(new Set(sets.flatMap((set) => set.reps === undefined ? [] : [set.reps]))).toEqual(
      new Set([10]),
    );
    expect(
      new Set(
        sets.flatMap((set) =>
          set.durationSeconds === undefined ? [] : [set.durationSeconds],
        ),
      ),
    ).toEqual(new Set([30]));
    expect(parsed.data.workouts.every((workout) => workout.notes === undefined)).toBe(true);
  });

  it('garde les confirmations après rollback et ne duplique pas la reprise', async () => {
    const parsed = parseHevyCsv(fixture);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    expect(parsed.data).toMatchObject({
      workoutCount: 6,
      exerciseCount: 25,
      setCount: 136,
    });
    expect(parsed.data.sourceExercises.map((source) => source.sourceTitle)).toEqual(
      expect.arrayContaining([
        'Développé Debout Poulie Centrée',
        'Oiseau (Machine)',
      ]),
    );

    const user = userEvent.setup();
    const mounted = renderImportScreen();

    await chooseFixture(user);
    await screen.findByRole('heading', { name: 'Associer les exercices' });

    expect(screen.getByRole('button', { name: 'Continuer' })).toBeDisabled();

    for (const source of parsed.data.sourceExercises) {
      await user.click(
        screen.getByRole('button', { name: exactTextPattern(source.sourceTitle) }),
      );
      await user.click(
        screen.getByRole('button', {
          name: `Créer « ${source.sourceTitle} »`,
        }),
      );
    }

    fireEvent.transitionEnd(screen.getByRole('dialog'));
    expect(screen.getAllByText('Confirmé')).toHaveLength(25);
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await screen.findByRole('heading', { name: 'Vérifier l’import' });

    const wroteWorkoutSets = vi.spyOn(db.workoutSets, 'bulkAdd');
    const failLate = vi
      .spyOn(db.routineSets, 'bulkAdd')
      .mockRejectedValueOnce(new Error('disk full'));
    await user.click(screen.getByRole('button', { name: 'Importer' }));

    await waitFor(
      () => expect(wroteWorkoutSets).toHaveBeenCalled(),
      { timeout: 10_000 },
    );
    expect(await screen.findByRole('alert', {}, { timeout: 10_000 })).toHaveTextContent(
      'Aucune donnée n’a été écrite. Réessaie.',
    );
    expect(failLate).toHaveBeenCalledOnce();
    await waitFor(async () => {
      expect(await importedTableCounts()).toEqual({
        exercises: 0,
        externalExerciseBindings: 0,
        workouts: 0,
        workoutExercises: 0,
        workoutSets: 0,
        routineFolders: 0,
        routines: 0,
        routineExercises: 0,
        routineSets: 0,
      });
    });
    wroteWorkoutSets.mockRestore();
    failLate.mockRestore();

    await user.click(screen.getByRole('button', { name: 'Retour' }));
    await screen.findByRole('heading', { name: 'Associer les exercices' });
    expect(screen.getAllByText('Confirmé')).toHaveLength(25);
    expect(screen.getByRole('button', { name: 'Continuer' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(screen.getByRole('button', { name: 'Importer' }));
    await screen.findByRole('heading', { name: 'Import terminé' });
    await waitFor(async () => {
      expect(await importedTableCounts()).toEqual({
        exercises: 25,
        externalExerciseBindings: 25,
        workouts: 6,
        workoutExercises: 53,
        workoutSets: 136,
        routineFolders: 1,
        routines: 6,
        routineExercises: 53,
        routineSets: 136,
      });
    });
    const countsAfterFirstImport = await importedTableCounts();

    mounted.unmount();
    renderImportScreen();
    await chooseFixture(user);
    await screen.findByRole('heading', { name: 'Vérifier l’import' });
    await user.click(screen.getByRole('button', { name: 'Importer' }));
    await screen.findByRole('heading', { name: 'Import terminé' });
    expect(screen.getByText('0 séances importées, 6 ignorées.')).toBeVisible();
    expect(await importedTableCounts()).toEqual(countsAfterFirstImport);
  }, 30_000);
});
