import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCustomExercise } from '@/data/repositories/exercises';
import {
  activateProgram,
  createProgramDraft,
  createScheduleRevision,
  getProgramDetail,
  replaceProgramWeeks,
} from '@/data/repositories/programs';
import {
  addExercisesToRoutine,
  createRoutine,
  getRoutineDetail,
  listRoutineSummaries,
} from '@/data/repositories/routines';
import { useExerciseOrderLock } from '@/stores/exerciseOrderLock';
import { resetDb } from '@/test/resetDb';
import { ExercisePickerScreen } from './ExercisePickerScreen';
import { RoutineEditorScreen } from './RoutineEditorScreen';
import { RoutinesScreen } from './RoutinesScreen';

function renderRoutineFlow(initialEntry = '/routines') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/routines" element={<RoutinesScreen />} />
        <Route path="/routines/:id" element={<RoutineEditorScreen />} />
        <Route path="/routines/:id/add" element={<ExercisePickerScreen />} />
        <Route path="/programs" element={<p>Liste des programmes</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('parcours de composition d’une routine', () => {
  const monday = new Date(2026, 7, 10, 8, 0, 0, 0).getTime();

  beforeEach(async () => {
    useExerciseOrderLock.getState().reset();
    await resetDb();
    vi.spyOn(Date, 'now').mockReturnValue(monday);
  });

  afterEach(() => vi.restoreAllMocks());

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

    await user.click(
      screen.getByRole('button', { name: 'Déverrouiller l’ordre des exercices' }),
    );
    const firstHandle = screen.getByRole('button', { name: `Déplacer ${first.name}` });
    fireEvent.keyDown(firstHandle, { key: 'ArrowDown' });

    await waitFor(async () => {
      expect((await getRoutineDetail(routine.id))?.exercises[0]?.exercise?.id).toBe(second.id);
    });

    mounted.unmount();
    renderRoutineFlow(`/routines/${routine.id}`);
    expect(
      await screen.findByRole('button', { name: `Déplacer ${second.name}` }),
    ).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: 'Verrouiller l’ordre des exercices' }),
    );
    expect(
      screen.queryByRole('button', { name: `Déplacer ${second.name}` }),
    ).not.toBeInTheDocument();
  });

  it('ouvre les programmes depuis une entrée pleine largeur et lit la semaine active', async () => {
    const routine = await createRoutine('Force A');
    const program = await createProgramDraft({
      name: 'Bloc force',
      startsAt: new Date(2026, 7, 10).getTime(),
      durationWeeks: 4,
    });
    await replaceProgramWeeks(
      program.id,
      Array.from({ length: 4 }, (_, weekIndex) => ({
        weekIndex,
        prescriptionKind: 'percent_1rm' as const,
        prescriptionValue: 75,
        isDeload: 0 as const,
      })),
    );
    await createScheduleRevision(program.id, 0, [
      { routineId: routine.id, dayOfWeek: 1, order: 0 },
    ]);
    await activateProgram(program.id);
    const user = userEvent.setup();
    renderRoutineFlow();

    const programs = await screen.findByRole('button', { name: /Programmes/ });
    expect(programs).toHaveClass('w-full');
    expect(await screen.findByText('Semaine 1 sur 4')).toBeVisible();
    await user.click(programs);

    expect(await screen.findByText('Liste des programmes')).toBeVisible();
  });

  it('affiche aucun bloc actif quand aucune semaine de programme ne gouverne les routines', async () => {
    renderRoutineFlow();

    expect(await screen.findByText('Aucun bloc actif')).toBeVisible();
  });

  it('scelle une version publiée puis publie son brouillon à partir d’une semaine choisie', async () => {
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
        prescriptionKind: 'target_rpe' as const,
        prescriptionValue: 7,
        isDeload: 0 as const,
      })),
    );
    await createScheduleRevision(program.id, 0, [
      { routineId: routine.id, dayOfWeek: 1, order: 0 },
    ]);
    await activateProgram(program.id);
    const user = userEvent.setup();
    renderRoutineFlow(`/routines/${routine.id}`);

    expect(await screen.findByText('Version 1 · Publiée')).toBeVisible();
    expect(screen.queryByRole('textbox', { name: 'Nom de la routine' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ajouter un exercice' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Créer une version' }));

    expect(await screen.findByRole('textbox', { name: 'Nom de la routine' })).toBeVisible();
    expect(screen.getByText('Version 2 · Brouillon')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Utiliser à partir de la semaine 2' }));

    expect(await screen.findByRole('radiogroup', { name: 'Semaine d’entrée en vigueur' })).toBeVisible();
    await user.click(screen.getByRole('radio', { name: 'Semaine 3' }));

    await waitFor(async () => {
      const detail = await getProgramDetail(program.id);
      expect(detail?.revisions.at(-1)?.revision.effectiveFromWeekIndex).toBe(2);
      expect(detail?.revisions.at(-1)?.entries[0]?.routineId).not.toBe(routine.id);
    });
  });
});
