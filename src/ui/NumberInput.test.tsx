import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { NumberInput } from './NumberInput';

function Harness({ initial }: { initial?: number }) {
  const [value, setValue] = useState<number | undefined>(initial);
  return (
    <>
      <NumberInput value={value} onChange={setValue} step={2.5} min={0} aria-label="Poids" />
      <output data-testid="value">{value === undefined ? 'vide' : value}</output>
    </>
  );
}

describe('NumberInput', () => {
  it('accepte la virgule comme séparateur décimal', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('Poids'), '102,5');
    expect(screen.getByLabelText('Poids')).toHaveValue('102,5'); // la virgule reste affichée
    expect(screen.getByTestId('value')).toHaveTextContent('102.5'); // et vaut bien 102,5
  });

  it('accepte aussi le point', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('Poids'), '102.5');
    expect(screen.getByTestId('value')).toHaveTextContent('102.5');
  });

  it('refuse les caractères non numériques', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('Poids'), '10a0');
    expect(screen.getByLabelText('Poids')).toHaveValue('100');
  });

  it('incrémente du pas fourni', async () => {
    render(<Harness initial={100} />);
    await userEvent.click(screen.getByLabelText('Augmenter'));
    expect(screen.getByTestId('value')).toHaveTextContent('102.5'); // la valeur reste un nombre
    expect(screen.getByLabelText('Poids')).toHaveValue('102,5'); // mais s’affiche en français
  });

  it('ne réécrit pas le point que tu viens de taper', async () => {
    render(<Harness />);
    await userEvent.type(screen.getByLabelText('Poids'), '102.5');
    expect(screen.getByLabelText('Poids')).toHaveValue('102.5');
  });

  it('ne descend pas sous le minimum', async () => {
    render(<Harness initial={0} />);
    await userEvent.click(screen.getByLabelText('Diminuer'));
    expect(screen.getByTestId('value')).toHaveTextContent('0');
  });

  it('se vide proprement', async () => {
    render(<Harness initial={100} />);
    await userEvent.clear(screen.getByLabelText('Poids'));
    expect(screen.getByTestId('value')).toHaveTextContent('vide');
  });

  it('sur un champ entier, refuse le séparateur décimal', async () => {
    function IntHarness() {
      const [value, setValue] = useState<number | undefined>(undefined);
      return (
        <>
          <NumberInput value={value} onChange={setValue} integer step={15} aria-label="Durée" />
          <output data-testid="int">{value === undefined ? 'vide' : value}</output>
        </>
      );
    }
    render(<IntHarness />);
    // « 1,3 » pour dire « 1:30 » : la virgule est refusée d'entrée, donc pas de
    // 1,3 s stocké — c'est tout l'intérêt du champ entier sur une durée.
    await userEvent.type(screen.getByLabelText('Durée'), '1,3');
    expect(screen.getByLabelText('Durée')).toHaveValue('13');
    expect(screen.getByTestId('int')).toHaveTextContent('13');
  });
});
