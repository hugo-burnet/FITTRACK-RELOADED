export type TutorialCompletion = 'completed' | 'skipped';
export type TutorialActivationPath = 'template' | 'blank';

export const TUTORIAL_MISSION_IDS = [
  'TUT-ACT-01',
  'TUT-REC-01',
  'TUT-ROU-01',
  'TUT-ROU-02',
  'TUT-ROU-03',
  'TUT-ROU-04',
  'TUT-WRK-01',
  'TUT-WRK-02',
  'TUT-WRK-03',
  'TUT-WRK-04',
  'TUT-DAT-01',
  'TUT-DAT-02',
] as const;

export type TutorialMissionId = (typeof TUTORIAL_MISSION_IDS)[number];

export type TutorialMissionStatus = 'completed' | 'dismissed';

export interface TutorialStateV2 {
  version: 2;
  scriptVersion: 1;
  orientation: TutorialCompletion | null;
  activationPath: TutorialActivationPath | null;
  activeMissionId: TutorialMissionId | null;
  activeStepIndex: number;
  /**
   * La routine dont les missions de composition parlent — la dernière ouverte.
   *
   * Sans elle, `/routines/:id` n'est pas une adresse : on sait qu'une étape
   * vit dans l'éditeur d'une routine, pas dans lequel, et on ne peut donc ni
   * y renvoyer l'utilisateur ni décider qu'il n'y est pas. Persistée avec le
   * reste : une mission reprise après un rechargement doit retrouver la sienne.
   */
  missionRoutineId: string | null;
  missions: Partial<Record<TutorialMissionId, TutorialMissionStatus>>;
}

export type TutorialEvent =
  | { type: 'routine-opened'; routineId: string }
  | { type: 'routine-created'; routineId: string }
  | { type: 'routine-exercise-added'; routineId: string; count: number }
  | { type: 'routine-set-added'; routineId: string; setId: string }
  | { type: 'routine-target-updated'; routineId: string }
  | { type: 'routine-rest-updated'; routineId: string; seconds: number }
  | { type: 'workout-started'; workoutId: string; routineId: string }
  | { type: 'workout-set-written'; setId: string; recordable: boolean }
  | { type: 'workout-set-completed'; setId: string }
  | { type: 'rest-finished'; setId: string }
  | { type: 'workout-finish-opened'; workoutId: string }
  | { type: 'workout-saved'; workoutId: string }
  | { type: 'backup-exported'; outcome: 'shared' | 'downloaded' }
  | { type: 'restore-confirmation-opened' }
  | {
      type: 'stale-workout-choice';
      workoutId: string;
      choice: 'resume' | 'finish' | 'discard';
    };
