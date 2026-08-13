import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { getProgramDetail, listPrograms } from '@/data/repositories/programs';
import { createRoutine } from '@/data/repositories/routines';
import { resetDb } from '@/test/resetDb';
import { ProgramEditorScreen } from './ProgramEditorScreen';

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="route actuelle">{location.pathname}</output>;
}

function renderProgramFlow() {
  return render(
    <MemoryRouter initialEntries={['/programs/new']}>
      <Routes>
        <Route path="/programs/new" element={<ProgramEditorScreen />} />
        <Route path="/programs/:id" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('parcours de création d’un programme', () => {
  beforeEach(resetDb);

  it('active un bloc de huit semaines avec un split lundi/jeudi et une décharge en semaine 5', async () => {
    const mondayRoutine = await createRoutine('Force A');
    const thursdayRoutine = await createRoutine('Force B');
    const user = userEvent.setup();
    renderProgramFlow();

    await user.type(await screen.findByRole('textbox', { name: 'Nom du bloc' }), 'Bloc force');
    await user.type(screen.getByLabelText('Lundi de départ'), '2026-08-17');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Durée' }), '8');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Jour de la séance 1' }),
      '1',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Routine de la séance 1' }),
      mondayRoutine.id,
    );
    await user.click(screen.getByRole('button', { name: 'Ajouter une séance' }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Jour de la séance 2' }), '4');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Routine de la séance 2' }),
      thursdayRoutine.id,
    );
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    await user.click(await screen.findByRole('button', { name: 'Modifier la semaine 5' }));
    await user.click(screen.getByRole('switch', { name: 'Semaine de décharge' }));
    await user.click(screen.getByRole('button', { name: 'Enregistrer la semaine' }));
    await user.click(screen.getByRole('button', { name: 'Activer le bloc' }));

    const programs = await waitFor(async () => {
      const stored = await listPrograms();
      expect(stored).toHaveLength(1);
      expect(stored[0]?.program.status).toBe('active');
      return stored;
    });
    const programId = programs[0]!.program.id;
    const detail = await getProgramDetail(programId);

    expect(detail?.program).toMatchObject({
      name: 'Bloc force',
      durationWeeks: 8,
      status: 'active',
    });
    expect(detail?.weeks).toHaveLength(8);
    expect(detail?.weeks[4]?.isDeload).toBe(1);
    expect(detail?.revisions[0]?.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ routineId: mondayRoutine.id, dayOfWeek: 1, order: 0 }),
        expect.objectContaining({ routineId: thursdayRoutine.id, dayOfWeek: 4, order: 0 }),
      ]),
    );
    expect(screen.getByRole('status', { name: 'route actuelle' })).toHaveTextContent(
      `/programs/${programId}`,
    );
  });
});
