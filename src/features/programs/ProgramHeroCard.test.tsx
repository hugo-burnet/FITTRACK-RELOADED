import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as programWorkoutRepository from '@/data/repositories/programWorkout';
import type { HomeProgramProjection } from '@/data/repositories/home';
import { ProgramHeroCard } from './ProgramHeroCard';

const projection: HomeProgramProjection = {
  programId: 'program-1',
  programName: 'Bloc force',
  startsAt: new Date(2026, 7, 10).getTime(),
  durationWeeks: 4,
  week: {
    weekIndex: 0,
    loadIndex: 100,
    phase: 'construction',
  },
  pick: {
    kind: 'session',
    rule: 'today',
    programScheduleEntryId: 'entry-persisted',
    routineId: 'routine-1',
    routineName: 'Force A',
    scheduledAt: new Date(2026, 7, 10).getTime(),
  },
};

function renderCard(value: HomeProgramProjection = projection) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<ProgramHeroCard program={value} disabled={false} />} />
        <Route path="/workout" element={<p>Séance ouverte</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProgramHeroCard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('démarre l’entrée persistée sans reclasser les séances dans le composant', async () => {
    const start = vi.spyOn(programWorkoutRepository, 'startWorkoutFromProgram').mockResolvedValue({
      workout: {} as Awaited<
        ReturnType<typeof programWorkoutRepository.startWorkoutFromProgram>
      >['workout'],
    });
    const user = userEvent.setup();
    renderCard();

    await user.click(screen.getByRole('button', { name: 'Démarrer Force A' }));

    expect(start).toHaveBeenCalledWith({
      programId: 'program-1',
      programScheduleEntryId: 'entry-persisted',
    });
    expect(await screen.findByText('Séance ouverte')).toBeVisible();
  });

  it('ignore un second appui pendant le démarrage transactionnel', async () => {
    let release!: (
      value: Awaited<ReturnType<typeof programWorkoutRepository.startWorkoutFromProgram>>,
    ) => void;
    const pending = new Promise<
      Awaited<ReturnType<typeof programWorkoutRepository.startWorkoutFromProgram>>
    >((resolve) => {
      release = resolve;
    });
    const start = vi
      .spyOn(programWorkoutRepository, 'startWorkoutFromProgram')
      .mockReturnValue(pending);
    const user = userEvent.setup();
    renderCard();
    const button = screen.getByRole('button', { name: 'Démarrer Force A' });

    await user.dblClick(button);

    expect(start).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
    release({
      workout: {} as Awaited<
        ReturnType<typeof programWorkoutRepository.startWorkoutFromProgram>
      >['workout'],
    });
  });

  it('annonce un bloc futur sans afficher de commande de démarrage', () => {
    renderCard({
      ...projection,
      week: { ...projection.week!, weekIndex: 2 },
      pick: {
        kind: 'announcement',
        rule: 'starts',
        startsAt: new Date(2026, 7, 24).getTime(),
        weekIndex: 2,
      },
    });

    expect(screen.getByText(/commence le 24 août/i)).toBeVisible();
    expect(screen.queryByRole('button', { name: /démarrer/i })).not.toBeInTheDocument();
  });

  it('garde une routine manquante locale à la carte', () => {
    renderCard({
      ...projection,
      pick: {
        kind: 'session',
        rule: 'today',
        programScheduleEntryId: 'entry-persisted',
        routineId: 'routine-1',
        routineName: null,
        scheduledAt: new Date(2026, 7, 10).getTime(),
      },
    });

    expect(screen.getByText('Routine supprimée')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Choisir une autre routine' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /démarrer/i })).not.toBeInTheDocument();
  });
});
