import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PlateLoadSheet } from './PlateLoadSheet';

function AdjustableHarness() {
  const [barWeight, setBarWeight] = useState(20);

  return (
    <PlateLoadSheet
      open
      onClose={vi.fn()}
      loads={[100]}
      barWeight={barWeight}
      sides={2}
      barWeightAdjustable
      onBarWeightChange={setBarWeight}
    />
  );
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
      />,
    );

    expect(screen.queryByLabelText('Poids de la barre')).not.toBeInTheDocument();
    expect(screen.getByText('Charge à vide 0 kg')).toBeInTheDocument();
  });
});
