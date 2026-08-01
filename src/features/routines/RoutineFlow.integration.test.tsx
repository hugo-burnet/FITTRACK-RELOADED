import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { createCustomExercise } from '@/data/repositories/exercises';
import { getRoutineDetail, listRoutineSummaries } from '@/data/repositories/routines';
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
      </Routes>
    </MemoryRouter>,
  );
}

describe('parcours de composition d’une routine', () => {
  beforeEach(resetDb);

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
});
