import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from './Tabs';

const ITEMS = [
  { value: 'one', label: 'Un' },
  { value: 'two', label: 'Deux' },
] as const;

function Harness({ onChange }: { onChange?: (value: 'one' | 'two') => void }) {
  const [value, setValue] = useState<'one' | 'two'>('one');
  return (
    <Tabs
      label="Vues"
      value={value}
      items={ITEMS}
      onChange={(next) => {
        setValue(next);
        onChange?.(next);
      }}
    >
      <p>contenu {value}</p>
    </Tabs>
  );
}

describe('Tabs, forme valeur', () => {
  it('rend un tablist nommé, des tabs reliés au tabpanel qui enveloppe le contenu', () => {
    render(<Harness />);
    const list = screen.getByRole('tablist', { name: 'Vues' });
    expect(list).toHaveAttribute('data-part', 'tabs');
    const one = screen.getByRole('tab', { name: 'Un' });
    const two = screen.getByRole('tab', { name: 'Deux' });
    expect(one).toHaveAttribute('aria-selected', 'true');
    expect(two).toHaveAttribute('aria-selected', 'false');

    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveTextContent('contenu one');
    expect(one).toHaveAttribute('aria-controls', panel.id);
    expect(panel).toHaveAttribute('aria-labelledby', one.id);
  });

  it('ne laisse qu’un onglet dans la tabulation', () => {
    render(<Harness />);
    const tabIndexes = screen.getAllByRole('tab').map((tab) => tab.getAttribute('tabindex'));
    expect(tabIndexes).toEqual(['0', '-1']);
  });

  it('change de vue au clic', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Deux' }));
    expect(onChange).toHaveBeenCalledWith('two');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('contenu two');
  });

  it('déplace le focus et change de vue avec les flèches, en boucle', () => {
    render(<Harness />);
    const one = screen.getByRole('tab', { name: 'Un' });
    one.focus();
    fireEvent.keyDown(one, { key: 'ArrowRight' });
    const two = screen.getByRole('tab', { name: 'Deux' });
    expect(two).toHaveFocus();
    expect(two).toHaveAttribute('aria-selected', 'true');
    expect(two).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(two, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Un' })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Un' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Deux' })).toHaveFocus();
  });
});

describe('Tabs, forme route', () => {
  const ROUTES = [
    { to: '/routines', label: 'Routines' },
    { to: '/programs', label: 'Programmes' },
  ] as const;

  const renderAt = (path: string) =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <Tabs label="Espaces" items={ROUTES} />
      </MemoryRouter>,
    );

  it('rend une nav de liens, sans tablist', () => {
    renderAt('/routines');
    expect(screen.getByRole('navigation', { name: 'Espaces' })).toHaveAttribute(
      'data-part',
      'tabs',
    );
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByRole('link', { name: 'Routines' })).toHaveAttribute('href', '/routines');
  });

  it('marque la page courante, sous-chemin compris', () => {
    renderAt('/programs/abc');
    expect(screen.getByRole('link', { name: 'Programmes' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Routines' })).not.toHaveAttribute('aria-current');
  });

  it('ne confond pas un préfixe de nom avec un sous-chemin', () => {
    renderAt('/programs-archive');
    expect(screen.getByRole('link', { name: 'Programmes' })).not.toHaveAttribute('aria-current');
  });
});
