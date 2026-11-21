import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Segmented } from './Segmented';

const THREE = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Bravo' },
  { value: 'c', label: 'Charlie' },
] as const;

describe('Segmented', () => {
  it('rend un radiogroup nommé dont une seule option est cochée', () => {
    render(<Segmented label="Lettre" value="b" options={THREE} onChange={vi.fn()} />);
    const group = screen.getByRole('radiogroup', { name: 'Lettre' });
    expect(group).toHaveAttribute('data-part', 'segmented');
    expect(screen.getByRole('radio', { name: 'Bravo' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveAttribute('aria-checked', 'false');
  });

  it('ne laisse qu’une option dans la tabulation', () => {
    render(<Segmented label="Lettre" value="b" options={THREE} onChange={vi.fn()} />);
    const tabIndexes = screen.getAllByRole('radio').map((radio) => radio.getAttribute('tabindex'));
    expect(tabIndexes).toEqual(['-1', '0', '-1']);
  });

  it('garde le groupe joignable quand la valeur n’est dans aucune option', () => {
    render(<Segmented label="Lettre" value="z" options={THREE} onChange={vi.fn()} />);
    const tabIndexes = screen.getAllByRole('radio').map((radio) => radio.getAttribute('tabindex'));
    expect(tabIndexes).toEqual(['0', '-1', '-1']);
  });

  it('choisit au clic', () => {
    const onChange = vi.fn();
    render(<Segmented label="Lettre" value="a" options={THREE} onChange={onChange} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Charlie' }));
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('déplace le focus et choisit avec les flèches, en boucle', () => {
    const onChange = vi.fn();
    render(<Segmented label="Lettre" value="c" options={THREE} onChange={onChange} />);
    const charlie = screen.getByRole('radio', { name: 'Charlie' });
    charlie.focus();
    fireEvent.keyDown(charlie, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('a');
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveFocus();

    const alpha = screen.getByRole('radio', { name: 'Alpha' });
    fireEvent.keyDown(alpha, { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('c');
    expect(charlie).toHaveFocus();

    fireEvent.keyDown(charlie, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith('b');
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Bravo' }), { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith('c');
  });

  it('range deux ou trois options sur une rangée, quatre en deux rangées de deux', () => {
    const four = [...THREE, { value: 'd', label: 'Delta' }] as const;
    const { rerender } = render(
      <Segmented label="Lettre" value="a" options={THREE.slice(0, 2)} onChange={vi.fn()} />,
    );
    const group = () => screen.getByRole('radiogroup');
    expect(group()).toHaveClass('grid-cols-2');
    rerender(<Segmented label="Lettre" value="a" options={THREE} onChange={vi.fn()} />);
    expect(group()).toHaveClass('grid-cols-3');
    rerender(<Segmented label="Lettre" value="a" options={four} onChange={vi.fn()} />);
    expect(group()).toHaveClass('grid-cols-2');
  });

  it('prend sa largeur intrinsèque en inline', () => {
    render(<Segmented label="Lettre" value="a" options={THREE} onChange={vi.fn()} inline />);
    expect(screen.getByRole('radiogroup')).toHaveClass('inline-flex');
    expect(screen.getByRole('radiogroup')).not.toHaveClass('grid');
  });

  it('garde une option verrouillée focalisable, décrite, et sans effet', () => {
    const onChange = vi.fn();
    render(
      <>
        <Segmented
          label="Lettre"
          value="a"
          onChange={onChange}
          options={[
            { value: 'a', label: 'Alpha' },
            { value: 'b', label: 'Bravo', locked: { describedBy: 'why', icon: <i>cadenas</i> } },
          ]}
        />
        <p id="why">Pas encore.</p>
      </>,
    );
    const locked = screen.getByRole('radio', { name: /Bravo/ });
    expect(locked).toHaveAttribute('aria-disabled', 'true');
    expect(locked).not.toBeDisabled();
    expect(locked).toHaveAccessibleDescription('Pas encore.');

    fireEvent.click(locked);
    expect(onChange).not.toHaveBeenCalled();

    const alpha = screen.getByRole('radio', { name: 'Alpha' });
    alpha.focus();
    fireEvent.keyDown(alpha, { key: 'ArrowRight' });
    expect(locked).toHaveFocus();
    expect(onChange).not.toHaveBeenCalled();
  });
});
