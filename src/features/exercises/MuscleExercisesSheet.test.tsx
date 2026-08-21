import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import type { Exercise, MuscleGroup } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { MuscleExercisesSheet } from './MuscleExercisesSheet';

function exercise(id: string, name: string, primaryMuscle: MuscleGroup): Exercise {
  return {
    ...newEntity<Exercise>({
      name,
      primaryMuscle,
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isCustom: 0,
      isUnilateral: 0,
    }),
    id,
  };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderSheet(muscle: Parameters<typeof MuscleExercisesSheet>[0]['muscle']) {
  const onClose = vi.fn();
  render(
    <MemoryRouter initialEntries={['/']}>
      <MuscleExercisesSheet open muscle={muscle} onClose={onClose} />
      <Routes>
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
  return { onClose };
}

beforeEach(async () => {
  await resetDb();
  await db.exercises.bulkAdd([
    exercise('bench', 'Développé couché', 'chest'),
    exercise('fly', 'Écarté à la poulie', 'chest'),
    exercise('row', 'Rowing barre', 'upper_back'),
  ]);
});

describe('MuscleExercisesSheet', () => {
  it('nomme le groupe du catalogue, pas le muscle dessiné', async () => {
    // Le deltoïde latéral n'existe pas pour le catalogue : il file les exercices
    // par groupe, et la feuille ne doit pas promettre une finesse absente.
    renderSheet('deltoid_lateral');
    expect(await screen.findByText('Épaules')).toBeInTheDocument();
  });

  it('liste les exercices dont c’est le muscle principal', async () => {
    renderSheet('pectoralis_major');

    expect(await screen.findByText('Développé couché')).toBeInTheDocument();
    expect(screen.getByText('Écarté à la poulie')).toBeInTheDocument();
    expect(screen.queryByText('Rowing barre')).not.toBeInTheDocument();
    expect(screen.getByText('2 exercices du catalogue')).toBeInTheDocument();
  });

  it('accorde le décompte au singulier', async () => {
    renderSheet('rhomboids');
    expect(await screen.findByText('1 exercice du catalogue')).toBeInTheDocument();
  });

  it('le dit quand aucun exercice ne cible le groupe', async () => {
    renderSheet('calves');
    expect(
      await screen.findByText('Aucun exercice du catalogue ne cible ce muscle.'),
    ).toBeInTheDocument();
  });

  it('ouvre la fiche de l’exercice touché', async () => {
    const user = userEvent.setup();
    const { onClose } = renderSheet('pectoralis_major');

    await user.click(await screen.findByText('Développé couché'));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/exercises/bench');
    });
    // Fermée avant de partir : retrouver la feuille au retour serait l'app qui
    // se souvient de ce qu'on vient de quitter.
    expect(onClose).toHaveBeenCalled();
  });

  it('passe le relais au catalogue filtré sur le même groupe', async () => {
    const user = userEvent.setup();
    renderSheet('pectoralis_major');

    await user.click(await screen.findByRole('button', { name: 'Voir dans le catalogue' }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/exercises?muscle=chest');
    });
  });

  it('explique les muscles que le catalogue ne nomme pas, au lieu de ne rien faire', async () => {
    renderSheet('serratus_anterior');

    expect(await screen.findByText('Muscle hors catalogue')).toBeInTheDocument();
    expect(
      screen.getByText(/le catalogue ne le nomme pas : aucun exercice ne peut le cibler/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Voir dans le catalogue' }),
    ).not.toBeInTheDocument();
  });
});
