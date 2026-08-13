import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as programsRepository from '@/data/repositories/programs';
import {
  activateProgram,
  createProgramDraft,
  createScheduleRevision,
  getProgramDetail,
  listPrograms,
  replaceProgramWeeks,
} from '@/data/repositories/programs';
import { createRoutine } from '@/data/repositories/routines';
import { resetDb } from '@/test/resetDb';
import { ProgramEditorScreen } from './ProgramEditorScreen';

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="route actuelle">{location.pathname}</output>;
}

function renderProgramFlow(initialEntry = '/programs/new') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/programs/new" element={<ProgramEditorScreen />} />
        <Route path="/programs/:id/edit" element={<ProgramEditorScreen />} />
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

  it('repersiste le cadre après un retour depuis le split', async () => {
    const user = userEvent.setup();
    renderProgramFlow();

    await user.type(await screen.findByRole('textbox', { name: 'Nom du bloc' }), 'Bloc stable');
    await user.type(screen.getByLabelText('Lundi de départ'), '2026-08-17');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));
    await user.click(await screen.findByRole('button', { name: 'Retour' }));

    const name = screen.getByRole('textbox', { name: 'Nom du bloc' });
    await user.clear(name);
    await user.type(name, 'Bloc durable');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Durée' }), '10');
    await user.click(screen.getByRole('button', { name: 'Continuer' }));

    await waitFor(async () => {
      const stored = await listPrograms();
      expect(stored[0]?.program).toMatchObject({ name: 'Bloc durable', durationWeeks: 10 });
    });
  });

  it('publie le split modifié d’un bloc actif à la semaine suivante sûre', async () => {
    const routine = await createRoutine('Force active');
    const replacement = await createRoutine('Force suivante');
    const today = new Date();
    const isoDay = today.getDay() === 0 ? 7 : today.getDay();
    const startsAtDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    startsAtDate.setDate(startsAtDate.getDate() - (isoDay - 1));
    const startsAt = startsAtDate.getTime();
    const program = await createProgramDraft({ name: 'Bloc actif', startsAt, durationWeeks: 4 });
    await createScheduleRevision(program.id, 0, [
      { routineId: routine.id, dayOfWeek: 1, order: 0 },
    ]);
    await replaceProgramWeeks(
      program.id,
      Array.from({ length: 4 }, (_, weekIndex) => ({
        weekIndex,
        prescriptionKind: 'percent_1rm' as const,
        prescriptionValue: 70,
        isDeload: 0 as const,
      })),
    );
    await activateProgram(program.id);
    const user = userEvent.setup();
    renderProgramFlow(`/programs/${program.id}/edit`);

    await user.selectOptions(
      await screen.findByRole('combobox', { name: 'Routine de la séance 1' }),
      replacement.id,
    );
    await user.click(screen.getByRole('button', { name: 'Enregistrer la révision' }));
    expect(await screen.findByRole('status', { name: 'route actuelle' })).toHaveTextContent(
      `/programs/${program.id}`,
    );
    const detail = await getProgramDetail(program.id);
    expect(detail?.revisions).toHaveLength(2);
    expect(detail?.revisions[1]?.revision.effectiveFromWeekIndex).toBe(1);
    expect(detail?.revisions[1]?.entries[0]?.routineId).toBe(replacement.id);
    expect(detail?.weeks).toHaveLength(4);
  });

  it('distingue une erreur de lecture de l’absence et du chargement', async () => {
    const read = vi.spyOn(programsRepository, 'getProgramDetail').mockRejectedValueOnce(
      new Error('read failed'),
    );

    renderProgramFlow('/programs/unreadable/edit');

    expect(
      await screen.findByText('Le bloc n’a pas pu être lu. Tes données restent sur cet appareil.'),
    ).toBeVisible();
    read.mockRestore();
  });
});
