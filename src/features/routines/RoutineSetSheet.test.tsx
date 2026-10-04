import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { RoutineSet } from '@/data/types';
import { RoutineSetSheet } from './RoutineSetSheet';

const aSet = (values: Partial<RoutineSet> = {}): RoutineSet => ({
  id: 'set-1',
  createdAt: 0,
  updatedAt: 0,
  deletedAt: 0,
  routineExerciseId: 'row-1',
  order: 0,
  setType: 'normal',
  targetWeight: 100,
  targetReps: 8,
  ...values,
});

function renderSheet(set: RoutineSet, onApplyToAll = vi.fn()) {
  render(
    <RoutineSetSheet
      open
      onClose={vi.fn()}
      set={set}
      measurementType="weight_reps"
      number={1}
      onSave={vi.fn()}
      onApplyToAll={onApplyToAll}
      onDelete={vi.fn()}
    />,
  );
  return onApplyToAll;
}

/**
 * « Appliquer à toutes les séries » applique les chiffres aux séries **du même
 * genre** que celle qu'on ouvre : le dépôt choisit ses cibles d'après le type que
 * la feuille envoie avec eux. Le bouton doit donc le dire, et le type doit partir.
 */
describe('RoutineSetSheet — appliquer aux autres séries', () => {
  it('s’appelle « à toutes les séries » sur une série de travail', () => {
    renderSheet(aSet({ setType: 'normal' }));

    expect(screen.getByRole('button', { name: 'Appliquer à toutes les séries' })).toBeVisible();
  });

  it('s’appelle « aux échauffements » sur un échauffement', () => {
    renderSheet(aSet({ setType: 'warmup', targetWeight: 40, targetReps: 5 }));

    expect(
      screen.getByRole('button', { name: 'Appliquer aux échauffements' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Appliquer à toutes les séries' }),
    ).not.toBeInTheDocument();
  });

  it('envoie le type de la série ouverte avec ses chiffres', async () => {
    const onApplyToAll = renderSheet(aSet({ setType: 'warmup', targetWeight: 40, targetReps: 5 }));

    await userEvent.click(screen.getByRole('button', { name: 'Appliquer aux échauffements' }));

    expect(onApplyToAll).toHaveBeenCalledWith(
      expect.objectContaining({ setType: 'warmup', targetWeight: 40, targetReps: 5 }),
    );
  });

  it('suit le type quand on le change dans la feuille', async () => {
    const onApplyToAll = renderSheet(aSet({ setType: 'normal' }));

    await userEvent.click(screen.getByRole('radio', { name: 'Échauffement' }));

    const button = screen.getByRole('button', { name: 'Appliquer aux échauffements' });
    await userEvent.click(button);
    expect(onApplyToAll).toHaveBeenCalledWith(expect.objectContaining({ setType: 'warmup' }));
  });
});
