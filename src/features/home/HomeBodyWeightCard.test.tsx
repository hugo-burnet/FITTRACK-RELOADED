import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/data/db';
import * as bodyMeasurements from '@/data/repositories/bodyMeasurements';
import { resetDb } from '@/test/resetDb';
import { HomeBodyWeightCard } from './HomeBodyWeightCard';

describe('HomeBodyWeightCard', () => {
  beforeEach(resetDb);

  it('shows an empty French quick-entry state before the first measurement', async () => {
    render(<HomeBodyWeightCard />);

    expect(await screen.findByText('Poids du jour')).toBeInTheDocument();
    expect(screen.getByLabelText('Poids du corps')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
    expect(screen.getByText('Renseigne ton poids pour compter les exercices au poids du corps.'))
      .toBeInTheDocument();
  });

  it('prefills the latest value and date and disables an unchanged save', async () => {
    const measuredAt = Date.now();
    await bodyMeasurements.saveBodyWeight(82.4, measuredAt);

    render(<HomeBodyWeightCard />);

    await waitFor(() => expect(screen.getByLabelText('Poids du corps')).toHaveValue('82,4'));
    expect(screen.getByText(/Derni\u00e8re mesure :/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  });

  it('saves a first value and announces success', async () => {
    const user = userEvent.setup();
    render(<HomeBodyWeightCard />);

    const input = await screen.findByLabelText('Poids du corps');
    await user.type(input, '80,5');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() => expect(db.bodyMeasurements.count()).resolves.toBe(1));
    expect(await bodyMeasurements.getLatestBodyWeight()).toMatchObject({ valueKg: 80.5 });
    expect(screen.getByRole('status')).toHaveTextContent('Poids enregistr\u00e9.');
  });

  it('corrects the same-day value without adding a measurement', async () => {
    const user = userEvent.setup();
    await bodyMeasurements.saveBodyWeight(80, Date.now());
    render(<HomeBodyWeightCard />);

    const input = await screen.findByLabelText('Poids du corps');
    await waitFor(() => expect(input).toHaveValue('80'));
    await user.clear(input);
    await user.type(input, '79,6');
    await user.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Poids mis \u00e0 jour.'),
    );
    expect(await db.bodyMeasurements.count()).toBe(1);
    expect(await bodyMeasurements.getLatestBodyWeight()).toMatchObject({ valueKg: 79.6 });
  });

  it('allows the same value on a later day and creates a dated measurement', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await bodyMeasurements.saveBodyWeight(80, yesterday.getTime());
    const user = userEvent.setup();
    render(<HomeBodyWeightCard />);

    const input = await screen.findByLabelText('Poids du corps');
    await waitFor(() => expect(input).toHaveValue('80'));
    const action = screen.getByRole('button', { name: 'Enregistrer' });
    expect(action).toBeEnabled();
    await user.click(action);

    expect(await screen.findByRole('status')).toHaveTextContent('Poids enregistr\u00e9.');
    expect(await db.bodyMeasurements.count()).toBe(2);
  });

  it('keeps the edited value and allows retry after a rejected write', async () => {
    const user = userEvent.setup();
    const save = vi.spyOn(bodyMeasurements, 'saveBodyWeight').mockRejectedValueOnce(new Error('disk'));
    render(<HomeBodyWeightCard />);

    const input = await screen.findByLabelText('Poids du corps');
    await user.type(input, '81');
    const action = screen.getByRole('button', { name: 'Enregistrer' });
    await user.click(action);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le poids n\u2019a pas pu \u00eatre enregistr\u00e9. R\u00e9essaie.',
    );
    expect(input).toHaveValue('81');
    expect(action).toBeEnabled();

    save.mockRestore();
    await user.click(action);
    expect(await screen.findByRole('status')).toHaveTextContent('Poids enregistr\u00e9.');
  });
});
