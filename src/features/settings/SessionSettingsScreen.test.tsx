import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '@/test/resetDb';
import { SessionSettingsScreen } from './SessionSettingsScreen';

function renderSettings() {
  render(
    <MemoryRouter>
      <SessionSettingsScreen />
    </MemoryRouter>,
  );
}

describe('SessionSettingsScreen — records personnels', () => {
  beforeEach(resetDb);

  it('garde les actions de dépannage hors des réglages ordinaires', async () => {
    renderSettings();

    expect(await screen.findByRole('heading', { name: 'Entraînement' })).toBeVisible();
    expect(await screen.findByRole('button', { name: /Estimation du 1RM.*Epley/ })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Recalculer tous les records/ })).toBeNull();
    expect(
      screen.queryByRole('button', { name: /Mettre à jour les anciennes séances/ }),
    ).toBeNull();
  });
});

describe('SessionSettingsScreen — ses quatre groupes', () => {
  beforeEach(async () => {
    localStorage.clear();
    await resetDb();
  });

  it('rend les annonces, l’effort, le 1RM et les notifications', async () => {
    renderSettings();

    expect(screen.getByRole('heading', { level: 1, name: 'Séance' })).toBeVisible();
    expect(screen.getByRole('radiogroup', { name: 'Annonces sonores' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Effort et fatigue' })).toBeVisible();
    expect(await screen.findByRole('button', { name: /Estimation du 1RM/ })).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'Notifications' })).toBeVisible();
  });

  it('range la règle de cadence derrière « En savoir plus »', async () => {
    const user = userEvent.setup();
    renderSettings();

    expect(screen.queryByText(/La cadence de série s’allonge/)).toBeNull();
    const toggles = screen.getAllByRole('button', { name: 'En savoir plus' });
    expect(toggles.length).toBeGreaterThanOrEqual(2);
    for (const toggle of toggles) await user.click(toggle);

    expect(screen.getByText(/La cadence de série s’allonge/)).toBeVisible();
    expect(screen.getByText(/Rien ne baisse le son de ta musique/)).toBeVisible();
  });
});
