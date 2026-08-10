import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ReorderableList } from './ReorderableList';

function renderList(disabled: boolean, onReorder = vi.fn()) {
  const view = render(
    <ReorderableList
      items={['A', 'B']}
      keyOf={(item) => item}
      disabled={disabled}
      onReorder={onReorder}
      renderItem={(item, _index, state) => (
        <button type="button" data-testid={`handle-${item}`} {...state.handleProps}>
          {item}
        </button>
      )}
    />,
  );

  return { ...view, onReorder };
}

describe('ReorderableList disabled', () => {
  it('ignore les flèches du clavier quand la liste est désactivée', () => {
    const { onReorder } = renderList(true);
    fireEvent.keyDown(screen.getByTestId('handle-A'), { key: 'ArrowDown' });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('ignore le pointeur quand la liste est désactivée', () => {
    const { onReorder } = renderList(true);
    const handle = screen.getByTestId('handle-A');

    fireEvent.pointerDown(handle, { pointerId: 1, clientY: 10 });
    fireEvent.pointerMove(handle, { pointerId: 1, clientY: 100 });
    fireEvent.pointerUp(handle, { pointerId: 1, clientY: 100 });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('conserve le déplacement clavier quand la liste est active', () => {
    const { onReorder } = renderList(false);
    fireEvent.keyDown(screen.getByTestId('handle-A'), { key: 'ArrowDown' });
    expect(onReorder).toHaveBeenCalledWith(0, 1);
  });
});
