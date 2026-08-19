import { create } from 'zustand';

/**
 * The rest timer, and the only Zustand store the session screen has.
 *
 * ADR-004 names "the rest timer's state" as the one thing that belongs in a
 * store, and this is why: a rest is **not data**. Nothing here is worth
 * persisting, nothing here survives a kill, and losing it costs a two-minute
 * countdown rather than a set. Non-negotiable rule n°4 protects the session; it
 * has nothing to say about this.
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

export const useRestTimer = create<RestTimerStore>((set) => ({
  ...IDLE,

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

  stop: (setId) =>
    set((state) => (setId === undefined || state.setId === setId ? IDLE : state)),
}));
