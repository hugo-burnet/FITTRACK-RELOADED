import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { getCoachVolumeBounds, setCoachVolumeBounds } from '@/data/repositories/settings';
import { resetDb } from '@/test/resetDb';
import { seedMuscleWeeks } from '@/test/volumeHistory';
import { VolumeScreen } from './VolumeScreen';

function renderScreen() {
  return render(
    <MemoryRouter>
      <VolumeScreen />
    </MemoryRouter>,
  );
}

/** La ligne d'un muscle, retrouvée par son nom. */
const row = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

describe('VolumeScreen', () => {
  beforeEach(resetDb);

  it('liste les seize régions du corps, un muscle jamais travaillé compris', async () => {
    renderScreen();

    expect(await screen.findByRole('button', { name: /^Pectoraux/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button').filter((button) => button.dataset.part === 'row')).toHaveLength(16);
    expect(screen.queryByText('Cardio')).not.toBeInTheDocument();
    expect(within(row('Pectoraux')).getByText(/pas travaillé ces six semaines/)).toBeInTheDocument();
    expect(screen.getAllByText('Plancher —')).toHaveLength(16);
  });

  it('dit que les règles sont celles de l’app, que le coach lit le volume direct et qu’on peut les corriger', async () => {
    renderScreen();

    expect(await screen.findByText(/le muscle principal de l’exercice compte pour une série/)).toBeInTheDocument();
    expect(screen.getByText(/C’est une règle de l’app/)).toBeInTheDocument();
  });

  it('montre la semaine, la médiane et le maximum d’un muscle travaillé, et son plafond tiré de l’historique', async () => {
    await seedMuscleWeeks('chest', [0, 8, 9, 0, 10, 8]);
    renderScreen();

    const chest = await screen.findByRole('button', { name: /^Pectoraux/ });
    await waitFor(() => expect(within(chest).getByText(/médiane 8,5 · max 10/)).toBeInTheDocument());
    expect(within(chest).getByText('Plafond 10 (auto)')).toBeInTheDocument();
    expect(within(chest).getByText('Plancher —')).toBeInTheDocument();
  });

  it('ne présente ni médiane ni plafond sous trois semaines travaillées', async () => {
    await seedMuscleWeeks('chest', [0, 0, 0, 0, 9, 10]);
    renderScreen();

    const chest = await screen.findByRole('button', { name: /^Pectoraux/ });
    await waitFor(() => expect(within(chest).getByText(/travaillé 2 semaines sur 6/)).toBeInTheDocument());
    expect(within(chest).queryByText(/médiane/)).not.toBeInTheDocument();
    expect(within(chest).getByText('Plafond —')).toBeInTheDocument();
  });

  it('pose un plancher et un plafond, et la ligne les montre aussitôt', async () => {
    const user = userEvent.setup();
    await seedMuscleWeeks('hamstrings', [6, 6, 6, 6, 6, 6]);
    renderScreen();
    await user.click(await screen.findByRole('button', { name: /^Ischio-jambiers/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Ischio-jambiers' });

    await user.type(within(sheet).getByRole('textbox', { name: 'Plancher' }), '8');
    await user.type(within(sheet).getByRole('textbox', { name: 'Plafond' }), '14');
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer' }));

    await waitFor(async () =>
      expect(await getCoachVolumeBounds()).toEqual({ hamstrings: { floor: 8, ceiling: 14 } }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Ischio-jambiers' })).not.toBeInTheDocument());
    const line = await screen.findByRole('button', { name: /^Ischio-jambiers/ });
    await waitFor(() => expect(within(line).getByText('Plancher 8')).toBeInTheDocument());
    expect(within(line).getByText('Plafond 14')).toBeInTheDocument();
  });

  it('rend les bornes posées à l’ouverture, et « Aucun plancher » les retire', async () => {
    const user = userEvent.setup();
    await setCoachVolumeBounds('lats', { floor: 6, ceiling: 12 });
    renderScreen();
    await user.click(await screen.findByRole('button', { name: /^Grand dorsal/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Grand dorsal' });

    expect(within(sheet).getByRole('textbox', { name: 'Plancher' })).toHaveValue('6');
    expect(within(sheet).getByRole('textbox', { name: 'Plafond' })).toHaveValue('12');

    await user.click(within(sheet).getByRole('button', { name: 'Aucun plancher' }));
    expect(within(sheet).getByRole('textbox', { name: 'Plancher' })).toHaveValue('');
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer' }));

    await waitFor(async () => expect(await getCoachVolumeBounds()).toEqual({ lats: { ceiling: 12 } }));
  });

  it('rend le plafond à l’automatique, avec le chiffre que l’historique donnerait', async () => {
    const user = userEvent.setup();
    await seedMuscleWeeks('chest', [8, 9, 10, 8, 9, 8]);
    await setCoachVolumeBounds('chest', { ceiling: 14 });
    renderScreen();
    await user.click(await screen.findByRole('button', { name: /^Pectoraux/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Pectoraux' });

    // Le chiffre de l'historique reste affiché sur le bouton même quand un plafond est posé.
    const auto = within(sheet).getByRole('button', { name: 'Plafond automatique (10)' });
    expect(auto).toHaveAttribute('aria-pressed', 'false');
    await user.click(auto);
    await user.click(within(sheet).getByRole('button', { name: 'Enregistrer' }));

    await waitFor(async () => expect(await getCoachVolumeBounds()).toEqual({}));
  });

  it('dit « pas assez d’historique » quand il n’y a pas de plafond automatique à rendre', async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(await screen.findByRole('button', { name: /^Pectoraux/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Pectoraux' });

    expect(within(sheet).getByRole('button', { name: /Plafond automatique \(pas assez d’historique\)/ })).toBeInTheDocument();
    expect(within(sheet).getByText(/Pas encore d’historique de ce muscle/)).toBeInTheDocument();
  });

  it('refuse un plancher au-dessus du plafond, avec la raison, sans rien écrire', async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(await screen.findByRole('button', { name: /^Pectoraux/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Pectoraux' });

    await user.type(within(sheet).getByRole('textbox', { name: 'Plancher' }), '12');
    await user.type(within(sheet).getByRole('textbox', { name: 'Plafond' }), '8');

    expect(within(sheet).getByText('Le plancher ne peut pas dépasser le plafond.')).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
    expect(await getCoachVolumeBounds()).toEqual({});
  });

  it('refuse un nombre de séries qui n’en est pas un : la virgule n’est pas offerte', async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(await screen.findByRole('button', { name: /^Pectoraux/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Pectoraux' });

    const floor = within(sheet).getByRole('textbox', { name: 'Plancher' });
    await user.type(floor, '8,5');

    expect(floor).toHaveValue('85');
  });
});
