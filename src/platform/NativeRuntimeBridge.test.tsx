import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NativeRuntimeBridge } from './NativeRuntimeBridge';

const state = vi.hoisted(() => ({
  active: { name: 'Lower A' } as { name: string } | null,
  rest: { setId: 'set-1', startedAt: 1_000, endsAt: 91_000, seconds: 90 },
  appStateListener: undefined as ((state: { isActive: boolean }) => void) | undefined,
  remove: vi.fn().mockResolvedValue(undefined),
  getActiveWorkout: vi.fn(),
  reconcileWorkout: vi.fn().mockResolvedValue(undefined),
  reconcileRest: vi.fn().mockResolvedValue(undefined),
  clearAll: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => state.active,
}));

vi.mock('@/data/repositories/workouts', () => ({
  getActiveWorkout: state.getActiveWorkout,
}));

vi.mock('@/stores/restTimer', () => ({
  useRestTimer: () => state.rest,
}));

vi.mock('./nativeNotifications', () => ({
  nativeNotifications: {
    reconcileWorkout: state.reconcileWorkout,
    reconcileRest: state.reconcileRest,
    clearAll: state.clearAll,
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn((event: string, listener: (state: { isActive: boolean }) => void) => {
      if (event === 'appStateChange') state.appStateListener = listener;
      return Promise.resolve({ remove: state.remove });
    }),
  },
}));

describe('NativeRuntimeBridge', () => {
  beforeEach(() => {
    state.active = { name: 'Lower A' };
    state.rest = { setId: 'set-1', startedAt: 1_000, endsAt: 91_000, seconds: 90 };
    state.appStateListener = undefined;
    vi.clearAllMocks();
  });

  it('reconciles the active workout name', async () => {
    render(<NativeRuntimeBridge />);

    await waitFor(() => expect(state.reconcileWorkout).toHaveBeenCalledWith('Lower A'));
  });

  it('reconciles the full rest timer state', async () => {
    render(<NativeRuntimeBridge />);

    await waitFor(() => expect(state.reconcileRest).toHaveBeenCalledWith(state.rest));
  });

  it('clears notifications when the workout ends', async () => {
    const view = render(<NativeRuntimeBridge />);
    await waitFor(() => expect(state.reconcileWorkout).toHaveBeenCalledWith('Lower A'));

    state.active = null;
    view.rerender(<NativeRuntimeBridge />);

    await waitFor(() => expect(state.clearAll).toHaveBeenCalledOnce());
  });

  it('reconciles again when Android resumes', async () => {
    render(<NativeRuntimeBridge />);
    await waitFor(() => expect(state.appStateListener).toBeTypeOf('function'));
    vi.clearAllMocks();

    act(() => state.appStateListener?.({ isActive: true }));

    await waitFor(() => {
      expect(state.reconcileWorkout).toHaveBeenCalledWith('Lower A');
      expect(state.reconcileRest).toHaveBeenCalledWith(state.rest);
    });
  });

  it('removes only the listener handle it registered on unmount', async () => {
    const view = render(<NativeRuntimeBridge />);
    await waitFor(() => expect(state.appStateListener).toBeTypeOf('function'));

    view.unmount();

    await waitFor(() => expect(state.remove).toHaveBeenCalledOnce());
  });
});
