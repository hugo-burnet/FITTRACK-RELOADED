import { create } from 'zustand';
import { readRestSnapshot } from './restSnapshot';

/**
 * The rest timer, and the only Zustand store the session screen has.
 *
 * The deadline is restored after a reload; it is not a fresh countdown.
 * The snapshot is outside the backup preference namespace because a timer
 * belongs to this device's current session, not to a restored backup.
 *
 * `endsAt` is a wall-clock instant, never a counter that decrements — cf.
 * `restProgress`.
 */
export interface RestTimer {
  /** The set whose row carries the bar. `null` when nothing is resting. */
  setId: string | null;
  startedAt: number;
  endsAt: number;
  /** The configured duration, for the reading on the session line. */
  seconds: number;
}

interface RestTimerStore extends RestTimer {
  start: (setId: string, seconds: number) => void;
  /**
   * Pushes the deadline back without restarting the countdown.
   *
   * The effort strip answers a few seconds after the set was validated, and
   * those seconds are already rest — calling `start` again would hand them back
   * and make a bonus of fifteen seconds read as a bonus of twenty-five.
   */
  extend: (setId: string, seconds: number) => void;
  /** Ends the rest. Idempotent, and safe to call for a set that is not resting. */
  stop: (setId?: string) => void;
}

const IDLE: RestTimer = { setId: null, startedAt: 0, endsAt: 0, seconds: 0 };
const STORAGE_KEY = 'fittrack.activeRest';
function restored(): RestTimer {
  try {
    return readRestSnapshot(localStorage.getItem(STORAGE_KEY)) ?? IDLE;
  } catch {
    return IDLE;
  }
}

export const useRestTimer = create<RestTimerStore>((set) => ({
  ...restored(),

  // One rest at a time: validating another set replaces the current one rather
  // than running two bars at once. Same rule as the undo strip's single slot.
  start: (setId, seconds) => {
    const now = Date.now();
    set({ setId, startedAt: now, endsAt: now + seconds * 1000, seconds });
  },

  extend: (setId, seconds) =>
    set((state) =>
      state.setId === setId && seconds > 0
        ? {
            endsAt: state.endsAt + seconds * 1000,
            seconds: state.seconds + seconds,
          }
        : state,
    ),

  stop: (setId) => set((state) => (setId === undefined || state.setId === setId ? IDLE : state)),
}));

useRestTimer.subscribe(({ setId, startedAt, endsAt, seconds }) => {
  try {
    if (setId === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify({ setId, startedAt, endsAt, seconds }));
  } catch {
    /* A blocked localStorage must not interrupt the active rest. */
  }
});
