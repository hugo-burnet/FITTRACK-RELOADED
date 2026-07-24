import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PLATES_KG } from '@/lib/plates';
import { PlateLoadSheet } from './PlateLoadSheet';

type HarnessProps = {
  initialAvailablePlateWeightsKg?: readonly number[];
  onAvailablePlateWeightsChange?: (weights: number[]) => void | Promise<void>;
};

function AdjustableHarness({
  initialAvailablePlateWeightsKg = DEFAULT_PLATES_KG,
  onAvailablePlateWeightsChange,
}: HarnessProps = {}) {
  const [barWeight, setBarWeight] = useState(20);
  const [availablePlateWeightsKg, setAvailablePlateWeightsKg] = useState<number[]>([
    ...initialAvailablePlateWeightsKg,
  ]);

  return (
    <PlateLoadSheet
      open
      onClose={vi.fn()}
      loads={[100]}
      barWeight={barWeight}
      sides={2}
      barWeightAdjustable
      onBarWeightChange={setBarWeight}
      availablePlateWeightsKg={availablePlateWeightsKg}
      onAvailablePlateWeightsChange={async (weights) => {
        await onAvailablePlateWeightsChange?.(weights);
        setAvailablePlateWeightsKg(weights);
      }}
    />
  );
}

async function expandAvailablePlates() {
  await userEvent.click(screen.getByText('Plaques disponibles'));
}

describe('PlateLoadSheet', () => {
  it('recalcule immédiatement les plaques quand la barre passe de 20 à 15 kg', async () => {
    render(<AdjustableHarness />);

    expect(screen.getByText('25 · 15')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Diminuer'));
    await userEvent.click(screen.getByLabelText('Diminuer'));

    expect(screen.getByLabelText('Poids de la barre')).toHaveValue('15');
    expect(screen.getByText('25 · 15 · 2,5')).toBeInTheDocument();
  });

  it('rend zéro visible au lieu de calculer silencieusement depuis un champ vide', async () => {
    render(<AdjustableHarness />);

    await userEvent.clear(screen.getByLabelText('Poids de la barre'));

    expect(screen.getByLabelText('Poids de la barre')).toHaveValue('0');
    expect(screen.getByText('2 × 25')).toBeInTheDocument();
  });

  it('ne présente pas de réglage de barre à une machine à plaques', () => {
    render(
      <PlateLoadSheet
        open
        onClose={vi.fn()}
        loads={[100]}
        barWeight={0}
        sides={2}
        barWeightAdjustable={false}
        onBarWeightChange={vi.fn()}
        availablePlateWeightsKg={DEFAULT_PLATES_KG}
        onAvailablePlateWeightsChange={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Poids de la barre')).not.toBeInTheDocument();
    expect(screen.getByText('Charge à vide 0 kg')).toBeInTheDocument();
  });

  it('sélectionne les dix dénominations par défaut', async () => {
    render(<AdjustableHarness />);

    await expandAvailablePlates();

    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(10);
    expect(screen.getByText('10 sur 10')).toBeInTheDocument();
  });

  it('désélectionne 25 kg et demande la sauvegarde des neuf autres poids', async () => {
    const onAvailablePlateWeightsChange = vi.fn<(weights: number[]) => Promise<void>>(
      async () => undefined,
    );
    render(<AdjustableHarness onAvailablePlateWeightsChange={onAvailablePlateWeightsChange} />);

    await expandAvailablePlates();
    await userEvent.click(screen.getByRole('button', { name: '25 kg' }));

    expect(onAvailablePlateWeightsChange).toHaveBeenCalledWith(
      DEFAULT_PLATES_KG.filter((weight) => weight !== 25),
    );
    expect(screen.getByRole('button', { name: '25 kg' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('2 × 20')).toBeInTheDocument();
  });

  it('resélectionne 25 kg et retrouve 25 · 15 par côté', async () => {
    render(
      <AdjustableHarness
        initialAvailablePlateWeightsKg={DEFAULT_PLATES_KG.filter((weight) => weight !== 25)}
      />,
    );
    expect(screen.getByText('2 × 20')).toBeInTheDocument();

    await expandAvailablePlates();
    await userEvent.click(screen.getByRole('button', { name: '25 kg' }));

    expect(screen.getByRole('button', { name: '25 kg' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('25 · 15')).toBeInTheDocument();
  });

  it('accepte un inventaire vide et affiche le poids manquant', async () => {
    render(<AdjustableHarness initialAvailablePlateWeightsKg={[]} />);

    expect(screen.getByText('Barre nue, aucune plaque à ajouter.')).toBeInTheDocument();
    expect(screen.getByText('Il manque 80 kg pour la charge exacte.')).toBeInTheDocument();
    expect(
      screen.getByText('De chaque côté : Barre nue, aucune plaque à ajouter.'),
    ).toBeInTheDocument();

    await expandAvailablePlates();
    expect(screen.getByText('Aucune plaque sélectionnée.')).toBeInTheDocument();
    expect(screen.getByText('0 sur 10')).toBeInTheDocument();
  });

  it('garde la sélection persistée et affiche une erreur si la sauvegarde échoue', async () => {
    render(
      <AdjustableHarness
        onAvailablePlateWeightsChange={() => Promise.reject(new Error('IndexedDB indisponible'))}
      />,
    );

    await expandAvailablePlates();
    await userEvent.click(screen.getByRole('button', { name: '25 kg' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible d’enregistrer les plaques disponibles.',
    );
    expect(screen.getByRole('button', { name: '25 kg' })).toHaveAttribute('aria-pressed', 'true');
  });
});
