import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dayInputValue } from '@/lib/bodyMeasurements';
import { resetDb } from '@/test/resetDb';
import { MeasurementSheet, type MeasurementTarget } from './MeasurementSheet';

/** Une cible neuve à chaque appel : c'est ce que les écrans posent à chaque geste. */
const waist = (): MeasurementTarget => ({ kind: 'type', type: 'waist' });

/** Midi, `days` jours avant aujourd'hui, en jour local. */
const daysAgo = (days: number): number => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(12, 0, 0, 0);
  return date.getTime();
};

/**
 * `Sheet` garde son contenu monté 250 ms après la fermeture, le temps de sa sortie. Une feuille
 * rouverte dans ce délai — deux saisies enchaînées vite — ne repartait pas d'un brouillon vide :
 * elle retrouvait la date de la précédente, et une mesure tapée « pour aujourd'hui » remplaçait celle
 * d'il y a vingt jours (vu dans l'E2E des mensurations, quand le navigateur allait vite).
 */
describe('MeasurementSheet', () => {
  beforeEach(resetDb);

  async function saveFirstReading(onClose: () => void) {
    const user = userEvent.setup();
    const first = await screen.findByRole('dialog', { name: 'Nouvelle mesure' });
    await user.type(within(first).getByLabelText('Valeur'), '84');
    fireEvent.change(within(first).getByLabelText('Date'), {
      target: { value: dayInputValue(daysAgo(20)) },
    });
    await user.click(within(first).getByRole('button', { name: 'Enregistrer' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  }

  it('repart d’un brouillon vide à chaque ouverture, même rouverte avant la fin de la sortie', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<MeasurementSheet target={waist()} onClose={onClose} />);
    await saveFirstReading(onClose);

    // Fermée, puis rouverte aussitôt : les 250 ms de la sortie ne sont pas écoulées, le contenu est
    // encore monté.
    rerender(<MeasurementSheet target={undefined} onClose={onClose} />);
    rerender(<MeasurementSheet target={waist()} onClose={onClose} />);

    const second = await screen.findByRole('dialog', { name: 'Nouvelle mesure' });
    expect(within(second).getByLabelText('Date')).toHaveValue(dayInputValue(Date.now()));
    expect(within(second).getByLabelText('Valeur')).toHaveValue('');
    expect(within(second).getByRole('button', { name: 'Enregistrer' })).toBeDisabled();
  });

  it('garde son contenu pendant que la feuille redescend : il ne s’efface pas sous les yeux', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<MeasurementSheet target={waist()} onClose={onClose} />);
    await saveFirstReading(onClose);

    rerender(<MeasurementSheet target={undefined} onClose={onClose} />);

    // Fermée pour les lecteurs d'écran (`aria-hidden`), mais toujours à l'écran le temps de sa sortie :
    // `getByLabelText` ne regarde pas l'arbre d'accessibilité.
    expect(screen.queryByRole('dialog', { name: 'Nouvelle mesure' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Valeur')).toHaveValue('84');
  });
});
