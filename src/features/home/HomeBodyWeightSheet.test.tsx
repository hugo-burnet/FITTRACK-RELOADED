import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import * as bodyMeasurements from '@/data/repositories/bodyMeasurements';
import { resetDb } from '@/test/resetDb';
import { HomeBodyWeightSheet } from './HomeBodyWeightSheet';

/** Ouverte d'emblée : la tuile qui l'ouvre est testée avec l'îlot. */
function renderSheet(onClose = vi.fn()) {
  render(<HomeBodyWeightSheet open onClose={onClose} />);
  return { onClose, input: screen.findByLabelText('Poids du corps') };
}

describe('HomeBodyWeightSheet', () => {
  beforeEach(resetDb);
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('opens empty before the first measurement, with the save refused', async () => {
    const { input } = renderSheet();

    expect(await input).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
    expect(
      screen.getByText('Renseigne ton poids pour compter les exercices au poids du corps.'),
    ).toBeInTheDocument();
  });

  it('saves a first value and closes on success', async () => {
    const user = userEvent.setup();
    const { onClose, input } = renderSheet();

    await user.type(await input, '80,5');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(db.bodyMeasurements.count()).resolves.toBe(1));
    expect(await bodyMeasurements.getLatestBodyWeight()).toMatchObject({ valueKg: 80.5 });
    expect(onClose).toHaveBeenCalled();
  });

  it('prefills the latest value and date and refuses an unchanged save', async () => {
    await bodyMeasurements.saveBodyWeight(82.4, Date.now());
    const { input } = renderSheet();

    await waitFor(async () => expect(await input).toHaveValue('82,4'));
    expect(screen.getByText(/Dernière mesure :/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  });

  it('corrects the same-day value without adding a measurement', async () => {
    const user = userEvent.setup();
    await bodyMeasurements.saveBodyWeight(80, Date.now());
    const { input } = renderSheet();
    const field = await input;

    await waitFor(() => expect(field).toHaveValue('80'));
    await user.clear(field);
    await user.type(field, '79,6');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() =>
      expect(bodyMeasurements.getLatestBodyWeight()).resolves.toMatchObject({ valueKg: 79.6 }),
    );
    expect(await db.bodyMeasurements.count()).toBe(1);
  });

  it('allows the same value on a later day and creates a dated measurement', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await bodyMeasurements.saveBodyWeight(80, yesterday.getTime());
    const user = userEvent.setup();
    const { input } = renderSheet();
    const field = await input;

    await waitFor(() => expect(field).toHaveValue('80'));
    const action = screen.getByRole('button', { name: 'Enregistrer' });
    expect(action).toBeEnabled();
    await user.click(action);

    await waitFor(() => expect(db.bodyMeasurements.count()).resolves.toBe(2));
  });

  it('re-enables the same value when local midnight passes while mounted', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
    const clearTimeout = vi.spyOn(window, 'clearTimeout');
    const beforeMidnight = new Date(2026, 7, 11, 23, 59, 59, 900);
    vi.setSystemTime(beforeMidnight);
    await bodyMeasurements.saveBodyWeight(80, beforeMidnight.getTime());
    const { unmount } = render(<HomeBodyWeightSheet open onClose={vi.fn()} />);

    await vi.waitFor(() => expect(screen.getByLabelText('Poids du corps')).toHaveValue('80'));
    const action = screen.getByRole('button', { name: 'Enregistrer' });
    expect(action).toBeDisabled();

    await act(async () => vi.advanceTimersByTimeAsync(100));

    expect(action).toBeEnabled();
    const cleanupCallsBeforeUnmount = clearTimeout.mock.calls.length;
    unmount();
    expect(clearTimeout.mock.calls.length).toBeGreaterThan(cleanupCallsBeforeUnmount);
    clearTimeout.mockRestore();
  });

  it('accepts a value above the NumberInput 9999 ceiling', async () => {
    const user = userEvent.setup();
    const { input } = renderSheet();

    await user.type(await input, '10000');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() =>
      expect(bodyMeasurements.getLatestBodyWeight()).resolves.toMatchObject({ valueKg: 10000 }),
    );
  });

  it('stays open with the typed value and allows retry after a rejected write', async () => {
    const user = userEvent.setup();
    const save = vi
      .spyOn(bodyMeasurements, 'saveBodyWeight')
      .mockRejectedValueOnce(new Error('disk'));
    const { onClose, input } = renderSheet();
    const field = await input;

    await user.type(field, '81');
    const action = screen.getByRole('button', { name: 'Enregistrer' });
    await user.click(action);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le poids n’a pas pu être enregistré. Réessaie.',
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(field).toHaveValue('81');
    expect(action).toBeEnabled();

    save.mockRestore();
    await user.click(action);
    await waitFor(() => expect(db.bodyMeasurements.count()).resolves.toBe(1));
  });

  it('forgets an abandoned draft the next time it opens', async () => {
    const user = userEvent.setup();
    await bodyMeasurements.saveBodyWeight(80, Date.now());
    const { rerender } = render(<HomeBodyWeightSheet open onClose={vi.fn()} />);

    const field = await screen.findByLabelText('Poids du corps');
    await waitFor(() => expect(field).toHaveValue('80'));
    await user.clear(field);
    await user.type(field, '95');

    rerender(<HomeBodyWeightSheet open={false} onClose={vi.fn()} />);
    rerender(<HomeBodyWeightSheet open onClose={vi.fn()} />);

    expect(screen.getByLabelText('Poids du corps')).toHaveValue('80');
  });
});
