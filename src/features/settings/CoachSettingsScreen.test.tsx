import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '@/test/resetDb';
import { CoachSettingsScreen } from './CoachSettingsScreen';

describe('CoachSettingsScreen', () => {
  beforeEach(resetDb);

  it('rend le pas de charge et le volume par muscle, et revient aux Réglages', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/settings/coach']}>
        <Routes>
          <Route path="/settings/coach" element={<CoachSettingsScreen />} />
          <Route path="/settings" element={<p>sommaire</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Coach' })).toBeVisible();
    expect(await screen.findByRole('button', { name: /^Pas de charge par défaut/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Volume par muscle/ })).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Retour' }));
    expect(screen.getByText('sommaire')).toBeVisible();
  });
});
