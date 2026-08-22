import { createContext, useContext } from 'react';
import type { TutorialEvent, TutorialMissionId } from './tutorialTypes';

export interface TutorialControls {
  openHelp: () => void;
  startMission: (missionId: TutorialMissionId) => void;
  offerMission: (missionId: TutorialMissionId) => void;
  report: (event: TutorialEvent) => void;
}

export const TutorialContext = createContext<TutorialControls | null>(null);

export function useTutorialControls(): TutorialControls | null {
  return useContext(TutorialContext);
}
