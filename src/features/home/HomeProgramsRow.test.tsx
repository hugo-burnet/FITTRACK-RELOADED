import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { HomeProgramProjection } from '@/data/repositories/home';
import { HomeProgramsRow } from './HomeProgramsRow';

const projection = (over: Partial<HomeProgramProjection> = {}): HomeProgramProjection => ({
  programId: 'block-1',
  programName: 'Bloc force',
  startsAt: new Date(2026, 7, 10).getTime(),
  durationWeeks: 8,
  week: { weekIndex: 1, loadIndex: 100, phase: 'construction' },
  pick: { kind: 'none' },
  ...over,
});

function renderRow(program: HomeProgramProjection | null) {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HomeProgramsRow program={program} />} />
        <Route path="/programs" element={<p>Liste des programmes</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('HomeProgramsRow', () => {
  it('nomme le bloc actif sans répéter sa semaine', async () => {
    renderRow(projection());

    expect(await screen.findByText('Programmes')).toBeVisible();
    expect(screen.getByText('Bloc force')).toBeVisible();
    // « Semaine 2 sur 8 » appartient à la carte du dessus : deux relevés du
    // même bloc sur un écran finissent par diverger.
    expect(screen.queryByText(/Semaine \d+ sur \d+/)).not.toBeInTheDocument();
  });

  it('reste là quand aucun bloc ne tourne', async () => {
    renderRow(null);

    expect(await screen.findByText('Aucun bloc actif')).toBeVisible();
  });

  it('ouvre la liste des blocs', async () => {
    const user = userEvent.setup();
    renderRow(null);

    await user.click(await screen.findByRole('button', { name: /Programmes/ }));

    expect(await screen.findByText('Liste des programmes')).toBeVisible();
  });
});
