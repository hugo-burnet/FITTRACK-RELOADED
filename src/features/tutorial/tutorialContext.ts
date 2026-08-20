import { createContext, useContext } from 'react';

export interface TutorialControls {
  openHelp: () => void;
}

export const TutorialContext = createContext<TutorialControls | null>(null);

export function useTutorialControls(): TutorialControls | null {
  return useContext(TutorialContext);
}
