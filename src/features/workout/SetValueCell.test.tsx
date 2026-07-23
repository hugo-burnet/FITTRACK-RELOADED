import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SetValueCell } from './SetValueCell';

function Harness({ integer }: { integer?: boolean }) {
  const [value, setValue] = useState<number | undefined>(undefined);
  return (
    <>
      <SetValueCell
        value={value}
        ghost=""
        onChange={setValue}
        width="3.5rem"
        integer={integer}
        aria-label="Durée"
      />
      <output data-testid="value">{value === undefined ? 'vide' : value}</output>
    </>
  );
}

describe('SetValueCell', () => {
  it('sur une charge, garde la décimale — "102,5" pour une demi-plaque', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('Durée'), '102,5');
    expect(screen.getByLabelText('Durée')).toHaveValue('102,5');
    expect(screen.getByTestId('value')).toHaveTextContent('102.5');
  });

  it('sur une durée, refuse le séparateur — "1,3" ne stocke jamais 1,3 seconde', async () => {
    render(<Harness integer />);
    // Le 1:30 d'un gainage, tapé "1,3" sur le clavier d'une charge : la virgule
    // est refusée, on reste sur des secondes entières.
    await userEvent.type(screen.getByLabelText('Durée'), '1,3');
    expect(screen.getByLabelText('Durée')).toHaveValue('13');
    expect(screen.getByTestId('value')).toHaveTextContent('13');
  });

  it('sur une durée, prend les secondes entières telles quelles', async () => {
    render(<Harness integer />);
    await userEvent.type(screen.getByLabelText('Durée'), '90');
    expect(screen.getByLabelText('Durée')).toHaveValue('90');
    expect(screen.getByTestId('value')).toHaveTextContent('90');
  });
});
