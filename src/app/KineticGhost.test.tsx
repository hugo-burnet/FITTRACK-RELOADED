import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KineticGhost } from './KineticGhost';

describe('KineticGhost', () => {
  it('spells the title letter by letter, twice, for a seamless loop, out of reach of screen readers', () => {
    const { container } = render(<KineticGhost text="Accueil" />);
    const ghost = container.querySelector('[data-part="ghost"]');

    expect(ghost).toHaveAttribute('aria-hidden', 'true');
    const letters = [...container.querySelectorAll('[data-letter]')].map((letter) => letter.textContent);
    expect(letters.join('')).toBe('AccueilAccueil');
    expect(container.querySelectorAll('[data-run]')).toHaveLength(2);
  });

  it('keeps the shape of a title with spaces', () => {
    const { container } = render(<KineticGhost text="5×5 — A" />);

    expect(container.querySelector('[data-run]')?.textContent).toBe('5×5 — A');
  });
});
