import { StrictMode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const formulaRepository = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock('@/data/repositories/settings', () => ({
  getOneRepMaxFormula: formulaRepository.get,
  setOneRepMaxFormula: formulaRepository.set,
}));

import { OneRepMaxSettings } from './OneRepMaxSettings';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('OneRepMaxSettings', () => {
  beforeEach(() => {
    formulaRepository.get.mockReset().mockResolvedValue('epley');
    formulaRepository.set.mockReset().mockResolvedValue(undefined);
  });

  it('selects Brzycki and updates the computed 100 kg × 5 example', async () => {
    render(<OneRepMaxSettings />);

    const selector = await screen.findByRole('button', {
      name: /Estimation du 1RM.*Epley.*116,7 kg/,
    });
    await userEvent.click(selector);

    expect(screen.getByRole('radio', { name: /Brzycki.*100 kg × 5.*112,5 kg/ })).toBeVisible();
    await userEvent.click(screen.getByRole('radio', { name: /Brzycki/ }));

    await waitFor(() => expect(formulaRepository.set).toHaveBeenCalledWith('brzycki'));
    expect(
      await screen.findByRole('button', { name: /Estimation du 1RM.*Brzycki.*112,5 kg/ }),
    ).toBeVisible();
  });

  it('keeps Epley selected and explains a failed save', async () => {
    formulaRepository.set.mockRejectedValueOnce(new Error('write failed'));
    render(<OneRepMaxSettings />);

    await userEvent.click(await screen.findByRole('button', { name: /Estimation du 1RM.*Epley/ }));
    await userEvent.click(screen.getByRole('radio', { name: /Brzycki/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'La formule n’a pas pu être enregistrée. La formule précédente reste utilisée.',
    );
    await userEvent.click(screen.getByRole('button', { name: /Estimation du 1RM.*Epley/ }));
    expect(screen.getByRole('radio', { name: /Epley/ })).toBeChecked();
  });

  it('ignores the obsolete first load when StrictMode remounts the effect', async () => {
    const firstLoad = deferred<'epley'>();
    const currentLoad = deferred<'brzycki'>();
    formulaRepository.get
      .mockReset()
      .mockReturnValueOnce(firstLoad.promise)
      .mockReturnValueOnce(currentLoad.promise);

    render(
      <StrictMode>
        <OneRepMaxSettings />
      </StrictMode>,
    );
    await waitFor(() => expect(formulaRepository.get).toHaveBeenCalledTimes(2));

    await act(async () => currentLoad.resolve('brzycki'));
    expect(await screen.findByRole('button', { name: /Estimation du 1RM.*Brzycki/ })).toBeVisible();

    await act(async () => firstLoad.resolve('epley'));
    expect(screen.getByRole('button', { name: /Estimation du 1RM.*Brzycki/ })).toBeVisible();
  });
});
