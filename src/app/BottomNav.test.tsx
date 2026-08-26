import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { BottomNav } from './BottomNav';
import { isPlanningPath } from './planningPaths';

function renderAt(pathname: string) {
  render(
    <MemoryRouter initialEntries={[pathname]}>
      <BottomNav />
    </MemoryRouter>,
  );
}

describe('BottomNav', () => {
  it('ouvre Planifier sur la bibliothèque de routines', () => {
    renderAt('/');

    expect(screen.getByRole('link', { name: 'Planifier' })).toHaveAttribute('href', '/routines');
  });

  it('garde Planifier actif sur les trois espaces qu’il couvre', () => {
    // Le défaut évité : l'onglet s'éteignait dès qu'on ouvrait le Guide ou les
    // programmes, alors qu'on est resté dans le même espace.
    for (const pathname of ['/routines', '/programs', '/knowledge/programmation']) {
      const { unmount } = render(
        <MemoryRouter initialEntries={[pathname]}>
          <BottomNav />
        </MemoryRouter>,
      );
      expect(screen.getByRole('link', { name: 'Planifier' }), pathname).toHaveAttribute(
        'aria-current',
        'page',
      );
      unmount();
    }
  });

  it('n’allume pas Planifier sur le reste du wiki', () => {
    renderAt('/knowledge');

    expect(screen.getByRole('link', { name: 'Planifier' })).not.toHaveAttribute('aria-current');
  });

  it('conserve l’activité exacte de l’accueil et par préfixe ailleurs', () => {
    renderAt('/history/2026-01');

    expect(screen.getByRole('link', { name: 'Historique' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Accueil' })).not.toHaveAttribute('aria-current');
  });

  it('ne confond pas un préfixe de segment avec un préfixe de chaîne', () => {
    expect(isPlanningPath('/routines')).toBe(true);
    expect(isPlanningPath('/knowledge/programmation/programming-volume')).toBe(true);
    expect(isPlanningPath('/knowledge')).toBe(false);
    expect(isPlanningPath('/exercises')).toBe(false);
  });
});
