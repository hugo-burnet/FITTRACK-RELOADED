import { create } from 'zustand';

export type OrderLockSurface = 'routine' | 'workout';

type OrderLockState = Record<OrderLockSurface, boolean>;

export interface ExerciseOrderLockStore {
  unlocked: OrderLockState;
  toggle: (surface: OrderLockSurface) => void;
  reset: () => void;
}

const LOCKED: OrderLockState = { routine: false, workout: false };

export const useExerciseOrderLock = create<ExerciseOrderLockStore>((set) => ({
  unlocked: LOCKED,
  toggle: (surface) =>
    set((state) => ({
      unlocked: {
        ...state.unlocked,
        [surface]: !state.unlocked[surface],
      },
    })),
  reset: () => set({ unlocked: LOCKED }),
}));
