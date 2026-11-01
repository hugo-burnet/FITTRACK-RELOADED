import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n/fr';
import { RestShift } from './RestShift';

describe('RestShift', () => {
  it('takes fifteen seconds off, or adds them, in one tap each', async () => {
    const onShift = vi.fn();
    render(<RestShift onShift={onShift} />);

    await userEvent.click(screen.getByRole('button', { name: t('workout.restShorten') }));
    await userEvent.click(screen.getByRole('button', { name: t('workout.restLengthen') }));

    expect(onShift.mock.calls).toEqual([[-15], [15]]);
  });

  it('shows the amounts, not only an icon', () => {
    render(<RestShift onShift={vi.fn()} />);

    expect(screen.getByText(t('workout.restMinus'))).toBeInTheDocument();
    expect(screen.getByText(t('workout.restPlus'))).toBeInTheDocument();
  });
});
