import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorkoutRpeField } from './WorkoutRpeField';

describe('WorkoutRpeField', () => {
  it('garde l’échelle masquée jusqu’à la demande', async () => {
    const user = userEvent.setup();
    render(<WorkoutRpeField value={undefined} onChange={vi.fn()} />);

    expect(screen.getByText('Non renseigné')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'RPE 8,5 sur 10' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Effort perçu (RPE)' }));

    expect(screen.getByRole('button', { name: 'RPE 8,5 sur 10' })).toBeInTheDocument();
  });

  it('annonce la valeur courante avec la divulgation', () => {
    render(<WorkoutRpeField value={8.5} onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Effort perçu (RPE)' })).toHaveAccessibleDescription(
      '8,5 / 10',
    );
  });

  it('transmet le RPE choisi', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<WorkoutRpeField value={undefined} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: 'Effort perçu (RPE)' }));
    await user.click(screen.getByRole('button', { name: 'RPE 8,5 sur 10' }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(8.5);
  });

  it('permet d’effacer un RPE renseigné', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<WorkoutRpeField value={8.5} onChange={onChange} />);

    expect(screen.getByText('8,5 / 10')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Effort perçu (RPE)' }));
    await user.click(screen.getByRole('button', { name: 'Effacer le RPE' }));

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
