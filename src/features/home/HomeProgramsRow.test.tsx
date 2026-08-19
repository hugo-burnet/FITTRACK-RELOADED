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
  it('ne répète pas le bloc que la carte du dessus nomme déjà', async () => {
    renderRow(projection());

    expect(await screen.findByText('Programmes')).toBeVisible();
    // Le nom du bloc et sa semaine appartiennent à la carte juste au-dessus.
    // Deux fois le même nom à 16 px d'écart se lit comme une erreur.
    expect(screen.queryByText('Bloc force')).not.toBeInTheDocument();
    expect(screen.queryByText(/Semaine \d+ sur \d+/)).not.toBeInTheDocument();
    expect(screen.queryByText('Aucun bloc actif')).not.toBeInTheDocument();
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
