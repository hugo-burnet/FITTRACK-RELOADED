import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LearnMore } from './LearnMore';

describe('LearnMore', () => {
  it('déplie et replie le texte sur place', async () => {
    const user = userEvent.setup();
    render(
      <LearnMore>
        <p>Le détail.</p>
      </LearnMore>,
    );

    const toggle = screen.getByRole('button', { name: 'En savoir plus' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Le détail.')).toBeNull();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Le détail.')).toBeVisible();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Le détail.')).toBeNull();
  });
});
