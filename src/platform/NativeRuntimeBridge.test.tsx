import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationPreferences,
} from '@/lib/notificationPreferences';
import { NativeRuntimeBridge } from './NativeRuntimeBridge';

const state = vi.hoisted(() => ({
  active: { name: 'Lower A' } as { name: string } | null,
  rest: { setId: 'set-1', startedAt: 1_000, endsAt: 91_000, seconds: 90 },
  pathname: '/workout/add',
  appStateListener: undefined as ((state: { isActive: boolean }) => void) | undefined,
  backListener: undefined as ((event: { canGoBack: boolean }) => void) | undefined,
  appStateRemove: vi.fn().mockResolvedValue(undefined),
  backRemove: vi.fn().mockResolvedValue(undefined),
  navigate: vi.fn(),
  exitApp: vi.fn().mockResolvedValue(undefined),
  getActiveWorkout: vi.fn(),
  getNotificationPreferences: vi.fn(),
  // Écrit à la main : `vi.hoisted` s'exécute avant les imports du fichier.
  preferences: {
    reminders: false,
    rest: true,
    records: true,
    schedule: { days: [1, 3, 5], minutes: 1080 },
  } as NotificationPreferences | undefined,
  reconcileWorkout: vi.fn().mockResolvedValue(undefined),
  reconcileRest: vi.fn().mockResolvedValue(undefined),
  applyPreferences: vi.fn().mockResolvedValue(undefined),
  clearAll: vi.fn().mockResolvedValue(undefined),
}));

// Deux requêtes vives dans ce composant : la séance active et les préférences
// de notification. On les distingue par la fonction passée, pas par leur ordre.
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (query: unknown) =>
    query === state.getNotificationPreferences ? state.preferences : state.active,
}));

vi.mock('@/data/repositories/notificationSettings', () => ({
  getNotificationPreferences: state.getNotificationPreferences,
}));

vi.mock('@/data/repositories/workouts', () => ({
  getActiveWorkout: state.getActiveWorkout,
}));

vi.mock('@/stores/restTimer', () => ({
  useRestTimer: () => state.rest,
}));

vi.mock('./nativeEnvironment', () => ({
  isNativeAndroid: () => true,
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: state.pathname }),
  useNavigate: () => state.navigate,
}));

vi.mock('./nativeNotifications', () => ({
  nativeNotifications: {
    reconcileWorkout: state.reconcileWorkout,
    reconcileRest: state.reconcileRest,
    applyPreferences: state.applyPreferences,
    clearAll: state.clearAll,
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(
      (
        event: string,
        listener:
          ((value: { isActive: boolean }) => void) | ((value: { canGoBack: boolean }) => void),
      ) => {
        if (event === 'appStateChange') {
          state.appStateListener = listener as (value: { isActive: boolean }) => void;
          return Promise.resolve({ remove: state.appStateRemove });
        }
        state.backListener = listener as (value: { canGoBack: boolean }) => void;
        return Promise.resolve({ remove: state.backRemove });
      },
    ),
    exitApp: state.exitApp,
  },
}));

describe('NativeRuntimeBridge', () => {
  beforeEach(() => {
    state.active = { name: 'Lower A' };
    state.rest = { setId: 'set-1', startedAt: 1_000, endsAt: 91_000, seconds: 90 };
    state.pathname = '/workout/add';
    state.preferences = DEFAULT_NOTIFICATION_PREFERENCES;
    state.appStateListener = undefined;
    state.backListener = undefined;
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

  it('pushes the notification preferences down at mount', async () => {
    render(<NativeRuntimeBridge />);

    await waitFor(() =>
      expect(state.applyPreferences).toHaveBeenCalledWith(DEFAULT_NOTIFICATION_PREFERENCES),
    );
  });

  it('waits for the preferences rather than applying a guessed default', async () => {
    state.preferences = undefined;
    render(<NativeRuntimeBridge />);

    await waitFor(() => expect(state.reconcileRest).toHaveBeenCalled());
    expect(state.applyPreferences).not.toHaveBeenCalled();
  });

  it('re-arms the reminders when Android resumes, the horizon having drained', async () => {
    render(<NativeRuntimeBridge />);
    await waitFor(() => expect(state.appStateListener).toBeTypeOf('function'));
    vi.clearAllMocks();

    act(() => state.appStateListener?.({ isActive: true }));

    await waitFor(() =>
      expect(state.applyPreferences).toHaveBeenCalledWith(DEFAULT_NOTIFICATION_PREFERENCES),
    );
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
    await waitFor(() => {
      expect(state.appStateListener).toBeTypeOf('function');
      expect(state.backListener).toBeTypeOf('function');
    });

    view.unmount();

    await waitFor(() => {
      expect(state.appStateRemove).toHaveBeenCalledOnce();
      expect(state.backRemove).toHaveBeenCalledOnce();
    });
  });

  it('uses router history for Android back when available', async () => {
    render(<NativeRuntimeBridge />);
    await waitFor(() => expect(state.backListener).toBeTypeOf('function'));

    act(() => state.backListener?.({ canGoBack: true }));

    expect(state.navigate).toHaveBeenCalledWith(-1);
  });

  it('uses the deterministic parent for Android back without history', async () => {
    render(<NativeRuntimeBridge />);
    await waitFor(() => expect(state.backListener).toBeTypeOf('function'));

    act(() => state.backListener?.({ canGoBack: false }));

    expect(state.navigate).toHaveBeenCalledWith('/workout', {
      replace: true,
      viewTransition: true,
    });
  });

  // The hardware button is a back gesture whichever branch it takes. The
  // deterministic-parent branch is the one that quietly went forward: a delta
  // carries its direction in its sign, a path does not.
  it('marks both Android back branches as backward navigation', async () => {
    render(<NativeRuntimeBridge />);
    await waitFor(() => expect(state.backListener).toBeTypeOf('function'));

    document.documentElement.dataset.nav = 'forward';
    act(() => state.backListener?.({ canGoBack: false }));
    expect(document.documentElement.dataset.nav).toBe('back');

    document.documentElement.dataset.nav = 'forward';
    act(() => state.backListener?.({ canGoBack: true }));
    expect(document.documentElement.dataset.nav).toBe('back');
  });

  it('exits from a tab root on Android back without history', async () => {
    state.pathname = '/';
    render(<NativeRuntimeBridge />);
    await waitFor(() => expect(state.backListener).toBeTypeOf('function'));

    act(() => state.backListener?.({ canGoBack: false }));

    expect(state.exitApp).toHaveBeenCalledOnce();
  });
});
