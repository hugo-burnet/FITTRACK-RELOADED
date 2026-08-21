import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_PLATES_KG } from '@/lib/plates';
import { PlateLoadSheet } from './PlateLoadSheet';

type HarnessProps = {
  initialAvailablePlateWeightsKg?: readonly number[];
  onAvailablePlateWeightsChange?: (weights: number[]) => void | Promise<void>;
  open?: boolean;
};

function AdjustableHarness({
  initialAvailablePlateWeightsKg = DEFAULT_PLATES_KG,
  onAvailablePlateWeightsChange,
  open = true,
}: HarnessProps = {}) {
  const [barWeight, setBarWeight] = useState(20);
  const [availablePlateWeightsKg, setAvailablePlateWeightsKg] = useState<number[]>([
    ...initialAvailablePlateWeightsKg,
  ]);

  return (
    <PlateLoadSheet
      open={open}
      onClose={vi.fn()}
      loads={[100]}
      barWeight={barWeight}
      sides={2}
      loading="barbell"
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

  it('laisse le champ de la barre vide et garde la dernière barre valide', async () => {
    render(<AdjustableHarness />);

    await userEvent.clear(screen.getByLabelText('Poids de la barre'));

    expect(screen.getByLabelText('Poids de la barre')).toHaveValue('');
    // Le diagramme ne saute pas à la barre nue le temps de la ressaisie.
    expect(screen.getByText('25 · 15')).toBeInTheDocument();
  });

  it('ressaisit 22,5 sur un champ vidé sans zéro résiduel devant', async () => {
    render(<AdjustableHarness />);
    const field = screen.getByLabelText('Poids de la barre');

    await userEvent.clear(field);
    await userEvent.type(field, '22,5');

    expect(field).toHaveValue('22,5');
    expect(screen.getByText('25 · 10 · 2,5 · 1,25')).toBeInTheDocument();
  });

  it('rouvre la feuille sur la barre enregistrée après un champ laissé vide', async () => {
    const { rerender } = render(<AdjustableHarness />);

    await userEvent.clear(screen.getByLabelText('Poids de la barre'));
    rerender(<AdjustableHarness open={false} />);
    rerender(<AdjustableHarness open />);

    expect(screen.getByLabelText('Poids de la barre')).toHaveValue('20');
  });

  it('appelle « charge à vide » la base d’une machine à plaques, et la laisse corrigeable', () => {
    render(
      <PlateLoadSheet
        open
        onClose={vi.fn()}
        loads={[100]}
        barWeight={0}
        sides={2}
        loading="two_sided"
        onBarWeightChange={vi.fn()}
        availablePlateWeightsKg={DEFAULT_PLATES_KG}
        onAvailablePlateWeightsChange={vi.fn()}
      />,
    );

    expect(screen.queryByLabelText('Poids de la barre')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Charge à vide')).toHaveValue('0');
    expect(screen.getByText('De chaque côté')).toBeInTheDocument();
  });

  it('parle d’un seul côté quand le lest ne pend que d’un point', () => {
    render(
      <PlateLoadSheet
        open
        onClose={vi.fn()}
        loads={[25]}
        barWeight={0}
        sides={1}
        loading="single_sided"
        onBarWeightChange={vi.fn()}
        availablePlateWeightsKg={DEFAULT_PLATES_KG}
        onAvailablePlateWeightsChange={vi.fn()}
      />,
    );

    expect(screen.getByText('À charger')).toBeInTheDocument();
    expect(screen.queryByText('De chaque côté')).not.toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
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
