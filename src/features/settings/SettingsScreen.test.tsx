import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { getBootStorage } from '@/app/bootEasterEgg';
import { setDefaultLoadStepKg } from '@/data/repositories/settings';
import { resetDb } from '@/test/resetDb';
import { rememberBackup } from '@/stores/backupMemory';
import { ANNOUNCER_STORAGE_KEY } from '@/stores/announcer';
import { THEME_STORAGE_KEY } from '@/stores/theme';
import { SettingsScreen } from './SettingsScreen';

const DAY = 86_400_000;

function renderSummary() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/settings/:page" element={<p>page ouverte</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const row = (name: RegExp) => screen.getByRole('button', { name });

describe('SettingsScreen — le sommaire', () => {
  beforeEach(async () => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    await resetDb();
  });

  it('rend ses cinq lignes, chacune avec son état', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    localStorage.setItem(ANNOUNCER_STORAGE_KEY, 'voice');
    await setDefaultLoadStepKg(1.125);
    renderSummary();

    expect(screen.getByRole('heading', { level: 1, name: 'Réglages' })).toBeVisible();
    expect(row(/^Apparence/)).toHaveTextContent('Clair');
    expect(row(/^Séance/)).toHaveTextContent('Sons + voix');
    await waitFor(() => expect(row(/^Coach/)).toHaveTextContent('1,125 kg'));
    expect(row(/^Sauvegarde/)).toHaveTextContent('Aucune sauvegarde sur cet appareil');
    expect(row(/^Application/)).toHaveTextContent('Hors-ligne en préparation');
  });

  it('dit « Selon le matériel » tant qu’aucun pas n’est posé', async () => {
    renderSummary();

    await waitFor(() => expect(row(/^Coach/)).toHaveTextContent('Selon le matériel'));
  });

  it('alerte, sans sauvegarde, dans un bandeau qui ouvre la page Sauvegarde', async () => {
    const user = userEvent.setup();
    renderSummary();

    const banner = screen.getByRole('button', {
      name: 'Aucune sauvegarde sur cet appareil',
    });
    expect(within(banner).getByText('Aucune sauvegarde sur cet appareil')).toBeVisible();
    await user.click(banner);
    expect(screen.getByText('page ouverte')).toBeVisible();
  });

  it('dit l’ancienneté de la dernière sauvegarde, dans le bandeau et sur la ligne', async () => {
    rememberBackup(getBootStorage(), Date.now() - 3 * DAY);
    renderSummary();

    expect(screen.getByText('Dernière sauvegarde : il y a 3 jours')).toBeVisible();
    expect(screen.getByText('Dernière : il y a 3 jours')).toBeVisible();
  });
});
