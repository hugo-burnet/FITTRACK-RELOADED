import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HoldRail } from './HoldRail';

const announce = vi.hoisted(() => vi.fn(() => true));
vi.mock('@/audio/announce', () => ({ announce }));

const now = 1_000_000;

describe('HoldRail', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('annonce la préparation en secondes avant le départ', () => {
    render(<HoldRail hold={{ setId: 's1', rowId: 'row', startedAt: now + 7_000 }} />);
    expect(screen.getByText('Départ · 7')).toBeInTheDocument();
  });

  it('lit le temps tenu en minutes et secondes', () => {
    render(<HoldRail hold={{ setId: 's1', rowId: 'row', startedAt: now - 72_000 }} />);
    expect(screen.getByText('Maintien · 1:12')).toBeInTheDocument();
  });

  // Démonté, plus un seul repère en l'air : la vie du composant *est* celle du
  // maintien, comme le métronome.
  it('annule ses repères en se démontant', () => {
    const view = render(<HoldRail hold={{ setId: 's1', rowId: 'row', startedAt: now }} />);
    view.unmount();
    vi.advanceTimersByTime(200_000);
    expect(announce).not.toHaveBeenCalled();
  });

  it('annonce les repères tant qu’il est monté', () => {
    render(<HoldRail hold={{ setId: 's1', rowId: 'row', startedAt: now }} />);
    vi.advanceTimersByTime(5_000);
    expect(announce).toHaveBeenCalledWith('hold-5');
  });
});
