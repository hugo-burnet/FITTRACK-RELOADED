import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { getDefaultLoadStepKg, setDefaultLoadStepKg } from '@/data/repositories/settings';
import { resetDb } from '@/test/resetDb';
import { CoachSettings } from './CoachSettings';

function renderSettings() {
  return render(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<CoachSettings />} />
        <Route path="/settings/volume" element={<p>bornes de volume</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('CoachSettings', () => {
  beforeEach(resetDb);

  it('ouvre l’écran des bornes de volume depuis les Réglages', async () => {
    const user = userEvent.setup();
    renderSettings();

    expect(screen.getByRole('heading', { name: 'Coach' })).toBeInTheDocument();
    expect(screen.getByText('Plancher et plafond de séries par semaine')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Volume par muscle/ }));

    expect(await screen.findByText('bornes de volume')).toBeInTheDocument();
  });

  describe('le pas de charge par défaut', () => {
    it('dit qu’il suit le matériel tant qu’on n’en a pas posé', async () => {
      renderSettings();

      expect(await screen.findByText('Selon le matériel de chaque exercice')).toBeInTheDocument();
    });

    it('pose un pas décimal, qui s’écrit dans les réglages et se lit sous la ligne', async () => {
      const user = userEvent.setup();
      renderSettings();

      await user.click(await screen.findByRole('button', { name: /Pas de charge par défaut/ }));
      const sheet = await screen.findByRole('dialog', { name: 'Pas de charge par défaut' });
      await user.type(within(sheet).getByRole('textbox', { name: 'Pas en kilos' }), '1,125');
      await user.click(within(sheet).getByRole('button', { name: 'Enregistrer' }));

      await waitFor(async () => expect(await getDefaultLoadStepKg()).toBe(1.125));
      expect(
        await screen.findByText('1,125 kg quand la fiche d’un exercice n’a pas son propre pas'),
      ).toBeInTheDocument();
    });

    it('rouvre la feuille sur le pas posé, et « Selon le matériel » le retire', async () => {
      await setDefaultLoadStepKg(1.125);
      const user = userEvent.setup();
      renderSettings();

      await user.click(await screen.findByRole('button', { name: /Pas de charge par défaut/ }));
      const sheet = await screen.findByRole('dialog', { name: 'Pas de charge par défaut' });
      expect(within(sheet).getByRole('textbox', { name: 'Pas en kilos' })).toHaveValue('1,125');

      await user.click(within(sheet).getByRole('button', { name: 'Selon le matériel' }));
      expect(within(sheet).getByRole('textbox', { name: 'Pas en kilos' })).toHaveValue('');
      await user.click(within(sheet).getByRole('button', { name: 'Enregistrer' }));

      await waitFor(async () => expect(await getDefaultLoadStepKg()).toBeUndefined());
      expect(await screen.findByText('Selon le matériel de chaque exercice')).toBeInTheDocument();
    });

    it('refuse un pas nul ou trop grand, en disant pourquoi, sans rien écrire', async () => {
      await setDefaultLoadStepKg(2.5);
      const user = userEvent.setup();
      renderSettings();

      await user.click(await screen.findByRole('button', { name: /Pas de charge par défaut/ }));
      const sheet = await screen.findByRole('dialog', { name: 'Pas de charge par défaut' });
      const field = within(sheet).getByRole('textbox', { name: 'Pas en kilos' });
      const save = within(sheet).getByRole('button', { name: 'Enregistrer' });

      await user.clear(field);
      await user.type(field, '0');
      expect(within(sheet).getByText(/plus grand que zéro, et d’au plus 50/)).toBeInTheDocument();
      expect(save).toBeDisabled();

      await user.clear(field);
      await user.type(field, '51');
      expect(save).toBeDisabled();

      expect(await getDefaultLoadStepKg()).toBe(2.5);
    });
  });
});
