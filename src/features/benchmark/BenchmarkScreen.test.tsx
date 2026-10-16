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
import type { BenchmarkGoal, Exercise, Routine, RoutineExercise, RoutineSet } from '@/data/types';
import { TutorialContext } from '@/features/tutorial/tutorialContext';
import { resetDb } from '@/test/resetDb';
import { BenchmarkScreen } from './BenchmarkScreen';

async function seedBenchmark(
  results: [weight: number, reps: number][],
  zone: { low: number; high: number } = { low: 8, high: 12 },
  setCount = 2,
  options: { goal?: BenchmarkGoal; weights?: number[] } = {},
) {
  const exercises = await Promise.all(
    results.map(async (_, index) => {
      const exercise = newEntity<Exercise>({
        name: index === 0 ? 'Développé couché' : `Exercice ${index + 1}`,
        primaryMuscle: 'chest',
        secondaryMuscles: ['triceps', 'shoulders'],
        movementPattern: 'poussee_horizontale',
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
    const sets = Array.from({ length: options.weights?.length ?? setCount }, (_, order) =>
      newEntity<RoutineSet>({
        routineExerciseId: row.id,
        order,
        setType: 'normal',
        targetReps: zone.low,
        targetRepsMax: zone.high,
        targetWeight: options.weights?.[order] ?? 70,
      }),
    );
    await db.routineSets.bulkAdd(sets);
    setIds.push(...sets.map((set) => set.id));
  }

  const workout = await startBenchmarkFromRoutine(routine.id, 'Benchmark · Push', options.goal);
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

/** L'écran dans une appli où l'aide du didacticiel existe : sans elle, aucun « ? » ne peut paraître. */
function renderWithTutorial(workoutId: string) {
  const controls = { openHelp: vi.fn(), startMission: vi.fn(), offerMission: vi.fn(), report: vi.fn() };
  return render(
    <TutorialContext.Provider value={controls}>
      <MemoryRouter initialEntries={[`/benchmark/${workoutId}`]}>
        <Routes>
          <Route path="/benchmark/:workoutId" element={<BenchmarkScreen />} />
        </Routes>
      </MemoryRouter>
    </TutorialContext.Provider>,
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
    // Deux séries à 70 kg dans la routine : la première doit pouvoir faire 11 répétitions à fond pour que la
    // seconde tienne les 8 du bas de la fourchette avec deux en réserve — 104 / (1 + 11,1 / 30) = 75,9 → 75.
    expect(within(card).getByText('75 kg pour 2 séries de 8 – 12 reps')).toBeInTheDocument();
    // À 75 kg le max de 104 kg tient 11,6 répétitions à fond, puis 10,4 : on le dit en entiers, vers le bas.
    expect(
      within(card).getByText('À 75 kg, tu tiendras environ 11 · 10 reps à fond.'),
    ).toBeInTheDocument();
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
    expect(await targetWeights(setIds)).toEqual([75, 75]);
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
    // Le premier est resté à 70 ; le second, 60 kg × 10, est un 1RM de 80 kg : deux séries dont la
    // dernière garde deux répétitions en réserve le ramènent de 70 à 57,5 kg.
    expect(await targetWeights(setIds)).toEqual([70, 70, 57.5, 57.5]);
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
    // 40 × 22 = 69,33 ; deux séries d'un 15 – 20 : 18,9 répétitions pour la première, 42,5 sur la grille de la barre (2,5).
    expect(within(card).getByText('42,5 kg pour 2 séries de 15 – 20 reps')).toBeInTheDocument();
    expect(
      within(card).getByText('À 42,5 kg, tu tiendras environ 18 · 17 reps à fond.'),
    ).toBeInTheDocument();
    expect(within(card).queryByText(/Estimation approximative/)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Appliquer à la routine · 1' }));
    await screen.findByText('1 exercice mis à jour dans la routine.');
    expect(await targetWeights(setIds)).toEqual([42.5, 42.5]);
  });

  it('éteint l’interrupteur d’une estimation approximative, et ne l’écrit qu’une fois rallumé', async () => {
    // 40 × 25 sur une fourchette de 5, deux séries : la première doit tenir 7,8 répétitions, l'essai en est à 17.
    const { workout, setIds } = await seedBenchmark([[40, 25]], { low: 5, high: 5 });
    const user = userEvent.setup();
    renderScreen(workout.id);

    const card = await screen.findByRole('region', { name: 'Développé couché' });
    expect(
      within(card).getByText(
        /Estimation approximative : 25 répétitions, c’est loin des 8 que la première série doit tenir/,
      ),
    ).toBeInTheDocument();
    const toggle = within(card).getByRole('switch', { name: /Développé couché/ });
    expect(toggle).not.toBeChecked();
    // Rien de coché : la sortie quitte sans rien écrire.
    expect(screen.getByRole('button', { name: 'Terminé' })).toBeInTheDocument();
    expect(await targetWeights(setIds)).toEqual([70, 70]);

    await user.click(toggle);
    expect(toggle).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Appliquer à la routine · 1' }));

    await screen.findByText('1 exercice mis à jour dans la routine.');
    // 40 × (1 + 25/30) = 73,33 ; sur 7,8 répétitions : 58,2 → 57,5.
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

  it('n’offre pas « Aide sur cette page » : la route n’a pas de chapitre, son « ? » expliquerait l’accueil', async () => {
    const { workout } = await seedBenchmark([[80, 9]]);
    renderWithTutorial(workout.id);

    await screen.findByRole('region', { name: 'Développé couché' });
    expect(screen.queryByRole('button', { name: 'Aide sur cette page' })).not.toBeInTheDocument();
  });

  it('ne l’offre pas non plus pour un benchmark qui n’existe plus', async () => {
    renderWithTutorial('inconnu');

    await screen.findByText('Ce benchmark n’existe plus.');
    expect(screen.queryByRole('button', { name: 'Aide sur cette page' })).not.toBeInTheDocument();
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

    await waitFor(async () => expect(await targetWeights(setIds)).toEqual([75, 75]));
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('dimensionne la charge sur le nombre de séries de la routine : trois séries, trois séries tenues', async () => {
    const { workout, setIds } = await seedBenchmark([[80, 9]], { low: 8, high: 12 }, 3);
    const user = userEvent.setup();
    renderScreen(workout.id);

    const card = await screen.findByRole('region', { name: 'Développé couché' });
    // 10 / 0,9² = 12,3 répétitions pour la première série : 104 / (1 + 12,3 / 30) = 73,7 → 72,5.
    expect(within(card).getByText('72,5 kg pour 3 séries de 8 – 12 reps')).toBeInTheDocument();
    expect(
      within(card).getByText('À 72,5 kg, tu tiendras environ 13 · 11 · 10 reps à fond.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Appliquer à la routine · 1' }));
    await screen.findByText('1 exercice mis à jour dans la routine.');
    expect(await targetWeights(setIds)).toEqual([72.5, 72.5, 72.5]);
  });

  it('dit « pour une série » quand la routine n’en porte qu’une', async () => {
    const { workout } = await seedBenchmark([[80, 9]], { low: 8, high: 12 }, 1);
    renderScreen(workout.id);

    const card = await screen.findByRole('region', { name: 'Développé couché' });
    expect(within(card).getByText('77,5 kg pour une série de 8 – 12 reps')).toBeInTheDocument();
    expect(
      within(card).getByText('À 77,5 kg, tu tiendras environ 10 reps à fond.'),
    ).toBeInTheDocument();
  });

  describe('avec un style choisi au lancement', () => {
    it('dimensionne la charge sur le style et le dit : 40 × 18 en léger', async () => {
      const { workout } = await seedBenchmark([[40, 18]], { low: 8, high: 12 }, 3, { goal: 'light' });
      renderScreen(workout.id);

      const card = await screen.findByRole('region', { name: 'Développé couché' });
      expect(within(card).getByText('Fait : 18 reps · 40 kg')).toBeInTheDocument();
      expect(within(card).getByText('Ton style : léger · 15 – 20 reps')).toBeInTheDocument();
      expect(within(card).queryByText(/Fourchette de la routine/)).not.toBeInTheDocument();
      expect(within(card).getByText('37,5 kg pour 3 séries de 15 – 20 reps')).toBeInTheDocument();
      expect(
        within(card).getByText('À 37,5 kg, tu tiendras environ 21 · 19 · 17 reps à fond.'),
      ).toBeInTheDocument();
    });

    it('écrit la charge et la fourchette du style dans la routine, et le dit sous l’interrupteur', async () => {
      const { workout, setIds } = await seedBenchmark([[40, 18]], { low: 8, high: 12 }, 3, {
        goal: 'light',
      });
      const user = userEvent.setup();
      renderScreen(workout.id);

      const card = await screen.findByRole('region', { name: 'Développé couché' });
      expect(
        within(card).getByText('Écrit aussi la fourchette 15 – 20 reps sur les séries de travail.'),
      ).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Appliquer à la routine · 1' }));

      await screen.findByText('1 exercice mis à jour dans la routine.');
      const rows = await db.routineSets.bulkGet(setIds);
      expect(rows.map((set) => [set?.targetWeight, set?.targetReps, set?.targetRepsMax])).toEqual([
        [37.5, 15, 20],
        [37.5, 15, 20],
        [37.5, 15, 20],
      ]);
      expect(await screen.findByText('La routine est déjà à ce niveau.')).toBeInTheDocument();
    });
  });

  it('lit une pyramide par sa série la plus lourde, et garde sa forme en l’écrivant', async () => {
    const { workout, setIds } = await seedBenchmark([[80, 9]], { low: 8, high: 12 }, 3, {
      weights: [60, 70, 80],
    });
    const user = userEvent.setup();
    renderScreen(workout.id);

    const card = await screen.findByRole('region', { name: 'Développé couché' });
    expect(within(card).getByText('77,5 kg pour ta série la plus lourde')).toBeInTheDocument();
    expect(
      within(card).getByText('Les autres séries suivent du même écart : la forme de ta pyramide ne change pas.'),
    ).toBeInTheDocument();
    expect(within(card).getByText('Dans la routine : 80 kg')).toBeInTheDocument();
    expect(within(card).getByRole('switch', { name: /Développé couché/ })).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Appliquer à la routine · 1' }));

    await screen.findByText('1 exercice mis à jour dans la routine.');
    expect(await targetWeights(setIds)).toEqual([57.5, 67.5, 77.5]);
  });

  it('éteint l’interrupteur d’une routine qui a changé depuis le benchmark, et le dit', async () => {
    const { workout, setIds } = await seedBenchmark([[80, 9]]);
    const { endedAt } = (await db.workouts.get(workout.id))!;
    // Des semaines plus tard, la routine a progressé : 70 → 90 kg.
    for (const id of setIds) await db.routineSets.update(id, { targetWeight: 90, updatedAt: endedAt + 1 });
    const user = userEvent.setup();
    renderScreen(workout.id);

    const card = await screen.findByRole('region', { name: 'Développé couché' });
    expect(
      within(card).getByText(
        'La routine a changé depuis ce benchmark : vérifie la charge avant de l’appliquer.',
      ),
    ).toBeInTheDocument();
    const toggle = within(card).getByRole('switch', { name: /Développé couché/ });
    expect(toggle).not.toBeChecked();
    // Rien de coché : la sortie quitte sans rien écrire, et la routine reste à 90.
    expect(screen.getByRole('button', { name: 'Terminé' })).toBeInTheDocument();
    expect(await targetWeights(setIds)).toEqual([90, 90]);

    // On peut l'écrire quand même : le bilan propose, la personne dispose.
    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: 'Appliquer à la routine · 1' }));
    await screen.findByText('1 exercice mis à jour dans la routine.');
    expect(await targetWeights(setIds)).toEqual([75, 75]);
  });

  it('ne parle pas d’interrupteur quand il n’y en a pas : estimation approximative d’une routine déjà alignée', async () => {
    // 60 × 20 est approximatif pour une fourchette de 8 – 12 sur trois séries (écart de 8), et la routine,
    // à 70 kg, porte déjà la charge calibrée : pas de proposition, donc pas d'interrupteur à rallumer.
    const { workout } = await seedBenchmark([[60, 20]], { low: 8, high: 12 }, 3);
    renderScreen(workout.id);

    const card = await screen.findByRole('region', { name: 'Développé couché' });
    expect(within(card).getByText(/Estimation approximative/)).toBeInTheDocument();
    expect(within(card).queryByText(/interrupteur/)).not.toBeInTheDocument();
    expect(within(card).queryByRole('switch')).not.toBeInTheDocument();
  });
});
