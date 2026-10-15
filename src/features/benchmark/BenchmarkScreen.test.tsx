import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import { newEntity } from '@/data/repositories/base';
import * as benchmarkRepository from '@/data/repositories/benchmark';
import { startBenchmarkFromRoutine } from '@/data/repositories/benchmark';
import { getWorkoutDetail } from '@/data/repositories/workoutDetail';
import { finishWorkout } from '@/data/repositories/workoutLifecycle';
import { completeSet } from '@/data/repositories/workoutSets';
import type { Exercise, Routine, RoutineExercise, RoutineSet } from '@/data/types';
import { resetDb } from '@/test/resetDb';
import { BenchmarkScreen } from './BenchmarkScreen';

async function seedBenchmark(
  results: [weight: number, reps: number][],
  zone: { low: number; high: number } = { low: 8, high: 12 },
) {
  const exercises = await Promise.all(
    results.map(async (_, index) => {
      const exercise = newEntity<Exercise>({
        name: index === 0 ? 'Développé couché' : `Exercice ${index + 1}`,
        primaryMuscle: 'chest',
        secondaryMuscles: [],
        equipment: 'barbell',
        measurementType: 'weight_reps',
        isCustom: 0,
        isUnilateral: 0,
      });
      await db.exercises.add(exercise);
      return exercise;
    }),
  );
  const routine = newEntity<Routine>({ name: 'Push', folderId: '', order: 0 });
  await db.routines.add(routine);
  const setIds: string[] = [];
  for (const [index, exercise] of exercises.entries()) {
    const row = newEntity<RoutineExercise>({
      routineId: routine.id,
      exerciseId: exercise.id,
      order: index,
      supersetGroup: 0,
      restSeconds: 0,
      notes: '',
    });
    await db.routineExercises.add(row);
    const sets = [0, 1].map((order) =>
      newEntity<RoutineSet>({
        routineExerciseId: row.id,
        order,
        setType: 'normal',
        targetReps: zone.low,
        targetRepsMax: zone.high,
        targetWeight: 70,
      }),
    );
    await db.routineSets.bulkAdd(sets);
    setIds.push(...sets.map((set) => set.id));
  }

  const workout = await startBenchmarkFromRoutine(routine.id, 'Benchmark · Push');
  const detail = (await getWorkoutDetail(workout.id))!;
  for (const [index, [weight, reps]] of results.entries()) {
    await completeSet(detail.exercises[index]!.sets[0]!.id, { weight, reps });
  }
  await finishWorkout(workout.id);
  return { workout, routine, setIds };
}

function renderScreen(workoutId: string, state?: { benchmarkFresh: boolean }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/benchmark/${workoutId}`, state }]}>
      <Routes>
        <Route path="/benchmark/:workoutId" element={<BenchmarkScreen />} />
        <Route path="/" element={<div>Accueil</div>} />
        <Route path="/history" element={<div>Historique</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const targetWeights = async (ids: string[]) =>
  (await db.routineSets.bulkGet(ids)).map((set) => set?.targetWeight);

describe('BenchmarkScreen', () => {
  beforeEach(resetDb);

  it('lit chaque exercice : ce qui a été fait, le 1RM, la charge conseillée et la routine', async () => {
    const { workout } = await seedBenchmark([[80, 9]]);
    renderScreen(workout.id);

    const card = await screen.findByRole('region', { name: 'Développé couché' });
    expect(within(card).getByText('Fait : 9 reps · 80 kg')).toBeInTheDocument();
    expect(within(card).getByText('1RM estimé : 104 kg')).toBeInTheDocument();
    expect(within(card).getByText('Charge de travail conseillée : 77,5 kg')).toBeInTheDocument();
    expect(within(card).getByText('Dans la routine : 70 kg')).toBeInTheDocument();
    expect(within(card).getByRole('switch', { name: /Développé couché/ })).toBeChecked();
    expect(screen.getByText(/Push · /)).toBeInTheDocument();
  });

  it('écrit la charge dans la routine, le dit, et n’a plus rien à proposer ensuite', async () => {
    const { workout, setIds } = await seedBenchmark([[80, 9]]);
    const user = userEvent.setup();
    renderScreen(workout.id);

    await user.click(await screen.findByRole('button', { name: 'Appliquer à la routine · 1' }));

    expect(await screen.findByText('1 exercice mis à jour dans la routine.')).toBeInTheDocument();
    expect(await targetWeights(setIds)).toEqual([77.5, 77.5]);
    // Le bilan se relit : la routine est à ce niveau, il n'y a plus rien à appliquer.
    expect(await screen.findByText('La routine est déjà à ce niveau.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminé' })).toBeEnabled();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('n’écrit pas ce qu’on a décoché', async () => {
    const { workout, setIds } = await seedBenchmark([
      [80, 9],
      [60, 10],
    ]);
    const user = userEvent.setup();
    renderScreen(workout.id);

    await user.click(await screen.findByRole('switch', { name: /Développé couché/ }));
    await user.click(screen.getByRole('button', { name: 'Appliquer à la routine · 1' }));

    await screen.findByText('1 exercice mis à jour dans la routine.');
    // Le premier est resté à 70 ; le second, 60 kg × 10, est un 1RM de 80 kg que dix répétitions
    // avec deux en réserve ramènent à 60 kg : il est calé, de 70 à 60.
    expect(await targetWeights(setIds)).toEqual([70, 70, 60, 60]);
  });

  it('rallume ce qu’on avait éteint : un second appui rend la ligne à l’écriture', async () => {
    const { workout } = await seedBenchmark([[80, 9]]);
    const user = userEvent.setup();
    renderScreen(workout.id);

    const toggle = await screen.findByRole('switch', { name: /Développé couché/ });
    await user.click(toggle);
    expect(toggle).not.toBeChecked();
    expect(screen.getByRole('button', { name: 'Terminé' })).toBeInTheDocument();

    await user.click(toggle);

    expect(toggle).toBeChecked();
    expect(screen.getByRole('button', { name: 'Appliquer à la routine · 1' })).toBeInTheDocument();
  });

  it('ne propose rien quand tout est décoché, et la sortie quitte sans écrire', async () => {
    const { workout, setIds } = await seedBenchmark([[80, 9]]);
    const user = userEvent.setup();
    renderScreen(workout.id, { benchmarkFresh: true });

    await user.click(await screen.findByRole('switch', { name: /Développé couché/ }));
    await user.click(screen.getByRole('button', { name: 'Terminé' }));

    expect(await screen.findByText('Accueil')).toBeInTheDocument();
    expect(await targetWeights(setIds)).toEqual([70, 70]);
  });

  it('dit « trop léger » au-delà de 30 répétitions, sans interrupteur', async () => {
    const { workout } = await seedBenchmark([[20, 35]]);
    renderScreen(workout.id);

    expect(await screen.findByText(/Plus de 30 répétitions/)).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terminé' })).toBeInTheDocument();
  });

  it('lit la fourchette de chaque exercice : un 15 – 20 n’est plus « trop léger » à 22 répétitions', async () => {
    const { workout, setIds } = await seedBenchmark([[40, 22]], { low: 15, high: 20 });
    const user = userEvent.setup();
    renderScreen(workout.id);

    const card = await screen.findByRole('region', { name: 'Développé couché' });
    expect(within(card).getByText('Fourchette de la routine : 15 – 20 reps')).toBeInTheDocument();
    // 40 × 22 = 69,33 ; sur 17 répétitions : 44,25 → 42,5 sur la grille de la barre (2,5).
    expect(within(card).getByText('Charge de travail conseillée : 42,5 kg')).toBeInTheDocument();
    expect(within(card).getByText('Environ 17 répétitions à fond.')).toBeInTheDocument();
    expect(within(card).queryByText(/Estimation approximative/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Appliquer à la routine · 1' }));
    await screen.findByText('1 exercice mis à jour dans la routine.');
    expect(await targetWeights(setIds)).toEqual([42.5, 42.5]);
  });

  it('éteint l’interrupteur d’une estimation approximative, et ne l’écrit qu’une fois rallumé', async () => {
    // 40 × 25 sur une fourchette de 5 : 20 répétitions d'écart avec la référence.
    const { workout, setIds } = await seedBenchmark([[40, 25]], { low: 5, high: 5 });
    const user = userEvent.setup();
    renderScreen(workout.id);

    const card = await screen.findByRole('region', { name: 'Développé couché' });
    expect(within(card).getByText(/Estimation approximative : 25 répétitions/)).toBeInTheDocument();
    const toggle = within(card).getByRole('switch', { name: /Développé couché/ });
    expect(toggle).not.toBeChecked();
    // Rien de coché : la sortie quitte sans rien écrire.
    expect(screen.getByRole('button', { name: 'Terminé' })).toBeInTheDocument();
    expect(await targetWeights(setIds)).toEqual([70, 70]);

    await user.click(toggle);
    expect(toggle).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Appliquer à la routine · 1' }));

    await screen.findByText('1 exercice mis à jour dans la routine.');
    // 40 × (1 + 25/30) = 73,33 ; sur 7 répétitions : 59,46 → 57,5.
    expect(await targetWeights(setIds)).toEqual([57.5, 57.5]);
  });

  it('revient à l’historique, et non à l’accueil, quand on y est venu de la fiche d’une séance', async () => {
    const { workout } = await seedBenchmark([[80, 9]]);
    const user = userEvent.setup();
    renderScreen(workout.id);

    await user.click(await screen.findByRole('switch', { name: /Développé couché/ }));
    await user.click(screen.getByRole('button', { name: 'Terminé' }));

    expect(await screen.findByText('Historique')).toBeInTheDocument();
  });

  it('dit qu’un benchmark absent n’existe plus', async () => {
    renderScreen('inconnu');

    expect(await screen.findByText('Ce benchmark n’existe plus.')).toBeInTheDocument();
  });

  it('n’écrit qu’une fois sur un double appui', async () => {
    const { workout, setIds } = await seedBenchmark([[80, 9]]);
    const write = vi.spyOn(benchmarkRepository, 'applyBenchmarkProposals');
    const user = userEvent.setup();
    renderScreen(workout.id);

    await user.dblClick(await screen.findByRole('button', { name: 'Appliquer à la routine · 1' }));

    await waitFor(async () => expect(await targetWeights(setIds)).toEqual([77.5, 77.5]));
    expect(write).toHaveBeenCalledTimes(1);
  });
});
