import { create } from 'zustand';

/**
 * Le chrono du maintien en cours — la troisième et dernière horloge éphémère de
 * l'écran de séance, pour exactement la raison des deux autres (ADR-004) : un
 * temps qui court n'est pas une donnée. Rien ici ne mérite d'être persisté, rien
 * ne survit à un kill, et perdre l'horloge coûte **une série mal notée**, pas
 * une séance. La durée, elle, part en base au moment de la coche.
 *
 * Un maintien à la fois. Démarrer un chrono sur une autre ligne remplace le
 * courant plutôt que d'en faire tourner deux — même règle que le repos et que le
 * métronome, et `useWorkoutPace` est ce qui la fait respecter entre les deux
 * horloges.
 */
export interface HoldTimer {
  /** Le set tenu. `null` quand rien ne tourne. */
  setId: string | null;
  /** Sa ligne, pour que sa carte porte le relevé. */
  rowId: string | null;
  /**
   * Horloge murale du premier repère. **Dans le futur** pendant la fenêtre de
   * préparation : le relevé lit cet écart pour afficher « Départ · 7 », comme
   * le métronome.
   */
  startedAt: number;
}

interface HoldTimerStore extends HoldTimer {
  start: (rowId: string, setId: string, leadSeconds?: number) => void;
  /** Arrête le chrono. Idempotent, et sans effet sur un set qui n'est pas tenu. */
  stop: (setId?: string) => void;
}

const IDLE: HoldTimer = { setId: null, rowId: null, startedAt: 0 };

export const useHoldTimer = create<HoldTimerStore>((set) => ({
  ...IDLE,

  start: (rowId, setId, leadSeconds = 0) => {
    set({ rowId, setId, startedAt: Date.now() + Math.max(0, leadSeconds) * 1_000 });
  },

  stop: (setId) => set((state) => (setId === undefined || state.setId === setId ? IDLE : state)),
}));
