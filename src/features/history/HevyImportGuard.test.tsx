import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import type { Workout } from '@/data/types';
import { newEntity } from '@/data/repositories/base';
import { createRoutine } from '@/data/repositories/routines';
import { resetDb } from '@/test/resetDb';
import { HevyImportScreen } from './HevyImportScreen';
import { isImportableFileName } from './importFileName';

function renderImport() {
  return render(
    <MemoryRouter initialEntries={['/history/import']}>
      <Routes>
        <Route path="/history/import" element={<HevyImportScreen />} />
        <Route path="/settings/debug" element={<p>Écran de diagnostic</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('isImportableFileName', () => {
  it('accepte l’export Hevy et une sauvegarde FitTrack, rien d’autre', () => {
    expect(isImportableFileName('workout_data.csv')).toBe(true);
    expect(isImportableFileName('WORKOUT_DATA.CSV')).toBe(true);
    expect(isImportableFileName('fittrack-2026-08-02.csv')).toBe(true);
    expect(isImportableFileName('routines.csv')).toBe(false);
    expect(isImportableFileName('fittrack-2026-08-02.txt')).toBe(false);
  });
});

/**
 * Restaurer par-dessus des données existantes n'a pas de sens : les séances
 * seraient dédoublonnées, mais les routines reconstruites viendraient doubler
 * celles déjà là. L'écran laisse entrer et explique — il n'interdit pas.
 */
describe('HevyImportScreen — base non vide', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('propose le fichier directement quand la base est vide', async () => {
    renderImport();

    expect(await screen.findByRole('heading', { name: 'Choisir l’export' })).toBeVisible();
    expect(screen.queryByText('Vide d’abord la base')).not.toBeInTheDocument();
  });

  it('demande de vider avant d’importer quand des données existent', async () => {
    await createRoutine('LOWER A');
    renderImport();

    expect(await screen.findByText('Vide d’abord la base')).toBeVisible();
    expect(
      screen.queryByRole('heading', { name: 'Choisir l’export' }),
    ).not.toBeInTheDocument();
  });

  it('emmène sur l’écran de vidage plutôt que de laisser sans issue', async () => {
    await db.workouts.add(
      newEntity<Workout>({
        routineId: '',
        name: 'Séance libre',
        status: 'completed',
        startedAt: 1_000,
        endedAt: 61_000,
        durationSeconds: 60,
      }),
    );
    const user = userEvent.setup();
    renderImport();

    await user.click(await screen.findByRole('button', { name: 'Vider les données' }));

    expect(await screen.findByText('Écran de diagnostic')).toBeVisible();
  });

  it('laisse ajouter à un historique existant après l’avertissement', async () => {
    await createRoutine('LOWER A');
    const user = userEvent.setup();
    renderImport();

    await user.click(await screen.findByRole('button', { name: 'Importer quand même' }));

    expect(await screen.findByRole('heading', { name: 'Choisir l’export' })).toBeVisible();
  });
});
