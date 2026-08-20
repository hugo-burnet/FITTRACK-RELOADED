import { create } from 'zustand';

/**
 * The rep metronome of the set being done — the second and last ephemeral
 * store of the session screen, for the same reason as the rest timer: a tempo
 * is not data. Nothing here is worth persisting, nothing survives a kill, and
 * losing it costs a beat rather than a set.
 *
 * One set at a time. Starting a pace on another row replaces the current one
 * instead of running two metronomes at once — the same rule as the rest.
 */
export interface RepPacer {
  /** The set being paced. `null` when nothing is running. */
  setId: string | null;
  /** The row it belongs to, so its card can show the count. */
  rowId: string | null;
  /** Target repetitions. The beat names the last three of them. */
  reps: number;
  /** Seconds per repetition, fatigue included — cf. `lib/tempo`. */
  repSeconds: number;
  /** Wall clock of the first beat. Beats are derived from it, never counted. */
  startedAt: number;
}

interface RepPacerStore extends RepPacer {
  start: (
    rowId: string,
    setId: string,
    reps: number,
    repSeconds: number,
    leadSeconds?: number,
  ) => void;
  /** Ends the pace. Idempotent, and safe to call for a set that is not paced. */
  stop: (setId?: string) => void;
}

const IDLE: RepPacer = { setId: null, rowId: null, reps: 0, repSeconds: 0, startedAt: 0 };

export const useRepPacer = create<RepPacerStore>((set) => ({
  ...IDLE,

  start: (rowId, setId, reps, repSeconds, leadSeconds = 0) => {
    set({
      rowId,
      setId,
      reps,
      repSeconds,
      startedAt: Date.now() + Math.max(0, leadSeconds) * 1_000,
    });
  },

  stop: (setId) => set((state) => (setId === undefined || state.setId === setId ? IDLE : state)),
}));
