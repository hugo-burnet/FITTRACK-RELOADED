import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { getNotificationPreferences } from '@/data/repositories/notificationSettings';
import { resetDb } from '@/test/resetDb';
import { NotificationSettings } from './NotificationSettings';

describe('NotificationSettings', () => {
  beforeEach(resetDb);

  it('opens with the rest bell and the records on, the reminder off', async () => {
    render(<NotificationSettings />);

    expect(await screen.findByRole('switch', { name: 'Fin de repos' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Records battus' })).toBeChecked();
    expect(screen.getByRole('switch', { name: 'Rappels d’entraînement' })).not.toBeChecked();
    expect(screen.queryByRole('group', { name: 'Jours de rappel' })).toBeNull();
  });

  it('saves one switch without disturbing the others', async () => {
    render(<NotificationSettings />);

    await userEvent.click(await screen.findByRole('switch', { name: 'Records battus' }));

    await waitFor(async () => {
      const stored = await getNotificationPreferences();
      expect(stored.records).toBe(false);
      expect(stored.rest).toBe(true);
    });
    // L'interrupteur suit la base, pas l'inverse : la requête vive repasse par
    // Dexie, donc l'écran rattrape l'écriture un battement plus tard.
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Records battus' })).not.toBeChecked(),
    );
  });

  it('shows the week and the hour once the reminder is on, and dates the next one', async () => {
    render(<NotificationSettings />);

    await userEvent.click(await screen.findByRole('switch', { name: 'Rappels d’entraînement' }));

    const week = await screen.findByRole('group', { name: 'Jours de rappel' });
    expect(week).toBeVisible();
    expect(screen.getByRole('checkbox', { name: 'lundi' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'mardi' })).not.toBeChecked();
    expect(screen.getByLabelText('Heure du rappel')).toHaveValue('18:00');
    expect(screen.getByText(/Prochain rappel :/)).toBeVisible();
  });

  it('says plainly that an empty week rings nothing', async () => {
    render(<NotificationSettings />);

    await userEvent.click(await screen.findByRole('switch', { name: 'Rappels d’entraînement' }));
    for (const day of ['lundi', 'mercredi', 'vendredi']) {
      await userEvent.click(await screen.findByRole('checkbox', { name: day, checked: true }));
    }

    expect(
      await screen.findByText(
        'Aucun jour coché : rien ne sonnera tant qu’il en manque un.',
      ),
    ).toBeVisible();
    expect((await getNotificationPreferences()).schedule.days).toEqual([]);
  });

  it('writes the hour picked in the clock field', async () => {
    render(<NotificationSettings />);

    await userEvent.click(await screen.findByRole('switch', { name: 'Rappels d’entraînement' }));
    // Ce que le sélecteur d'heure d'Android renvoie : une valeur complète, en
    // une fois. Taper chiffre par chiffre est un geste de clavier de bureau.
    fireEvent.change(await screen.findByLabelText('Heure du rappel'), {
      target: { value: '07:15' },
    });

    await waitFor(async () =>
      expect((await getNotificationPreferences()).schedule.minutes).toBe(7 * 60 + 15),
    );
  });
});
