import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SeriesMeter } from './SeriesMeter';

describe('SeriesMeter', () => {
  afterEach(() => vi.useRealTimers());

  const meter = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('[data-part="series-meter"]');

  it('draws the share of sets done, one notch per set', () => {
    const { container } = render(<SeriesMeter done={3} total={15} />);

    expect(meter(container)?.style.getPropertyValue('--v')).toBe('20%');
    expect(meter(container)?.style.getPropertyValue('--notch')).toBe(`${100 / 15}%`);
  });

  it('marks a gain and a loss, then lets them go', () => {
    vi.useFakeTimers();
    const view = render(<SeriesMeter done={3} total={15} />);
    expect(meter(view.container)).not.toHaveAttribute('data-dir');

    view.rerender(<SeriesMeter done={4} total={15} />);
    act(() => vi.advanceTimersByTime(0));
    expect(meter(view.container)).toHaveAttribute('data-dir', 'up');

    view.rerender(<SeriesMeter done={3} total={15} />);
    act(() => vi.advanceTimersByTime(0));
    expect(meter(view.container)).toHaveAttribute('data-dir', 'down');

    act(() => vi.advanceTimersByTime(800));
    expect(meter(view.container)).not.toHaveAttribute('data-dir');
  });

  it('detaches the lost notch when a set is undone, then lets it evaporate', () => {
    vi.useFakeTimers();
    const view = render(<SeriesMeter done={4} total={10} />);

    view.rerender(<SeriesMeter done={3} total={10} />);
    act(() => vi.advanceTimersByTime(0));

    const piece = view.container.querySelector<HTMLElement>('[data-hp="loss"]');
    expect(piece?.style.left).toBe('30%');
    expect(piece?.style.width).toBe('10%');

    act(() => vi.advanceTimersByTime(1_000));
    expect(view.container.querySelector('[data-hp="loss"]')).toBeNull();
  });

  it('stays empty rather than dividing by zero', () => {
    const { container } = render(<SeriesMeter done={0} total={0} />);

    expect(meter(container)?.style.getPropertyValue('--v')).toBe('0%');
  });
});
