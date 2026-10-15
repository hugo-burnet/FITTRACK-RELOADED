import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '@/test/resetDb';
import { ProgramBenchmarkCard } from './ProgramBenchmarkCard';

const sessions = [
  { routineId: 'push', routineName: 'Push' },
  { routineId: 'pull', routineName: 'Pull' },
  // Le même bloc passe deux fois dans la semaine : une seule ligne.
  { routineId: 'push', routineName: 'Push' },
  // Une routine supprimée n'a pas de nom : rien à calibrer.
  { routineId: 'gone', routineName: null },
];

function renderCard(props: Parameters<typeof ProgramBenchmarkCard>[0]) {
  return render(
    <MemoryRouter>
      <ProgramBenchmarkCard {...props} />
    </MemoryRouter>,
  );
}

describe('ProgramBenchmarkCard', () => {
  beforeEach(resetDb);

  it('propose le benchmark de chaque routine du programme, une fois chacune', () => {
    renderCard({ sessions, busy: false });

    expect(screen.getByRole('heading', { name: 'Calibrer les charges' })).toBeInTheDocument();
    expect(screen.getByText(/Les charges d’un programme viennent de ses routines/)).toBeInTheDocument();
    const rows = screen.getAllByRole('button', { name: /^(Push|Pull)/ });
    expect(rows.map((row) => within(row).getByText(/^(Push|Pull)$/).textContent)).toEqual(['Push', 'Pull']);
  });

  it('ne dit rien d’un programme sans routine', () => {
    const { container } = renderCard({ sessions: [{ routineId: 'gone', routineName: null }], busy: false });

    expect(container).toBeEmptyDOMElement();
  });

  it('s’éteint, avec sa raison, tant qu’une séance tourne : une seule à la fois', () => {
    renderCard({ sessions, busy: true });

    for (const row of screen.getAllByRole('button', { name: /^(Push|Pull)/ })) {
      expect(row).toBeDisabled();
    }
    expect(screen.getAllByText(/Une séance est déjà en cours/).length).toBe(2);
  });

  it('ouvre la feuille de lancement de la routine choisie, avec le choix du style', async () => {
    const user = userEvent.setup();
    renderCard({ sessions, busy: false });

    await user.click(screen.getByRole('button', { name: /^Pull/ }));

    expect(await screen.findByText(/Une seule série par exercice, menée jusqu’à l’échec/)).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Ton style' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lancer le benchmark' })).toBeInTheDocument();
  });
});
