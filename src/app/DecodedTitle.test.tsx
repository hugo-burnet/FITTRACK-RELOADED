import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DecodedTitle } from './DecodedTitle';

describe('DecodedTitle', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    vi.useRealTimers();
  });

  it('decodes in Cyber, with the real title kept for screen readers, and lands on it', () => {
    vi.useFakeTimers();
    document.documentElement.setAttribute('data-theme', 'cyber');
    render(
      <h1>
        <DecodedTitle text="Progression" />
      </h1>,
    );

    act(() => vi.advanceTimersByTime(40));
    expect(screen.getByRole('heading', { name: /Progression/ })).toBeInTheDocument();
    expect(screen.getByText('Progression')).toHaveClass('sr-only');

    act(() => vi.advanceTimersByTime(500));
    expect(screen.getByRole('heading').textContent).toBe('Progression');
  });

  it('is the plain title in every other theme', () => {
    document.documentElement.setAttribute('data-theme', 'dark');
    render(
      <h1>
        <DecodedTitle text="Progression" />
      </h1>,
    );

    expect(screen.getByRole('heading').textContent).toBe('Progression');
  });
});
