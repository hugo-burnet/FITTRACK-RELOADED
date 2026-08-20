import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const recordsRepository = vi.hoisted(() => ({ rebuild: vi.fn(), current: vi.fn() }));

vi.mock('@/data/repositories/personalRecords', () => ({
  rebuildAllRecords: recordsRepository.rebuild,
  isRecordProjectionCurrent: recordsRepository.current,
}));

import { RecordRepairAction } from './RecordRepairAction';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('RecordRepairAction', () => {
  beforeEach(() => {
    recordsRepository.rebuild.mockReset();
    recordsRepository.current.mockReset().mockResolvedValue(true);
  });

  it('confirms, shows progress, then reports created, updated, and deleted records', async () => {
    const rebuild = deferred<{
      created: number;
      updated: number;
      deleted: number;
      unchanged: number;
    }>();
    recordsRepository.rebuild.mockReturnValueOnce(rebuild.promise);
    render(<RecordRepairAction />);

    await userEvent.click(screen.getByRole('button', { name: 'Recalculer tous les records' }));
    expect(screen.getByRole('heading', { name: 'Recalculer tous les records' })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Lancer le recalcul' }));

    expect(screen.getByRole('button', { name: 'Recalcul en cours…' })).toBeDisabled();
    rebuild.resolve({ created: 2, updated: 3, deleted: 1, unchanged: 4 });

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Recalcul terminé : ajouts : 2 · corrections : 3 · anciens jalons retirés : 1.',
    );
  });

  it('explains a failure and leaves the repair action retryable', async () => {
    recordsRepository.rebuild.mockRejectedValueOnce(new Error('rebuild failed'));
    render(<RecordRepairAction />);

    await userEvent.click(screen.getByRole('button', { name: 'Recalculer tous les records' }));
    await userEvent.click(screen.getByRole('button', { name: 'Lancer le recalcul' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Les records n’ont pas pu être recalculés. Tu peux réessayer.',
    );
    expect(screen.getByRole('button', { name: 'Recalculer tous les records' })).toBeEnabled();

    await userEvent.click(screen.getByRole('button', { name: 'Recalculer tous les records' }));
    expect(recordsRepository.rebuild).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Recalculer tous les records' })).toBeVisible();
  });
});
