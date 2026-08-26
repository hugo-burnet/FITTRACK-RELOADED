import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n/fr';
import { CoachCard } from './CoachCard';

const objective = {
  code: 'range_ceiling_reached' as const,
  nextLoadKg: 50,
  evidence: [
    { label: 'working_sets', value: 3 },
    { label: 'target_reps_max', value: 12 },
    { label: 'current_load_kg', value: 47.5 },
    { label: 'next_load_kg', value: 50 },
  ],
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('CoachCard en séance', () => {
  it('nomme l’application et bloque un second geste pendant l’écriture', async () => {
    const pending = deferred();
    const onApply = vi.fn(() => pending.promise);
    const user = userEvent.setup();
    render(
      <CoachCard
        signal={objective}
        tone="objective"
        variant="strip"
        onApply={onApply}
        onDismiss={vi.fn()}
      />,
    );

    const apply = screen.getByRole('button', {
      name: t('coach.applyAction', { weight: '50' }),
    });
    expect(apply).toHaveTextContent('Appliquer 50 kg');
    expect(screen.getByRole('button', { name: 'Ignorer' })).toBeVisible();

    await user.click(apply);

    expect(onApply).toHaveBeenCalledOnce();
    expect(apply).toBeDisabled();

    pending.resolve();
    await waitFor(() => expect(apply).toBeEnabled());
  });

  it('présente une observation sans fausse action applicable', () => {
    render(
      <CoachCard
        signal={{
          code: 'long_rest',
          evidence: [{ label: 'max_rest_seconds', value: 240 }],
        }}
        variant="strip"
        onApply={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /Appliquer/u })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Masquer' })).toBeVisible();
  });
});
