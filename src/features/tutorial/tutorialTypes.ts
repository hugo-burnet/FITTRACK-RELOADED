export type TutorialCompletion = 'completed' | 'skipped';

/**
 * Où en est la campagne débutant.
 *
 * `routine-ready` est le seul état qui compte vraiment : la préparation est
 * faite, et le tutoriel **attend** que l'utilisateur démarre lui-même cette
 * routine. Sans lui, la seule façon d'enchaîner sur la séance serait d'en
 * fabriquer une — ce que la spec interdit.
 */
export type TutorialCampaignStatus =
  | 'not-started'
  | 'preparing'
  | 'routine-ready'
  | 'workout-active'
  | 'completed'
  | 'dismissed';

export const TUTORIAL_MISSION_IDS = [
  'TUT-CAM-01',
  'TUT-CAM-02',
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
  'TUT-PRG-01',
  'TUT-PRG-02',
  'TUT-PRG-03',
  'TUT-PRG-04',
  'TUT-WRK-05',
  'TUT-WRK-06',
  'TUT-WRK-07',
  'TUT-WRK-08',
  'TUT-WRK-09',
  'TUT-WRK-10',
  'TUT-WRK-11',
  'TUT-WRK-12',
  'TUT-HIS-01',
  'TUT-HIS-02',
  'TUT-HIS-03',
  'TUT-IMP-01',
  'TUT-ANA-01',
  'TUT-ANA-02',
  'TUT-EXE-01',
  'TUT-EXE-02',
  'TUT-KNW-01',
  'TUT-KNW-02',
  'TUT-HOME-01',
  'TUT-SET-01',
  'TUT-SET-02',
] as const;

export type TutorialMissionId = (typeof TUTORIAL_MISSION_IDS)[number];

export type TutorialMissionStatus = 'completed' | 'dismissed';

export interface TutorialStateV3 {
  version: 3;
  scriptVersion: 2;
  orientation: TutorialCompletion | null;
  campaign: TutorialCampaignStatus;
  activeMissionId: TutorialMissionId | null;
  activeStepIndex: number;
  /**
   * La routine créée pendant la campagne — « Séance découverte ».
   *
   * Distincte de `missionRoutineId` : la campagne doit reconnaître **son**
   * `workout-started`, pas n'importe lequel. Une séance lancée sur une autre
   * routine ne reprend pas l'acte 2.
   */
  campaignRoutineId: string | null;
  /**
   * La routine dont les missions de composition parlent — la dernière ouverte.
   *
   * Sans elle, `/routines/:id` n'est pas une adresse : on sait qu'une étape
   * vit dans l'éditeur d'une routine, pas dans lequel, et on ne peut donc ni
   * y renvoyer l'utilisateur ni décider qu'il n'y est pas. Persistée avec le
   * reste : une mission reprise après un rechargement doit retrouver la sienne.
   */
  missionRoutineId: string | null;
  /** Même rôle que `missionRoutineId`, pour `/programs/:id`. */
  missionProgramId: string | null;
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
