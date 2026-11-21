import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Tile } from './Tile';
import { TileGrid } from './TileGrid';

describe('Tile', () => {
  it('is named by its label then its figure, and described by its hint', () => {
    render(
      <Tile
        size="S"
        label="poids du jour"
        value={{ value: '82,4', unit: 'kg' }}
        hint="Renseigner le poids du jour"
        onClick={() => undefined}
      />,
    );

    const tile = screen.getByRole('button', { name: 'poids du jour 82,4 kg' });
    expect(tile).toHaveAccessibleDescription('Renseigner le poids du jour');
    expect(tile).toHaveAttribute('data-part', 'tile');
    expect(tile).toHaveAttribute('data-size', 'S');
  });

  it('puts the label first in the DOM and last on screen', () => {
    render(<Tile size="S" label="séances" value={{ value: '12' }} />);

    const label = screen.getByText('séances');
    expect(label.className).toContain('order-last');
    expect(label.nextSibling).not.toBeNull();
  });

  it('is a plain div, with no pressed state, when it has no onClick', () => {
    render(<Tile size="S" label="séances" value={{ value: '12' }} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('séances').closest('[data-part="tile"]')?.tagName).toBe('DIV');
  });

  it('calls onClick from anywhere on the tile', async () => {
    const onClick = vi.fn();
    render(<Tile size="S" label="séances" value={{ value: '12' }} onClick={onClick} />);

    await userEvent.click(screen.getByText('12'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('reads `spoken` instead of the figure, and keeps the figure on screen', () => {
    render(
      <Tile
        size="S"
        label="cette semaine"
        value={{ value: '2 / 4', spoken: '2 sur 4' }}
        onClick={() => undefined}
      />,
    );

    expect(screen.getByRole('button', { name: 'cette semaine 2 sur 4' })).toBeInTheDocument();
    expect(screen.getByText('2 / 4')).toBeVisible();
  });

  it('shows a dash for a measurement never taken and reads it as "aucune mesure"', () => {
    render(<Tile size="S" label="poids du jour" value={null} onClick={() => undefined} />);

    expect(screen.getByText('—')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByRole('button', { name: 'poids du jour aucune mesure' })).toBeInTheDocument();
  });

  it('shows a count of zero as a zero, not as a dash', () => {
    render(<Tile size="S" label="séances" value={{ value: '0' }} />);

    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('draws an empty figure line while reading, named by its label alone', () => {
    render(<Tile size="S" label="poids du jour" value={undefined} onClick={() => undefined} />);

    expect(screen.getByRole('button', { name: 'poids du jour' })).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();
  });

  it('stacks two figures, split by a rule, under a single label', () => {
    const { container } = render(
      <Tile
        size="S"
        label="repos"
        value={[
          { value: '8', caption: 'plancher' },
          { value: '11', caption: 'plafond auto' },
        ]}
      />,
    );

    expect(container.querySelectorAll('[data-part="tile-split"]')).toHaveLength(1);
    expect(screen.getByText('plancher')).toBeInTheDocument();
    expect(screen.getByText('plafond auto')).toBeInTheDocument();
    expect(screen.getAllByText('repos')).toHaveLength(1);
  });

  it('carries a detail on a large tile, and a body and a legend on a big one', () => {
    render(
      <>
        <Tile
          size="L"
          label="volume"
          value={{ value: '6 420', unit: 'kg' }}
          detail="↑ 6 % sur 4 sem."
        />
        <Tile size="G" label="tendance" value={{ value: '82,4', unit: 'kg' }} detail="stable">
          <span data-testid="body">courbe</span>
        </Tile>
      </>,
    );

    expect(screen.getByText('↑ 6 % sur 4 sem.')).toBeInTheDocument();
    expect(screen.getByTestId('body')).toBeInTheDocument();
    expect(screen.getByText('tendance')).toHaveAttribute('data-part', 'legend');
    expect(screen.getByText('volume')).not.toHaveAttribute('data-part');
  });
});

describe('TileGrid', () => {
  const spans = (item: HTMLElement) => [
    item.style.getPropertyValue('--tile-span-1'),
    item.style.getPropertyValue('--tile-span-2'),
    item.style.getPropertyValue('--tile-span-3'),
  ];

  it('is a labelled list of tiles with the spans of placeTiles on each item', () => {
    render(
      <TileGrid title="Cette semaine">
        <Tile size="L" label="a" value={{ value: '1' }} />
        <Tile size="S" label="b" value={{ value: '2' }} />
        <Tile size="S" label="c" value={{ value: '3' }} />
      </TileGrid>,
    );

    expect(screen.getByRole('region', { name: 'Cette semaine' })).toBeInTheDocument();
    const items = screen.getAllByRole('listitem');
    // L S S : 1 1 1 / 2 1 1 / 3 2 1 (table de DESIGN.md).
    expect(items.map(spans)).toEqual([
      ['1', '2', '3'],
      ['1', '1', '2'],
      ['1', '1', '1'],
    ]);
  });

  it('drops a conditional tile that is absent from the placement', () => {
    render(
      <TileGrid>
        <Tile size="S" label="a" value={{ value: '1' }} />
        {false}
        <Tile size="S" label="b" value={{ value: '2' }} />
      </TileGrid>,
    );

    expect(screen.getAllByRole('listitem').map(spans)).toEqual([
      ['1', '1', '2'],
      ['1', '1', '1'],
    ]);
  });

  it('throws on a child with no size, or on a fragment', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() =>
      render(
        <TileGrid>
          <p>pas une tuile</p>
        </TileGrid>,
      ),
    ).toThrow(/size/);
    expect(() =>
      render(
        <TileGrid>
          <>
            <Tile size="S" label="a" value={{ value: '1' }} />
          </>
        </TileGrid>,
      ),
    ).toThrow(/size/);

    error.mockRestore();
  });
});
