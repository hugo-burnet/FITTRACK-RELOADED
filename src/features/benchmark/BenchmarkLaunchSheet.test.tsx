import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { getActiveWorkout } from '@/data/repositories/workoutLifecycle';
import { repeatSet, seedExercise, seedRoutine } from '@/test/routineSeed';
import { resetDb } from '@/test/resetDb';
import { BenchmarkLaunchSheet } from './BenchmarkLaunchSheet';

async function seedPush() {
  const press = await seedExercise({ name: 'Développé couché' });
  const { routine } = await seedRoutine('Push', [
    { exercise: press, sets: repeatSet(3, { targetReps: 8, targetRepsMax: 12, targetWeight: 70 }) },
  ]);
  return routine;
}

function renderSheet(routine: { id: string; name: string } | null, onClose = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/routines']}>
      <Routes>
        <Route
          path="/routines"
          element={<BenchmarkLaunchSheet routine={routine} onClose={onClose} />}
        />
        <Route path="/workout" element={<div>Séance en direct</div>} />
      </Routes>
    </MemoryRouter>,
  );
  return onClose;
}

describe('BenchmarkLaunchSheet', () => {
  beforeEach(resetDb);

  it('reste fermée sans routine', () => {
    renderSheet(null);

    expect(screen.queryByText(/Une seule série par exercice/)).not.toBeInTheDocument();
  });

  it('dit ce que le benchmark demande avant de lancer, et propose les styles', async () => {
    renderSheet(await seedPush());

    expect(await screen.findByText(/Une seule série par exercice, menée jusqu’à l’échec/)).toBeInTheDocument();
    const choices = within(screen.getByRole('group', { name: 'Ton style' }));
    expect(
      choices.getAllByRole('button').map((button) => button.textContent),
    ).toEqual([
      'Comme ma routine',
      'Classique · 8 – 12 reps',
      'Léger · 15 – 20 reps',
      'Lourd · 5 – 8 reps',
    ]);
  });

  it('garde « Comme ma routine » d’office, et le dit', async () => {
    renderSheet(await seedPush());

    const routineChoice = await screen.findByRole('button', { name: 'Comme ma routine' });
    expect(routineChoice).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Léger · 15 – 20 reps' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByText(/Chaque exercice se lit sur la fourchette que la routine lui donne/)).toBeInTheDocument();
  });

  it('lance sans style quand on garde « Comme ma routine »', async () => {
    const routine = await seedPush();
    const user = userEvent.setup();
    const onClose = renderSheet(routine);

    await user.click(await screen.findByRole('button', { name: 'Lancer le benchmark' }));

    expect(await screen.findByText('Séance en direct')).toBeInTheDocument();
    const workout = (await getActiveWorkout())!;
    expect(workout).toMatchObject({ kind: 'benchmark', name: 'Benchmark · Push' });
    expect(workout).not.toHaveProperty('benchmarkGoal');
    expect(onClose).toHaveBeenCalled();
  });

  it('lance avec le style choisi, et dit à quelle répétition viser', async () => {
    const routine = await seedPush();
    const user = userEvent.setup();
    renderSheet(routine);

    await user.click(await screen.findByRole('button', { name: 'Léger · 15 – 20 reps' }));

    expect(screen.getByRole('button', { name: 'Léger · 15 – 20 reps' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Comme ma routine' })).toHaveAttribute('aria-pressed', 'false');
    // Le nombre qui guide le choix de la charge : environ 18 fois en léger.
    expect(screen.getByText(/Choisis une charge que tu penses tenir environ 18 fois/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lancer le benchmark' }));

    await waitFor(async () => expect((await getActiveWorkout())?.benchmarkGoal).toBe('light'));
    // L'historique dit le style : on y retrouve un benchmark léger sans l'ouvrir.
    expect(await getActiveWorkout()).toMatchObject({ name: 'Benchmark léger · Push' });
    expect(await screen.findByText('Séance en direct')).toBeInTheDocument();
  });

  it('change d’avis : le dernier choix est celui qui part', async () => {
    const routine = await seedPush();
    const user = userEvent.setup();
    renderSheet(routine);

    await user.click(await screen.findByRole('button', { name: 'Lourd · 5 – 8 reps' }));
    expect(screen.getByText(/environ 8 fois/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Classique · 8 – 12 reps' }));
    expect(screen.getByText(/environ 12 fois/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Lancer le benchmark' }));

    await waitFor(async () => expect((await getActiveWorkout())?.benchmarkGoal).toBe('classic'));
  });

  it('annule sans rien lancer', async () => {
    const routine = await seedPush();
    const user = userEvent.setup();
    const onClose = renderSheet(routine);

    await user.click(await screen.findByRole('button', { name: 'Annuler' }));

    expect(onClose).toHaveBeenCalled();
    expect(await db.workouts.count()).toBe(0);
  });
});
