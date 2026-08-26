import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCustomExercise } from '@/data/repositories/exercises';
import { db } from '@/data/db';
import {
  activateProgram,
  createProgramDraft,
  createScheduleRevision,
  replaceProgramWeeks,
} from '@/data/repositories/programs';
import {
  addExercisesToRoutine,
  createFolder,
  createRoutine,
  getRoutineDetail,
  listRoutineSummaries,
  updateRoutine,
} from '@/data/repositories/routines';
import * as routinesRepository from '@/data/repositories/routines';
import { getActiveWorkout } from '@/data/repositories/workouts';
import * as workoutsRepository from '@/data/repositories/workouts';
import type { Workout } from '@/data/types';
import { useExerciseOrderLock } from '@/stores/exerciseOrderLock';
import { useRoutineLibraryView } from '@/stores/routineLibraryView';
import { resetDb } from '@/test/resetDb';
import { TutorialContext } from '@/features/tutorial/tutorialContext';
import { ExercisePickerScreen } from './ExercisePickerScreen';
import { RoutineEditorScreen } from './RoutineEditorScreen';
import { RoutinesScreen } from './RoutinesScreen';

function renderRoutineFlow(initialEntry = '/routines', report = vi.fn()) {
  return render(
    <TutorialContext.Provider
      value={{ openHelp: vi.fn(), startMission: vi.fn(), offerMission: vi.fn(), report }}
    >
      <MemoryRouter initialEntries={[initialEntry]}>
        <LocationProbe />
        <Routes>
          <Route path="/routines" element={<RoutinesScreen />} />
          <Route path="/routines/:id" element={<RoutineEditorScreen />} />
          <Route path="/routines/:id/add" element={<ExercisePickerScreen />} />
          <Route path="/programs" element={<p>Liste des programmes</p>} />
        </Routes>
      </MemoryRouter>
    </TutorialContext.Provider>,
  );
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location-probe">{location.pathname}</output>;
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function reportedEvent<T extends string>(report: ReturnType<typeof vi.fn>, type: T) {
  const event = report.mock.calls.map(([value]) => value).find((value) => value.type === type);
  expect(event).toBeDefined();
  return event;
}

describe('parcours de composition d’une routine', () => {
  const monday = new Date(2026, 7, 10, 8, 0, 0, 0).getTime();

  beforeEach(async () => {
    useExerciseOrderLock.getState().reset();
    useRoutineLibraryView.getState().reset();
    await resetDb();
    vi.spyOn(Date, 'now').mockReturnValue(monday);
  });

  afterEach(() => vi.restoreAllMocks());

  it('reports routine creation only after a successful repository write and exposes the picker anchor', async () => {
    const report = vi.fn();
    const user = userEvent.setup();
    renderRoutineFlow('/routines', report);

    expect(document.querySelectorAll('[data-tutorial-id="routine-create"]')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Nouvelle routine' }));
    await user.click(screen.getByRole('button', { name: 'Routine vide' }));

    await waitFor(() => expect(reportedEvent(report, 'routine-created')).toBeDefined());
    const created = reportedEvent(report, 'routine-created');
    expect(created).toEqual({ type: 'routine-created', routineId: expect.any(String) });
    expect((await getRoutineDetail(created.routineId))?.routine.id).toBe(created.routineId);
    await screen.findByRole('textbox', { name: 'Nom de la routine' });
    expect(document.querySelectorAll('[data-tutorial-id="routine-add-exercise"]')).toHaveLength(1);
  });

  it('does not report or navigate when routine creation is rejected', async () => {
    const report = vi.fn();
    const user = userEvent.setup();
    const failure = new Error('IndexedDB unavailable');
    const create = vi.spyOn(routinesRepository, 'createRoutine').mockRejectedValueOnce(failure);
    renderRoutineFlow('/routines', report);

    await user.click(screen.getByRole('button', { name: 'Nouvelle routine' }));
    await user.click(screen.getByRole('button', { name: 'Routine vide' }));
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    await Promise.resolve();

    expect(report).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'routine-created' }));
    expect(screen.queryByRole('textbox', { name: 'Nom de la routine' })).not.toBeInTheDocument();
    expect(document.querySelector('[data-tutorial-id="routine-add-exercise"]')).toBeNull();
  });

  it('réutilise les commandes compactes de la séance et omet la racine vide', async () => {
    const ppl = await createFolder('PPL');
    const pull = await createRoutine('Pull A');
    await updateRoutine(pull.id, { folderId: ppl.id });
    const user = userEvent.setup();

    renderRoutineFlow();

    expect(await screen.findByRole('heading', { name: 'PPL' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Sans dossier' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Déverrouiller l’ordre des routines' }),
    ).toBeVisible();
    const collapse = screen.getByRole('button', { name: 'Tout replier' });
    expect(collapse).toBeVisible();
    expect(collapse).not.toHaveTextContent('Tout replier');

    await user.click(collapse);

    expect(screen.getByRole('button', { expanded: false, name: /PPL/u })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Tout déplier' })).toBeVisible();
  });

  it('reports collection start only after the workout repository resolves', async () => {
    const routine = await createRoutine('Démarrage collection');
    const workout: Workout = {
      id: 'workout-collection-success',
      createdAt: monday,
      updatedAt: monday,
      deletedAt: 0,
      routineId: routine.id,
      name: routine.name,
      status: 'active',
      startedAt: monday,
      endedAt: 0,
      durationSeconds: 0,
      startedTimezoneOffsetMinutes: 120,
    };
    const pending = deferred<Workout>();
    const report = vi.fn();
    const user = userEvent.setup();
    vi.spyOn(workoutsRepository, 'startWorkoutFromRoutine').mockReturnValueOnce(pending.promise);
    renderRoutineFlow('/routines', report);

    await user.click(await screen.findByRole('button', { name: `Routine — ${routine.name}` }));
    await user.click(screen.getByRole('button', { name: 'Démarrer' }));

    expect(report).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'workout-started' }));
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/routines');

    pending.resolve(workout);

    await waitFor(() =>
      expect(report).toHaveBeenCalledWith({
        type: 'workout-started',
        workoutId: workout.id,
        routineId: routine.id,
      }),
    );
    expect(
      report.mock.calls.map(([event]) => event).filter((event) => event.type === 'workout-started'),
    ).toEqual([{ type: 'workout-started', workoutId: workout.id, routineId: routine.id }]);
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/workout');
  });

  it('keeps the collection route and emits no event when workout start is rejected', async () => {
    const routine = await createRoutine('Échec collection');
    const pending = deferred<Workout>();
    const report = vi.fn();
    const user = userEvent.setup();
    vi.spyOn(workoutsRepository, 'startWorkoutFromRoutine').mockReturnValueOnce(pending.promise);
    renderRoutineFlow('/routines', report);

    await user.click(await screen.findByRole('button', { name: `Routine — ${routine.name}` }));
    await user.click(screen.getByRole('button', { name: 'Démarrer' }));
    pending.reject(new Error('Workout repository unavailable'));

    await Promise.resolve();

    expect(report).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'workout-started' }));
    expect(screen.getByTestId('location-probe')).toHaveTextContent('/routines');
  });

  it('reports persisted routine configuration events with exact IDs and values', async () => {
    const first = await createCustomExercise({
      name: 'Développé guidé',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'machine',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const second = await createCustomExercise({
      name: 'Écarté à la machine',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'machine',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const routine = await createRoutine('Poussée');
    const report = vi.fn();
    const user = userEvent.setup();
    renderRoutineFlow(`/routines/${routine.id}`, report);

    await screen.findByRole('textbox', { name: 'Nom de la routine' });
    await waitFor(() =>
      expect(report).toHaveBeenCalledWith({ type: 'routine-opened', routineId: routine.id }),
    );
    expect(
      report.mock.calls.map(([event]) => event).filter((event) => event.type === 'routine-opened'),
    ).toEqual([{ type: 'routine-opened', routineId: routine.id }]);

    await user.click(screen.getByRole('button', { name: 'Ajouter un exercice' }));
    await user.click(await screen.findByRole('checkbox', { name: new RegExp(first.name) }));
    await user.click(screen.getByRole('checkbox', { name: new RegExp(second.name) }));
    await user.click(screen.getByRole('button', { name: 'Ajouter 2 exercices' }));
    await screen.findByRole('textbox', { name: 'Nom de la routine' });

    await waitFor(() => {
      expect(reportedEvent(report, 'routine-exercise-added')).toEqual({
        type: 'routine-exercise-added',
        routineId: routine.id,
        count: 2,
      });
    });
    expect(
      report.mock.calls.map(([event]) => event).filter((event) => event.type === 'routine-opened'),
    ).toEqual([
      { type: 'routine-opened', routineId: routine.id },
      { type: 'routine-opened', routineId: routine.id },
    ]);
    report.mockClear();
    expect(document.querySelectorAll('[data-tutorial-id="routine-add-exercise"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-tutorial-id="routine-first-set"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-tutorial-id="routine-exercise-menu"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-tutorial-id="routine-add-set"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-tutorial-id="routine-start"]')).toHaveLength(1);

    await user.click(
      document.querySelector('[data-tutorial-id="routine-add-set"]') as HTMLButtonElement,
    );
    await waitFor(async () => {
      const detail = await getRoutineDetail(routine.id);
      expect(detail?.exercises[0]?.sets).toHaveLength(2);
    });
    const addedSet = reportedEvent(report, 'routine-set-added');
    expect(addedSet).toEqual({
      type: 'routine-set-added',
      routineId: routine.id,
      setId: expect.any(String),
    });
    const detailAfterSet = await getRoutineDetail(routine.id);
    expect(detailAfterSet?.exercises[0]?.sets.map((set) => set.id)).toContain(addedSet.setId);

    await user.click(
      document.querySelector('[data-tutorial-id="routine-first-set"]') as HTMLButtonElement,
    );
    await user.click(screen.getAllByRole('button', { name: 'Augmenter' })[0] as HTMLButtonElement);
    await waitFor(async () => {
      const detail = await getRoutineDetail(routine.id);
      expect(detail?.exercises[0]?.sets[0]?.targetReps).toBe(1);
      expect(reportedEvent(report, 'routine-target-updated')).toEqual({
        type: 'routine-target-updated',
        routineId: routine.id,
      });
    });
    await user.click(screen.getByRole('button', { name: 'Appliquer à toutes les séries' }));
    await waitFor(async () => {
      const detail = await getRoutineDetail(routine.id);
      expect(detail?.exercises[0]?.sets[1]?.targetReps).toBe(1);
      expect(
        report.mock.calls
          .map(([event]) => event)
          .filter((event) => event.type === 'routine-target-updated'),
      ).toHaveLength(2);
    });

    await user.click(
      document.querySelector('[data-tutorial-id="routine-exercise-menu"]') as HTMLButtonElement,
    );
    await user.click(screen.getByRole('button', { name: '1:30' }));
    await waitFor(async () => {
      const detail = await getRoutineDetail(routine.id);
      expect(detail?.exercises[0]?.row.restSeconds).toBe(90);
      expect(reportedEvent(report, 'routine-rest-updated')).toEqual({
        type: 'routine-rest-updated',
        routineId: routine.id,
        seconds: 90,
      });
    });

    await user.click(screen.getByRole('button', { name: 'Démarrer' }));
    await waitFor(async () => {
      const workout = await getActiveWorkout();
      expect(reportedEvent(report, 'workout-started')).toEqual({
        type: 'workout-started',
        workoutId: workout?.id,
        routineId: routine.id,
      });
    });
    expect(
      report.mock.calls.map(([event]) => event).filter((event) => event.type === 'routine-opened'),
    ).toEqual([]);
  });

  it('persiste la routine complète après un remontage de la liste', async () => {
    const exercise = await createCustomExercise({
      name: 'Développé militaire',
      primaryMuscle: 'shoulders',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const user = userEvent.setup();
    const mounted = renderRoutineFlow();

    await user.click(await screen.findByRole('button', { name: 'Routine vide' }));

    const name = await screen.findByRole('textbox', { name: 'Nom de la routine' });
    await user.clear(name);
    await user.type(name, 'Épaules force');

    let routineId = '';
    await waitFor(async () => {
      const summaries = await listRoutineSummaries();
      expect(summaries).toHaveLength(1);
      expect(summaries[0]?.routine.name).toBe('Épaules force');
      routineId = summaries[0]?.routine.id ?? '';
      expect(routineId).not.toBe('');
    });

    await user.click(screen.getByRole('button', { name: 'Ajouter un exercice' }));
    await user.click(await screen.findByRole('checkbox', { name: /Développé militaire/ }));
    await user.click(screen.getByRole('button', { name: 'Ajouter 1 exercice' }));

    await screen.findByRole('textbox', { name: 'Nom de la routine' });
    expect(screen.getByText(exercise.name)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Ajouter une série' }));
    expect(await screen.findByText('1 exercice · 2 séries')).toBeVisible();

    await waitFor(async () => {
      const detail = await getRoutineDetail(routineId);
      expect(detail?.routine.name).toBe('Épaules force');
      expect(detail?.exercises).toHaveLength(1);
      expect(detail?.exercises[0]?.exercise?.id).toBe(exercise.id);
      expect(detail?.exercises[0]?.sets).toHaveLength(2);
    });

    mounted.unmount();
    renderRoutineFlow();

    expect(await screen.findByText('Épaules force')).toBeVisible();
    expect(screen.getByText('1 exercice · 2 séries')).toBeVisible();
  });

  it('verrouille l’ordre par défaut et garde le choix pendant la session', async () => {
    const first = await createCustomExercise({
      name: 'Développé couché',
      primaryMuscle: 'chest',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const second = await createCustomExercise({
      name: 'Tirage horizontal',
      primaryMuscle: 'upper_back',
      secondaryMuscles: [],
      equipment: 'cable',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const routine = await createRoutine('Haut du corps');
    await addExercisesToRoutine(routine.id, [first.id, second.id]);
    const user = userEvent.setup();
    const mounted = renderRoutineFlow(`/routines/${routine.id}`);

    await screen.findByText(first.name);
    expect(
      screen.queryByRole('button', { name: `Déplacer ${first.name}` }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Déverrouiller l’ordre des exercices' }));
    const firstHandle = screen.getByRole('button', { name: `Déplacer ${first.name}` });
    fireEvent.keyDown(firstHandle, { key: 'ArrowDown' });

    await waitFor(async () => {
      expect((await getRoutineDetail(routine.id))?.exercises[0]?.exercise?.id).toBe(second.id);
    });

    mounted.unmount();
    renderRoutineFlow(`/routines/${routine.id}`);
    expect(await screen.findByRole('button', { name: `Déplacer ${second.name}` })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Verrouiller l’ordre des exercices' }));
    expect(
      screen.queryByRole('button', { name: `Déplacer ${second.name}` }),
    ).not.toBeInTheDocument();
  });

  it('laisse modifier une routine que le bloc actif programme', async () => {
    const exercise = await createCustomExercise({
      name: 'Squat',
      primaryMuscle: 'quads',
      secondaryMuscles: [],
      equipment: 'barbell',
      measurementType: 'weight_reps',
      isUnilateral: 0,
    });
    const routine = await createRoutine('Jambes');
    await addExercisesToRoutine(routine.id, [exercise.id]);
    const program = await createProgramDraft({
      name: 'Bloc jambes',
      startsAt: new Date(2026, 7, 10).getTime(),
      durationWeeks: 4,
    });
    await replaceProgramWeeks(
      program.id,
      Array.from({ length: 4 }, (_, weekIndex) => ({
        weekIndex,
        loadIndex: 100,
        phase: 'construction' as const,
      })),
    );
    await createScheduleRevision(program.id, 0, [
      { routineId: routine.id, dayOfWeek: 1, order: 0 },
    ]);
    await activateProgram(program.id);
    const user = userEvent.setup();
    renderRoutineFlow(`/routines/${routine.id}`);

    // Ni version, ni sceau, ni semaine d'entrée en vigueur : l'écran est
    // l'éditeur, exactement comme pour une routine qu'aucun bloc ne programme.
    const name = await screen.findByRole('textbox', { name: 'Nom de la routine' });
    expect(screen.getByRole('button', { name: 'Ajouter un exercice' })).toBeVisible();

    await user.clear(name);
    await user.type(name, 'Jambes lourdes');

    await waitFor(async () => {
      expect((await db.routines.get(routine.id))?.name).toBe('Jambes lourdes');
    });
  });

  /**
   * Le déplacement entre dossiers, jusqu'à la base.
   *
   * C'est le test qui protège l'invariant du design : le placement envoyé au
   * repository est calculé sur **toutes** les routines, jamais sur la liste
   * visible. Un placement partiel réécrirait l'ordre des routines repliées à
   * partir de rien, et la perte serait silencieuse.
   */
  it('déplace une routine dans un dossier et persiste l’ordre complet', async () => {
    const pushFolder = await createFolder('Push');
    const rootRoutine = await createRoutine('Racine');
    const pushRoutine = await createRoutine('Poussée');
    await updateRoutine(pushRoutine.id, { folderId: pushFolder.id });

    const user = userEvent.setup();
    renderRoutineFlow('/routines');

    await screen.findByText('Racine');
    // Cadenas fermé au premier rendu : aucune poignée nulle part.
    expect(screen.queryByRole('button', { name: 'Déplacer Racine' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Déverrouiller l’ordre des routines' }));

    const handle = screen.getByRole('button', { name: 'Déplacer Racine' });
    fireEvent.keyDown(handle, { key: 'ArrowDown' });

    await waitFor(async () => {
      const summaries = await listRoutineSummaries();
      const moved = summaries.find((row) => row.routine.id === rootRoutine.id);
      expect(moved?.routine.folderId).toBe(pushFolder.id);
    });

    // L'autre routine n'a pas été oubliée en route : elle garde son dossier.
    const summaries = await listRoutineSummaries();
    expect(summaries.find((row) => row.routine.id === pushRoutine.id)?.routine.folderId).toBe(
      pushFolder.id,
    );
    expect(summaries.map((row) => row.routine.order)).toEqual(
      [...summaries].map((row) => row.routine.order).sort((left, right) => left - right),
    );
  });

  it('replie un dossier, puis le retrouve replié après un reverrouillage', async () => {
    const pushFolder = await createFolder('Push');
    const pushRoutine = await createRoutine('Poussée');
    await updateRoutine(pushRoutine.id, { folderId: pushFolder.id });

    const user = userEvent.setup();
    renderRoutineFlow('/routines');

    await user.click(await screen.findByRole('button', { expanded: true, name: /Push/u }));
    expect(screen.queryByText('Poussée')).not.toBeInTheDocument();

    // Déverrouiller déplie tout, sinon un déplacement se calculerait sur une
    // liste amputée. Reverrouiller rend l'état d'avant.
    await user.click(screen.getByRole('button', { name: 'Déverrouiller l’ordre des routines' }));
    expect(screen.getByText('Poussée')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Verrouiller l’ordre des routines' }));
    expect(screen.queryByText('Poussée')).not.toBeInTheDocument();
  });
});
