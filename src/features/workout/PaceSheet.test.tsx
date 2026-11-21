import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n/fr';
import { PaceSheet, type PaceSheetView } from './PaceSheet';

const view: PaceSheetView = {
  kind: 'reps',
  rowId: 'row-1',
  name: 'Développé couché',
  repSeconds: 3,
  defaultRepSeconds: 3,
  reps: 8,
  canStart: true,
  running: false,
};

describe('PaceSheet', () => {
  // La vue reste figée à 3 s : c'est la requête vive qui n'a pas encore relu la
  // ligne que « 5 » vient d'écrire. Le test ne dépend donc d'aucune horloge.
  it('lance au tempo affiché par la feuille, pas à celui de la dernière lecture', async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(
      <PaceSheet
        open
        onClose={() => undefined}
        view={view}
        onChange={() => undefined}
        onSetDefault={() => undefined}
        onStart={onStart}
        onStop={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: '5', pressed: false }));
    await user.click(screen.getByRole('button', { name: t('workout.pace') }));

    expect(onStart).toHaveBeenCalledWith(5);
  });
});
