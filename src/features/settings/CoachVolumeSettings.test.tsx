import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CoachVolumeSettings } from './CoachVolumeSettings';

describe('CoachVolumeSettings', () => {
  it('ouvre l’écran des bornes de volume depuis les Réglages', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<CoachVolumeSettings />} />
          <Route path="/settings/volume" element={<p>bornes de volume</p>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Coach' })).toBeInTheDocument();
    expect(screen.getByText('Plancher et plafond de séries par semaine')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Volume par muscle/ }));

    expect(await screen.findByText('bornes de volume')).toBeInTheDocument();
  });
});
