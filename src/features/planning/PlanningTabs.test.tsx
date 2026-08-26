import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProgrammingGuideEntry } from '@/features/knowledge/ProgrammingGuideEntry';
import { PlanningTabs } from './PlanningTabs';

function renderAt(pathname: string, node = <PlanningTabs />) {
  render(<MemoryRouter initialEntries={[pathname]}>{node}</MemoryRouter>);
}

describe('PlanningTabs', () => {
  it('pointe exactement vers les trois routes canoniques', () => {
    renderAt('/routines');

    expect(screen.getByRole('link', { name: 'Routines' })).toHaveAttribute('href', '/routines');
    expect(screen.getByRole('link', { name: 'Programmes' })).toHaveAttribute('href', '/programs');
    expect(screen.getByRole('link', { name: 'Guide' })).toHaveAttribute(
      'href',
      '/knowledge/programmation',
    );
  });

  it('marque l’espace actif, et lui seul', () => {
    renderAt('/programs');

    expect(screen.getByRole('link', { name: 'Programmes' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Routines' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Guide' })).not.toHaveAttribute('aria-current');
  });

  it('reste sur le Guide quand on lit un de ses articles', () => {
    renderAt('/knowledge/programmation/programming-volume');

    expect(screen.getByRole('link', { name: 'Guide' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('ProgrammingGuideEntry', () => {
  it('ouvre le véritable éditeur de programme', () => {
    renderAt('/knowledge/programmation', <ProgrammingGuideEntry />);

    expect(screen.getByRole('link', { name: 'Mettre en pratique' })).toHaveAttribute(
      'href',
      '/programs/new',
    );
  });

  it('n’importe ni base, ni repository, ni type de programme', () => {
    // Le Guide n'écrit jamais un `Program`. La règle est structurelle, donc le
    // test l'est aussi : lire les imports du fichier est le seul moyen de la
    // vérifier avant qu'un raccourci ne soit pris.
    const source = readFileSync('src/features/knowledge/ProgrammingGuideEntry.tsx', 'utf8');
    const imports = source.match(/^import .*$/gmu) ?? [];

    expect(imports.filter((line) => /@\/data\/|repositories|programRepository/u.test(line))).toEqual(
      [],
    );
  });
});
