# Tutoriel v2 — Première séance P1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer un tutoriel v2 reprenable qui accompagne une personne de la création ou du choix d'une routine jusqu'à sa première séance sauvegardée, puis lui apprend à exporter et comprendre une sauvegarde complète.

**Architecture:** La visite d'orientation actuelle reste intacte et un moteur de missions pur lui est ajouté. Les écrans publient uniquement des événements métier après leurs écritures réelles ; la machine d'état observe ces événements, persiste la progression dans `fittrack:tutorial:v2` et affiche un coach non modal ancré par `data-tutorial-id`, sans jamais écrire à la place de l'utilisateur.

**Tech Stack:** React 19, TypeScript strict, React Router hash, Dexie + `useLiveQuery`, localStorage versionné pour la progression tutoriel, Vitest + Testing Library + `fake-indexeddb`, Tailwind CSS v4.

## Global Constraints

- Spécification source : `docs/product/FEATURE-INVENTORY.md`, sections 6 à 11.
- Périmètre de ce plan : socle tutoriel v2, missions P1 `TUT-ACT-01`, `TUT-REC-01`, `TUT-ROU-01` à `04`, `TUT-WRK-01` à `04`, `TUT-DAT-01` et `02`.
- Hors périmètre : missions P2/P3, génération ElevenLabs, ajout des futurs clips au manifeste, modification des 43 MP3 actuels.
- Aucune mission ne crée, modifie, valide, termine, abandonne, exporte ou restaure une donnée à la place de l'utilisateur.
- Local-first : toutes les missions fonctionnent hors ligne, sans compte et en mode Silence.
- La transcription française est fonctionnelle sans clip ; tous les textes UI vivent dans `src/i18n/fr.ts`.
- Code, types, noms et commentaires en anglais. Aucun `any`.
- Les cibles tutoriel interactives mesurent au moins 48 px.
- Une séance ancienne est définie par `12 * 60 * 60 * 1_000` ms. Elle n'est jamais supprimée automatiquement.
- La restauration réelle n'est jamais exigée : `TUT-DAT-02` se termine à l'ouverture de la confirmation.
- TDD pour le store, la machine d'état et la détection de séance ancienne.
- Vérification finale obligatoire : `npm run typecheck`, `npm run test:run`, `npm run build`.
- Ne jamais lire, afficher, journaliser ni commiter la clé API voix.

## File Map

| File | Responsibility |
|---|---|
| `src/features/tutorial/tutorialTypes.ts` | IDs P1, état v2, événements et contrats partagés |
| `src/features/tutorial/tutorialStore.ts` | lecture, migration v1 → v2 et persistance défensive |
| `src/features/tutorial/tutorialMissions.ts` | catalogue P1, routes, cibles, conditions de réussite et enchaînement |
| `src/features/tutorial/tutorialMissionMachine.ts` | transitions pures démarrer / avancer / passer |
| `src/features/tutorial/TutorialMissionCoach.tsx` | panneau non modal et surbrillance d'une cible précise |
| `src/features/tutorial/useTutorialMissions.ts` | orchestration React, navigation et sauvegarde après chaque transition |
| `src/features/tutorial/tutorialContext.ts` | API minimale exposée aux écrans métier |
| `src/features/tutorial/TutorialProvider.tsx` | orientation existante, activation, aide par route et montage du coach |
| `src/app/staleWorkout.ts` | seuil pur d'une séance anormalement ancienne |
| `src/app/ActiveWorkoutRecoverySheet.tsx` | choix Reprendre / Terminer / Abandonner avec confirmation |
| `src/app/ActiveWorkoutBar.tsx` | entrée persistante et déclenchement de la récupération sûre |
| `src/features/routines/*` | ancres et événements de création/configuration/démarrage |
| `src/features/workout/*` | ancres et événements saisie/validation/repos/fin |
| `src/features/settings/BackupActions.tsx` | ancres et événements export/confirmation de restauration |
| `src/ui/{HeaderAction,ActionBand,AddRow,ListRow}.tsx` | transport neutre du prop `tutorialId` jusqu'au DOM |
| `src/i18n/fr.ts` | activation, missions, aide, récupération et libellés du coach |
| `PROGRESS.md` | état réel, vérifications et checkpoint téléphone |

---

### Task 1: État versionné et migration `fittrack:tutorial:v2`

**Files:**
- Create: `src/features/tutorial/tutorialTypes.ts`
- Modify: `src/features/tutorial/tutorialStore.ts`
- Create: `src/features/tutorial/tutorialStore.test.ts`

**Interfaces:**
- Produces: `TutorialMissionId`, `TutorialEvent`, `TutorialStateV2`, `createTutorialState()`, `loadTutorialState()`, `saveTutorialState(state)`.
- Consumes: l'ancienne clé `fittrack:tutorial:v1` uniquement pour la migration.

- [ ] **Step 1: Write the failing store tests**

Create `src/features/tutorial/tutorialStore.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  LEGACY_TUTORIAL_STORAGE_KEY,
  TUTORIAL_STORAGE_KEY,
  createTutorialState,
  loadTutorialState,
  saveTutorialState,
} from './tutorialStore';

describe('tutorialStore v2', () => {
  beforeEach(() => localStorage.clear());

  it('starts with an untouched v2 state', () => {
    expect(loadTutorialState()).toEqual(createTutorialState());
  });

  it('migrates a completed v1 orientation without inventing mission progress', () => {
    localStorage.setItem(LEGACY_TUTORIAL_STORAGE_KEY, 'completed');
    expect(loadTutorialState()).toEqual({
      version: 2,
      scriptVersion: 1,
      orientation: 'completed',
      activationPath: null,
      activeMissionId: null,
      activeStepIndex: 0,
      missions: {},
    });
  });

  it('treats a skipped v1 visit as an already-seen orientation', () => {
    localStorage.setItem(LEGACY_TUTORIAL_STORAGE_KEY, 'skipped');
    expect(loadTutorialState().orientation).toBe('completed');
  });

  it('round-trips an active mission and its exact step', () => {
    const state = {
      ...createTutorialState(),
      orientation: 'skipped' as const,
      activationPath: 'blank' as const,
      activeMissionId: 'TUT-ROU-03' as const,
      activeStepIndex: 1,
      missions: { 'TUT-ROU-01': 'completed' as const },
    };
    saveTutorialState(state);
    expect(loadTutorialState()).toEqual(state);
    expect(localStorage.getItem(TUTORIAL_STORAGE_KEY)).toContain('TUT-ROU-03');
  });

  it('ignores malformed or future state', () => {
    localStorage.setItem(TUTORIAL_STORAGE_KEY, '{broken');
    expect(loadTutorialState()).toEqual(createTutorialState());
    localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify({ version: 99 }));
    expect(loadTutorialState()).toEqual(createTutorialState());
  });
});
```

- [ ] **Step 2: Run the test to verify RED**

Run: `npm run test:run -- src/features/tutorial/tutorialStore.test.ts`

Expected: FAIL because the v2 exports do not exist.

- [ ] **Step 3: Define the shared contracts**

Create `src/features/tutorial/tutorialTypes.ts`:

```ts
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
```

- [ ] **Step 4: Replace the v1-only store with defensive v2 persistence**

Replace `src/features/tutorial/tutorialStore.ts` with:

```ts
import { TUTORIAL_MISSION_IDS, type TutorialStateV2 } from './tutorialTypes';

export const LEGACY_TUTORIAL_STORAGE_KEY = 'fittrack:tutorial:v1';
export const TUTORIAL_STORAGE_KEY = 'fittrack:tutorial:v2';

export function createTutorialState(): TutorialStateV2 {
  return {
    version: 2,
    scriptVersion: 1,
    orientation: null,
    activationPath: null,
    activeMissionId: null,
    activeStepIndex: 0,
    missions: {},
  };
}

function isTutorialState(value: unknown): value is TutorialStateV2 {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Partial<TutorialStateV2>;
  const missionValues =
    typeof state.missions === 'object' && state.missions !== null
      ? Object.values(state.missions)
      : [];
  return (
    state.version === 2 &&
    state.scriptVersion === 1 &&
    (state.orientation === null ||
      state.orientation === 'completed' ||
      state.orientation === 'skipped') &&
    (state.activationPath === null ||
      state.activationPath === 'template' ||
      state.activationPath === 'blank') &&
    (state.activeMissionId === null ||
      TUTORIAL_MISSION_IDS.includes(
        state.activeMissionId as (typeof TUTORIAL_MISSION_IDS)[number],
      )) &&
    typeof state.activeStepIndex === 'number' &&
    Number.isInteger(state.activeStepIndex) &&
    state.activeStepIndex >= 0 &&
    typeof state.missions === 'object' &&
    state.missions !== null &&
    missionValues.every((status) => status === 'completed' || status === 'dismissed')
  );
}

export function loadTutorialState(): TutorialStateV2 {
  try {
    const raw = localStorage.getItem(TUTORIAL_STORAGE_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (isTutorialState(parsed)) return parsed;
    }
  } catch {
    return createTutorialState();
  }

  const legacy = localStorage.getItem(LEGACY_TUTORIAL_STORAGE_KEY);
  const state = createTutorialState();
  if (legacy === 'completed' || legacy === 'skipped') state.orientation = 'completed';
  return state;
}

export function saveTutorialState(state: TutorialStateV2): void {
  localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(state));
}
```

- [ ] **Step 5: Run the focused tests and typecheck**

Run: `npm run test:run -- src/features/tutorial/tutorialStore.test.ts src/features/tutorial/TutorialProvider.test.tsx && npm run typecheck`

Expected: store tests PASS and the existing provider tests remain green through these two explicit compatibility wrappers:

```ts
export const loadTutorialCompletion = () => loadTutorialState().orientation;

export function saveTutorialCompletion(value: 'completed' | 'skipped'): void {
  saveTutorialState({ ...loadTutorialState(), orientation: value });
}
```

Task 4 removes both wrappers after migrating the provider to the v2 controller.

- [ ] **Step 6: Commit**

```bash
git add src/features/tutorial/tutorialTypes.ts src/features/tutorial/tutorialStore.ts src/features/tutorial/tutorialStore.test.ts
git commit -m "feat(tutorial): persist versioned mission progress"
```

---

### Task 2: Catalogue P1 et machine d'état pure

**Files:**
- Create: `src/features/tutorial/tutorialMissions.ts`
- Create: `src/features/tutorial/tutorialMissionMachine.ts`
- Create: `src/features/tutorial/tutorialMissionMachine.test.ts`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Consumes: `TutorialStateV2`, `TutorialEvent`, `TutorialMissionId` from Task 1.
- Produces: `P1_MISSIONS`, `missionFor(id)`, `contextualMissionsForPath(pathname, state)`, `startMission`, `advanceMission`, `dismissMission`.

- [ ] **Step 1: Write transition tests before the catalogue**

Create `src/features/tutorial/tutorialMissionMachine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createTutorialState } from './tutorialStore';
import { advanceMission, dismissMission, startMission } from './tutorialMissionMachine';
import { contextualMissionsForPath } from './tutorialMissions';

describe('tutorial mission machine', () => {
  it('starts a mission at its first step', () => {
    expect(startMission(createTutorialState(), 'TUT-ROU-03')).toMatchObject({
      activeMissionId: 'TUT-ROU-03',
      activeStepIndex: 0,
    });
  });

  it('ignores unrelated events', () => {
    const state = startMission(createTutorialState(), 'TUT-WRK-02');
    expect(advanceMission(state, { type: 'routine-created', routineId: 'r1' })).toBe(state);
  });

  it('requires both target and rest steps before starting the routine mission', () => {
    const started = startMission(createTutorialState(), 'TUT-ROU-03');
    const targeted = advanceMission(started, {
      type: 'routine-target-updated',
      routineId: 'r1',
    });
    expect(targeted.activeStepIndex).toBe(1);
    const rested = advanceMission(targeted, {
      type: 'routine-rest-updated',
      routineId: 'r1',
      seconds: 90,
    });
    expect(rested.missions['TUT-ROU-03']).toBe('completed');
    expect(rested.activeMissionId).toBe('TUT-ROU-04');
  });

  it('does not accept an empty export or a restoration write', () => {
    const exporting = startMission(createTutorialState(), 'TUT-DAT-01');
    expect(
      advanceMission(exporting, { type: 'backup-exported', outcome: 'downloaded' }),
    ).toMatchObject({ activeMissionId: 'TUT-DAT-02' });
    const restoring = startMission(createTutorialState(), 'TUT-DAT-02');
    expect(advanceMission(restoring, { type: 'restore-confirmation-opened' })).toMatchObject({
      activeMissionId: null,
      missions: { 'TUT-DAT-02': 'completed' },
    });
  });

  it('persists an explicit dismissal without completing the mission', () => {
    const dismissed = dismissMission(startMission(createTutorialState(), 'TUT-REC-01'));
    expect(dismissed).toMatchObject({
      activeMissionId: null,
      missions: { 'TUT-REC-01': 'dismissed' },
    });
  });

  it('hides incompatible route missions', () => {
    const state = createTutorialState();
    expect(
      contextualMissionsForPath('/routines', state, { hasActiveWorkout: true }),
    ).toEqual([]);
    expect(
      contextualMissionsForPath('/workout', state, { hasActiveWorkout: false }),
    ).toEqual([]);
  });
});
```

- [ ] **Step 2: Run RED**

Run: `npm run test:run -- src/features/tutorial/tutorialMissionMachine.test.ts`

Expected: FAIL because the machine and catalogue are absent.

- [ ] **Step 3: Create the exact mission catalogue**

Create `src/features/tutorial/tutorialMissions.ts`. Use this contract and the table below; `instructionKey` and `detailKey` are added to `fr.ts` in Task 4.

```ts
import type { TranslationKey } from '@/i18n/fr';
import type {
  TutorialEvent,
  TutorialMissionId,
  TutorialStateV2,
} from './tutorialTypes';

export interface TutorialMissionStep {
  id: string;
  targetId: string;
  instructionKey: TranslationKey;
  detailKey: TranslationKey;
  clipId?: string;
  advanceWhen: (event: TutorialEvent) => boolean;
}

export interface TutorialMission {
  id: TutorialMissionId;
  routePrefix: '/routines' | '/workout' | '/settings' | '/';
  titleKey: TranslationKey;
  guard: 'always' | 'requires-active-workout' | 'requires-no-active-workout' | 'external';
  steps: readonly TutorialMissionStep[];
  nextMissionId: TutorialMissionId | null;
}

export interface TutorialMissionFacts {
  hasActiveWorkout: boolean | null;
}

const eventIs = <T extends TutorialEvent['type']>(type: T) =>
  (event: TutorialEvent): boolean => event.type === type;

const positiveRest = (event: TutorialEvent): boolean =>
  event.type === 'routine-rest-updated' && event.seconds > 0;

const recordableSet = (event: TutorialEvent): boolean =>
  event.type === 'workout-set-written' && event.recordable;

export function isMissionAvailable(
  mission: TutorialMission,
  facts: TutorialMissionFacts,
): boolean {
  if (mission.guard === 'requires-active-workout') return facts.hasActiveWorkout === true;
  if (mission.guard === 'requires-no-active-workout') return facts.hasActiveWorkout === false;
  return mission.guard === 'always';
}
```

Define all missions with these exact fields:

| Mission | Route | Steps `(id, targetId, instructionKey, detailKey, condition)` | Next |
|---|---|---|---|
| `TUT-ACT-01` | `/routines` | `pick-template`, `routine-create`, `tutorial.mission.activation.instruction`, `tutorial.mission.activation.detail`, `routine-opened` | `TUT-ROU-02` |
| `TUT-REC-01` | `/` | `recover`, `active-workout-bar`, `tutorial.mission.recovery.instruction`, `tutorial.mission.recovery.detail`, `stale-workout-choice` | `null` |
| `TUT-ROU-01` | `/routines` | `create`, `routine-create`, `tutorial.mission.routineCreate.instruction`, `tutorial.mission.routineCreate.detail`, `routine-created` | `TUT-ROU-02` |
| `TUT-ROU-02` | `/routines` | `add-exercise`, `routine-add-exercise`, `tutorial.mission.routineExercise.instruction`, `tutorial.mission.routineExercise.detail`, `routine-exercise-added` with `count > 0`; then `add-set`, `routine-add-set`, `tutorial.mission.routineSet.instruction`, `tutorial.mission.routineSet.detail`, `routine-set-added` | `TUT-ROU-03` |
| `TUT-ROU-03` | `/routines` | `set-target`, `routine-first-set`, `tutorial.mission.routineTargets.instruction`, `tutorial.mission.routineTargets.detail`, `routine-target-updated`; then `set-rest`, `routine-exercise-menu`, `tutorial.mission.routineRest.instruction`, `tutorial.mission.routineRest.detail`, `positiveRest` | `TUT-ROU-04` |
| `TUT-ROU-04` | `/routines` | `start`, `routine-start`, `tutorial.mission.routineStart.instruction`, `tutorial.mission.routineStart.detail`, `workout-started` | `TUT-WRK-01` |
| `TUT-WRK-01` | `/workout` | `write`, `workout-first-set`, `tutorial.mission.setInput.instruction`, `tutorial.mission.setInput.detail`, `recordableSet` | `TUT-WRK-02` |
| `TUT-WRK-02` | `/workout` | `complete`, `workout-first-set-complete`, `tutorial.mission.setValidate.instruction`, `tutorial.mission.setValidate.detail`, `workout-set-completed` | `TUT-WRK-03` |
| `TUT-WRK-03` | `/workout` | `rest`, `workout-rest`, `tutorial.mission.rest.instruction`, `tutorial.mission.rest.detail`, `rest-finished` | `TUT-WRK-04` |
| `TUT-WRK-04` | `/workout` | `open-finish`, `workout-finish`, `tutorial.mission.workoutFinish.instruction`, `tutorial.mission.workoutFinish.detail`, `workout-finish-opened`; then `save`, `workout-save`, `tutorial.mission.workoutSave.instruction`, `tutorial.mission.workoutSave.detail`, `workout-saved` | `TUT-DAT-01` |
| `TUT-DAT-01` | `/settings` | `export`, `backup-export`, `tutorial.mission.backupExport.instruction`, `tutorial.mission.backupExport.detail`, `backup-exported` | `TUT-DAT-02` |
| `TUT-DAT-02` | `/settings` | `restore`, `backup-restore`, `tutorial.mission.backupRestore.instruction`, `tutorial.mission.backupRestore.detail`, `restore-confirmation-opened` | `null` |

Write the constants explicitly:

```ts
const ACTIVATE: TutorialMission = {
  id: 'TUT-ACT-01',
  routePrefix: '/routines',
  titleKey: 'tutorial.mission.activation.title',
  guard: 'requires-no-active-workout',
  steps: [{
    id: 'pick-template',
    targetId: 'routine-create',
    instructionKey: 'tutorial.mission.activation.instruction',
    detailKey: 'tutorial.mission.activation.detail',
    advanceWhen: eventIs('routine-opened'),
  }],
  nextMissionId: 'TUT-ROU-02',
};

const RECOVER: TutorialMission = {
  id: 'TUT-REC-01',
  routePrefix: '/',
  titleKey: 'tutorial.mission.recovery.title',
  guard: 'external',
  steps: [{
    id: 'recover',
    targetId: 'active-workout-bar',
    instructionKey: 'tutorial.mission.recovery.instruction',
    detailKey: 'tutorial.mission.recovery.detail',
    advanceWhen: eventIs('stale-workout-choice'),
  }],
  nextMissionId: null,
};

const ROUTINE_CREATE: TutorialMission = {
  id: 'TUT-ROU-01',
  routePrefix: '/routines',
  titleKey: 'tutorial.mission.routineCreate.title',
  guard: 'requires-no-active-workout',
  steps: [{
    id: 'create',
    targetId: 'routine-create',
    instructionKey: 'tutorial.mission.routineCreate.instruction',
    detailKey: 'tutorial.mission.routineCreate.detail',
    advanceWhen: eventIs('routine-created'),
  }],
  nextMissionId: 'TUT-ROU-02',
};

const ROUTINE_EXERCISE: TutorialMission = {
  id: 'TUT-ROU-02',
  routePrefix: '/routines',
  titleKey: 'tutorial.mission.routineExercise.title',
  guard: 'requires-no-active-workout',
  steps: [
    {
      id: 'add-exercise',
      targetId: 'routine-add-exercise',
      instructionKey: 'tutorial.mission.routineExercise.instruction',
      detailKey: 'tutorial.mission.routineExercise.detail',
      advanceWhen: (event) => event.type === 'routine-exercise-added' && event.count > 0,
    },
    {
      id: 'add-set',
      targetId: 'routine-add-set',
      instructionKey: 'tutorial.mission.routineSet.instruction',
      detailKey: 'tutorial.mission.routineSet.detail',
      advanceWhen: eventIs('routine-set-added'),
    },
  ],
  nextMissionId: 'TUT-ROU-03',
};

const ROUTINE_TARGETS: TutorialMission = {
  id: 'TUT-ROU-03',
  routePrefix: '/routines',
  titleKey: 'tutorial.mission.routineTargets.title',
  guard: 'requires-no-active-workout',
  steps: [
    {
      id: 'set-target',
      targetId: 'routine-first-set',
      instructionKey: 'tutorial.mission.routineTargets.instruction',
      detailKey: 'tutorial.mission.routineTargets.detail',
      advanceWhen: eventIs('routine-target-updated'),
    },
    {
      id: 'set-rest',
      targetId: 'routine-exercise-menu',
      instructionKey: 'tutorial.mission.routineRest.instruction',
      detailKey: 'tutorial.mission.routineRest.detail',
      advanceWhen: positiveRest,
    },
  ],
  nextMissionId: 'TUT-ROU-04',
};

const ROUTINE_START: TutorialMission = {
  id: 'TUT-ROU-04',
  routePrefix: '/routines',
  titleKey: 'tutorial.mission.routineStart.title',
  guard: 'requires-no-active-workout',
  steps: [{
    id: 'start',
    targetId: 'routine-start',
    instructionKey: 'tutorial.mission.routineStart.instruction',
    detailKey: 'tutorial.mission.routineStart.detail',
    advanceWhen: eventIs('workout-started'),
  }],
  nextMissionId: 'TUT-WRK-01',
};

const WORKOUT_INPUT: TutorialMission = {
  id: 'TUT-WRK-01',
  routePrefix: '/workout',
  titleKey: 'tutorial.mission.setInput.title',
  guard: 'requires-active-workout',
  steps: [{
    id: 'write',
    targetId: 'workout-first-set',
    instructionKey: 'tutorial.mission.setInput.instruction',
    detailKey: 'tutorial.mission.setInput.detail',
    advanceWhen: recordableSet,
  }],
  nextMissionId: 'TUT-WRK-02',
};

const WORKOUT_VALIDATE: TutorialMission = {
  id: 'TUT-WRK-02',
  routePrefix: '/workout',
  titleKey: 'tutorial.mission.setValidate.title',
  guard: 'requires-active-workout',
  steps: [{
    id: 'complete',
    targetId: 'workout-first-set-complete',
    instructionKey: 'tutorial.mission.setValidate.instruction',
    detailKey: 'tutorial.mission.setValidate.detail',
    advanceWhen: eventIs('workout-set-completed'),
  }],
  nextMissionId: 'TUT-WRK-03',
};

const WORKOUT_REST: TutorialMission = {
  id: 'TUT-WRK-03',
  routePrefix: '/workout',
  titleKey: 'tutorial.mission.rest.title',
  guard: 'requires-active-workout',
  steps: [{
    id: 'rest',
    targetId: 'workout-rest',
    instructionKey: 'tutorial.mission.rest.instruction',
    detailKey: 'tutorial.mission.rest.detail',
    advanceWhen: eventIs('rest-finished'),
  }],
  nextMissionId: 'TUT-WRK-04',
};

const WORKOUT_FINISH: TutorialMission = {
  id: 'TUT-WRK-04',
  routePrefix: '/workout',
  titleKey: 'tutorial.mission.workoutFinish.title',
  guard: 'requires-active-workout',
  steps: [
    {
      id: 'open-finish',
      targetId: 'workout-finish',
      instructionKey: 'tutorial.mission.workoutFinish.instruction',
      detailKey: 'tutorial.mission.workoutFinish.detail',
      advanceWhen: eventIs('workout-finish-opened'),
    },
    {
      id: 'save',
      targetId: 'workout-save',
      instructionKey: 'tutorial.mission.workoutSave.instruction',
      detailKey: 'tutorial.mission.workoutSave.detail',
      advanceWhen: eventIs('workout-saved'),
    },
  ],
  nextMissionId: 'TUT-DAT-01',
};

const BACKUP_EXPORT: TutorialMission = {
  id: 'TUT-DAT-01',
  routePrefix: '/settings',
  titleKey: 'tutorial.mission.backupExport.title',
  guard: 'always',
  steps: [{
    id: 'export',
    targetId: 'backup-export',
    instructionKey: 'tutorial.mission.backupExport.instruction',
    detailKey: 'tutorial.mission.backupExport.detail',
    advanceWhen: eventIs('backup-exported'),
  }],
  nextMissionId: 'TUT-DAT-02',
};

const BACKUP_RESTORE: TutorialMission = {
  id: 'TUT-DAT-02',
  routePrefix: '/settings',
  titleKey: 'tutorial.mission.backupRestore.title',
  guard: 'always',
  steps: [{
    id: 'restore',
    targetId: 'backup-restore',
    instructionKey: 'tutorial.mission.backupRestore.instruction',
    detailKey: 'tutorial.mission.backupRestore.detail',
    advanceWhen: eventIs('restore-confirmation-opened'),
  }],
  nextMissionId: null,
};
```

Export the catalogue and selectors:

```ts
export const P1_MISSIONS: readonly TutorialMission[] = [
  ACTIVATE,
  RECOVER,
  ROUTINE_CREATE,
  ROUTINE_EXERCISE,
  ROUTINE_TARGETS,
  ROUTINE_START,
  WORKOUT_INPUT,
  WORKOUT_VALIDATE,
  WORKOUT_REST,
  WORKOUT_FINISH,
  BACKUP_EXPORT,
  BACKUP_RESTORE,
];

export function missionFor(id: TutorialMissionId): TutorialMission {
  const mission = P1_MISSIONS.find((candidate) => candidate.id === id);
  if (mission === undefined) throw new Error(`Unknown tutorial mission: ${id}`);
  return mission;
}

export function contextualMissionsForPath(
  pathname: string,
  state: TutorialStateV2,
  facts: TutorialMissionFacts,
): readonly TutorialMission[] {
  return P1_MISSIONS.filter(
    (mission) =>
      mission.id !== 'TUT-ACT-01' &&
      mission.id !== 'TUT-REC-01' &&
      pathname.startsWith(mission.routePrefix) &&
      isMissionAvailable(mission, facts) &&
      state.missions[mission.id] !== 'completed',
  );
}
```

Do not add `clipId` yet: the optional field exists for the later voice plan, and its absence is the tested text-only path.

- [ ] **Step 4: Add the typed French mission copy required by the catalogue**

Add this `mission` object under `tutorial` in `src/i18n/fr.ts`:

```ts
mission: {
  activation: {
    title: 'Choisir un modèle',
    instruction: 'Ouvre le menu de création, puis choisis un modèle.',
    detail: 'Le modèle reste entièrement modifiable avant de démarrer.',
  },
  recovery: {
    title: 'Résoudre la séance en attente',
    instruction: 'Ouvre la séance en attente et choisis consciemment sa suite.',
    detail: 'FitTrack ne supprimera jamais cette séance automatiquement.',
  },
  routineCreate: {
    title: 'Créer une première routine',
    instruction: 'Ouvre le menu de création, puis choisis Nouvelle routine.',
    detail: 'Le nom et chaque modification sont enregistrés immédiatement.',
  },
  routineExercise: {
    title: 'Ajouter un exercice',
    instruction: 'Ajoute au moins un exercice à cette routine.',
    detail: 'Choisis un exercice que tu peux réellement effectuer maintenant.',
  },
  routineSet: {
    title: 'Préparer plusieurs séries',
    instruction: 'Ajoute une deuxième série au premier exercice.',
    detail: 'Elle permettra de voir le repos entre deux efforts.',
  },
  routineTargets: {
    title: 'Définir la série',
    instruction: 'Ouvre la première série et renseigne sa cible.',
    detail: 'Les champs proposés dépendent du type de mesure de l’exercice.',
  },
  routineRest: {
    title: 'Définir le repos',
    instruction: 'Ouvre les options de l’exercice et choisis un temps de repos.',
    detail: 'Ce repos démarrera après chaque série de travail compatible.',
  },
  routineStart: {
    title: 'Démarrer la routine',
    instruction: 'Démarre la séance depuis la barre d’action.',
    detail: 'Une seule séance peut être active à la fois.',
  },
  setInput: {
    title: 'Renseigner la première série',
    instruction: 'Renseigne les valeurs de la première série.',
    detail: 'S’il existe, touche le résultat précédent pour le reprendre en un geste.',
  },
  setValidate: {
    title: 'Valider la série',
    instruction: 'Touche la coche de la première série.',
    detail: 'La validation est écrite immédiatement sur cet appareil.',
  },
  rest: {
    title: 'Lire le repos',
    instruction: 'Laisse le minuteur atteindre la fin du repos.',
    detail: 'Le décompte reste fiable si tu quittes momentanément cet écran.',
  },
  workoutFinish: {
    title: 'Ouvrir le bilan',
    instruction: 'Quand ta séance est terminée, ouvre le bilan.',
    detail: 'Les séries non validées ne seront pas comptées.',
  },
  workoutSave: {
    title: 'Enregistrer la séance',
    instruction: 'Relis le bilan, puis enregistre la séance.',
    detail: 'Elle rejoindra immédiatement ton historique et tes analyses.',
  },
  backupExport: {
    title: 'Exporter une sauvegarde complète',
    instruction: 'Exporte une sauvegarde complète de FitTrack.',
    detail: 'Le fichier contient tes séances, routines, exercices, réglages et progression du tutoriel.',
  },
  backupRestore: {
    title: 'Comprendre une restauration',
    instruction: 'Choisis un fichier de sauvegarde pour ouvrir sa confirmation.',
    detail: 'Tu peux fermer la confirmation : cette mission ne demande pas de restaurer le fichier.',
  },
},
```

- [ ] **Step 5: Implement the pure transition functions**

Create `src/features/tutorial/tutorialMissionMachine.ts`:

```ts
import { isMissionAvailable, missionFor } from './tutorialMissions';
import type { TutorialMissionFacts } from './tutorialMissions';
import type { TutorialEvent, TutorialMissionId, TutorialStateV2 } from './tutorialTypes';

export function startMission(
  state: TutorialStateV2,
  missionId: TutorialMissionId,
): TutorialStateV2 {
  return { ...state, activeMissionId: missionId, activeStepIndex: 0 };
}

export function advanceMission(
  state: TutorialStateV2,
  event: TutorialEvent,
): TutorialStateV2 {
  if (state.activeMissionId === null) return state;
  const mission = missionFor(state.activeMissionId);
  const step = mission.steps[state.activeStepIndex];
  if (step === undefined || !step.advanceWhen(event)) return state;
  if (state.activeStepIndex + 1 < mission.steps.length) {
    return { ...state, activeStepIndex: state.activeStepIndex + 1 };
  }
  return {
    ...state,
    activeMissionId: mission.nextMissionId,
    activeStepIndex: 0,
    missions: { ...state.missions, [mission.id]: 'completed' },
  };
}

export function dismissMission(state: TutorialStateV2): TutorialStateV2 {
  if (state.activeMissionId === null) return state;
  return {
    ...state,
    activeMissionId: null,
    activeStepIndex: 0,
    missions: { ...state.missions, [state.activeMissionId]: 'dismissed' },
  };
}
```

- [ ] **Step 6: Run focused tests and typecheck**

Run: `npm run test:run -- src/features/tutorial/tutorialMissionMachine.test.ts && npm run typecheck`

Expected: 6 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/tutorial/tutorialMissions.ts src/features/tutorial/tutorialMissionMachine.ts src/features/tutorial/tutorialMissionMachine.test.ts src/i18n/fr.ts
git commit -m "feat(tutorial): define p1 mission state machine"
```

---

### Task 3: Ancres génériques et coach de mission non bloquant

**Files:**
- Modify: `src/ui/HeaderAction.tsx`
- Modify: `src/ui/ActionBand.tsx`
- Modify: `src/ui/AddRow.tsx`
- Modify: `src/ui/ListRow.tsx`
- Create: `src/features/tutorial/TutorialMissionCoach.tsx`
- Create: `src/features/tutorial/TutorialMissionCoach.test.tsx`

**Interfaces:**
- Produces: prop optionnel `tutorialId?: string` sur les quatre primitives UI.
- Produces: `TutorialMissionCoach({ mission, stepIndex, onDismiss })`.
- Consumes: `TutorialMission` from Task 2.

- [ ] **Step 1: Write the interaction tests**

Create `src/features/tutorial/TutorialMissionCoach.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { missionFor } from './tutorialMissions';
import { TutorialMissionCoach } from './TutorialMissionCoach';

describe('TutorialMissionCoach', () => {
  it('shows text without requiring a voice clip and leaves the target clickable', async () => {
    const target = vi.fn();
    render(
      <>
        <button data-tutorial-id="routine-create" onClick={target}>Créer</button>
        <TutorialMissionCoach
          mission={missionFor('TUT-ROU-01')}
          stepIndex={0}
          onDismiss={vi.fn()}
        />
      </>,
    );
    expect(screen.getByRole('region', { name: /Mission guidée/ })).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }));
    expect(target).toHaveBeenCalledOnce();
  });

  it('dismisses immediately', async () => {
    const dismiss = vi.fn();
    render(
      <TutorialMissionCoach
        mission={missionFor('TUT-DAT-01')}
        stepIndex={0}
        onDismiss={dismiss}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Passer cette mission' }));
    expect(dismiss).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run RED**

Run: `npm run test:run -- src/features/tutorial/TutorialMissionCoach.test.tsx`

Expected: FAIL because the coach component does not exist.

- [ ] **Step 3: Add neutral anchor props to UI primitives**

For each primitive, extend its props with `tutorialId?: string`, destructure it, and add this attribute to its root interactive element:

```tsx
data-tutorial-id={tutorialId}
```

Use this exact prop and DOM edit in `HeaderAction`, `ActionBand`, `AddRow` and `ListRow` while leaving every existing prop and class unchanged:

```tsx
tutorialId?: string;
// Destructure `tutorialId`, then add this attribute immediately after `type`
// on the existing root element.
data-tutorial-id={tutorialId}
```

Do not spread arbitrary DOM props through these primitives; the single named prop keeps their interfaces explicit.

- [ ] **Step 4: Implement the non-modal coach**

Create `src/features/tutorial/TutorialMissionCoach.tsx` with these rules:

```tsx
import { useEffect, useState } from 'react';
import { t } from '@/i18n/fr';
import type { TutorialMission } from './tutorialMissions';

export function TutorialMissionCoach({
  mission,
  stepIndex,
  onDismiss,
}: {
  mission: TutorialMission;
  stepIndex: number;
  onDismiss: () => void;
}) {
  const step = mission.steps[stepIndex];
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (step === undefined) return;
    const measure = () => {
      const target = document.querySelector<HTMLElement>(
        `[data-tutorial-id="${step.targetId}"]`,
      );
      setRect(target?.getBoundingClientRect() ?? null);
      target?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    };
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [step]);

  if (step === undefined) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[65]" aria-live="polite">
      {rect !== null && (
        <span
          aria-hidden="true"
          className="absolute rounded-2xl ring-2 ring-[var(--accent-ink)] shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
          style={{
            top: Math.max(0, rect.top - 6),
            left: Math.max(0, rect.left - 6),
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}
      <section
        role="region"
        aria-label={t('tutorial.mission.label')}
        className={`pointer-events-auto safe-bottom absolute right-4 left-4 mx-auto max-w-[34rem] rounded-2xl border border-[var(--border)] bg-[var(--surface-1)] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.45)] ${
          rect !== null && rect.top > window.innerHeight / 2 ? 'top-[5rem]' : 'bottom-[4.5rem]'
        }`}
      >
        <p className="label-xs font-semibold text-[var(--accent-ink)]">
          {t('tutorial.mission.counter', {
            index: stepIndex + 1,
            count: mission.steps.length,
          })}
        </p>
        <h2 className="mt-1 text-base font-semibold text-[var(--text-1)]">
          {t(mission.titleKey)}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-1)]">
          {t(step.instructionKey)}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--text-2)]">
          {t(step.detailKey)}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-2 min-h-12 px-2 text-sm font-semibold text-[var(--text-2)]"
        >
          {t('tutorial.mission.dismiss')}
        </button>
      </section>
    </div>
  );
}
```

The outer layer remains `pointer-events-none`; only the coach panel receives pointer events. Do not use `role="dialog"` or `aria-modal`, because the user must act on the real screen.

- [ ] **Step 5: Add the three generic coach strings to the existing `tutorial.mission` object**

```ts
label: 'Mission guidée',
counter: 'Étape {index} sur {count}',
dismiss: 'Passer cette mission',
```

Insert these three leaves before `mission.activation`; do not create a second `mission` property.

- [ ] **Step 6: Run tests and typecheck**

Run: `npm run test:run -- src/features/tutorial/TutorialMissionCoach.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/ui/HeaderAction.tsx src/ui/ActionBand.tsx src/ui/AddRow.tsx src/ui/ListRow.tsx src/features/tutorial/TutorialMissionCoach.tsx src/features/tutorial/TutorialMissionCoach.test.tsx src/i18n/fr.ts
git commit -m "feat(tutorial): add interactive mission coach"
```

---

### Task 4: Contrôleur React, activation et aide propre à la route

**Files:**
- Create: `src/features/tutorial/useTutorialMissions.ts`
- Modify: `src/features/tutorial/tutorialContext.ts`
- Modify: `src/features/tutorial/TutorialProvider.tsx`
- Modify: `src/features/tutorial/TutorialProvider.test.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Consumes: store, machine, catalogue and coach from Tasks 1–3.
- Produces through context: `openHelp()`, `startMission(id)`, `offerMission(id)`, `report(event)`.
- Produces through the hook: state plus `setOrientation`, `chooseActivation`, `start`, `offer`, `report`, `dismiss`.

- [ ] **Step 1: Replace provider tests with v2 expectations first**

Keep the existing narration, contextual orientation and busy-audio tests. Change their setup from a raw v1 value to:

```ts
saveTutorialState({
  ...createTutorialState(),
  orientation: 'completed',
});
```

Add these tests to `TutorialProvider.test.tsx`:

```tsx
it('offers a real activation path after the first orientation choice', async () => {
  const user = userEvent.setup();
  renderTutorial();
  await user.click(await screen.findByRole('button', { name: 'Passer' }));
  await user.click(await screen.findByRole('button', { name: /Sons uniquement/ }));
  expect(await screen.findByRole('dialog', { name: 'Préparer ma première séance' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Choisir un modèle' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Créer ma routine' })).toBeVisible();
});

it('starts the blank-routine mission without creating data', async () => {
  const user = userEvent.setup();
  renderTutorial();
  await user.click(await screen.findByRole('button', { name: 'Passer' }));
  await user.click(await screen.findByRole('button', { name: /Sons uniquement/ }));
  await user.click(await screen.findByRole('button', { name: 'Créer ma routine' }));
  const state = loadTutorialState();
  expect(state.activationPath).toBe('blank');
  expect(state.activeMissionId).toBe('TUT-ROU-01');
});

it('lists route-specific missions before the full orientation replay', async () => {
  saveTutorialState({ ...createTutorialState(), orientation: 'completed' });
  const user = userEvent.setup();
  renderTutorial('/settings');
  await user.click(screen.getByRole('button', { name: 'Aide sur cette page' }));
  expect(screen.getByRole('button', { name: 'Exporter une sauvegarde complète' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Comprendre une restauration' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Recommencer la visite complète' })).toBeVisible();
});

it('keeps a mission fully readable in Silence without requesting narration', async () => {
  localStorage.setItem(ANNOUNCER_STORAGE_KEY, 'silence');
  saveTutorialState({
    ...createTutorialState(),
    orientation: 'completed',
    activeMissionId: 'TUT-DAT-01',
  });
  renderTutorial('/settings');
  expect(await screen.findByRole('region', { name: 'Mission guidée' })).toBeVisible();
  expect(screen.getByText('Exporte une sauvegarde complète de FitTrack.')).toBeVisible();
  expect(playTutorialNarrationMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run RED**

Run: `npm run test:run -- src/features/tutorial/TutorialProvider.test.tsx`

Expected: the three new tests FAIL.

- [ ] **Step 3: Implement the persistent mission controller hook**

Create `src/features/tutorial/useTutorialMissions.ts`:

```ts
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { NavigateFunction } from 'react-router-dom';
import { advanceMission, dismissMission, startMission } from './tutorialMissionMachine';
import { missionFor } from './tutorialMissions';
import { loadTutorialState, saveTutorialState } from './tutorialStore';
import type {
  TutorialActivationPath,
  TutorialCompletion,
  TutorialEvent,
  TutorialMissionId,
  TutorialStateV2,
} from './tutorialTypes';

export function useTutorialMissions(
  pathname: string,
  navigate: NavigateFunction,
  facts: TutorialMissionFacts,
) {
  const [state, setState] = useState<TutorialStateV2>(loadTutorialState);

  const commit = useCallback((change: (current: TutorialStateV2) => TutorialStateV2) => {
    setState((current) => {
      const next = change(current);
      if (next !== current) saveTutorialState(next);
      return next;
    });
  }, []);

  const start = useCallback(
    (missionId: TutorialMissionId) =>
      commit((current) =>
        isMissionAvailable(missionFor(missionId), facts)
          ? startMission(current, missionId)
          : current,
      ),
    [commit, facts],
  );
  const offer = useCallback(
    (missionId: TutorialMissionId) =>
      commit((current) =>
        current.activeMissionId !== null || current.missions[missionId] !== undefined
          ? current
          : startMission(current, missionId),
      ),
    [commit],
  );
  const report = useCallback(
    (event: TutorialEvent) => commit((current) => advanceMission(current, event)),
    [commit],
  );
  const dismiss = useCallback(() => commit(dismissMission), [commit]);
  const setOrientation = useCallback(
    (orientation: TutorialCompletion) =>
      commit((current) => ({ ...current, orientation })),
    [commit],
  );
  const chooseActivation = useCallback(
    (activationPath: TutorialActivationPath | null) =>
      commit((current) => ({ ...current, activationPath })),
    [commit],
  );

  const activeMission = useMemo(
    () => (state.activeMissionId === null ? null : missionFor(state.activeMissionId)),
    [state.activeMissionId],
  );

  useEffect(() => {
    if (activeMission === null || activeMission.routePrefix === '/') return;
    if (!pathname.startsWith(activeMission.routePrefix)) navigate(activeMission.routePrefix);
  }, [activeMission, navigate, pathname]);

  useEffect(() => {
    if (
      activeMission === null ||
      activeMission.guard === 'always' ||
      activeMission.guard === 'external' ||
      facts.hasActiveWorkout === null ||
      isMissionAvailable(activeMission, facts)
    ) {
      return;
    }
    const timer = window.setTimeout(() => {
      commit((current) =>
        current.activeMissionId === activeMission.id ? dismissMission(current) : current,
      );
    }, 500);
    return () => window.clearTimeout(timer);
  }, [activeMission, commit, facts]);

  return {
    state,
    activeMission,
    start,
    offer,
    report,
    dismiss,
    setOrientation,
    chooseActivation,
  };
}
```

- [ ] **Step 4: Expand the context without exposing state mutation**

Replace `TutorialControls` in `tutorialContext.ts` with:

```ts
import type { TutorialEvent, TutorialMissionId } from './tutorialTypes';

export interface TutorialControls {
  openHelp: () => void;
  startMission: (missionId: TutorialMissionId) => void;
  offerMission: (missionId: TutorialMissionId) => void;
  report: (event: TutorialEvent) => void;
}
```

Keep `TutorialContext` and `useTutorialControls()` unchanged.

- [ ] **Step 5: Integrate missions into `TutorialProvider`**

Make these exact behavioral changes:

1. Initialize `phase` from `loadTutorialState().orientation` instead of the v1 completion function.
2. Add `'activation'` to `Phase`.
3. Read the active workout through its repository and pass a memoized tri-state guard into the controller:

```ts
const activeWorkout = useLiveQuery(async () => (await getActiveWorkout()) ?? null);
const missionFacts = useMemo(
  () => ({
    hasActiveWorkout: activeWorkout === undefined ? null : activeWorkout !== null,
  }),
  [activeWorkout],
);
const missions = useTutorialMissions(pathname, navigate, missionFacts);
```

Import `useLiveQuery` from `dexie-react-hooks` and `getActiveWorkout` from the workouts repository. A `null` fact means “not loaded yet” and makes guarded mission starts no-op rather than guessing.

Move the `TutorialCompletion` type import from `tutorialStore` to `tutorialTypes`; after Step 9, `tutorialStore` exports only v2 state functions and storage-key constants.
4. In `chooseAudio`, replace `saveTutorialCompletion(completion)` with this exact first-run branch; migrated v1 users stay idle because their orientation was already non-null when the provider mounted:

```ts
const firstRun = missions.state.orientation === null;
missions.setOrientation(completion);
setPhase(firstRun ? 'activation' : 'idle');
```
5. Provide all three context controls:

```ts
const controls = useMemo<TutorialControls>(
  () => ({
    openHelp: () => phase === 'idle' && setPhase('help'),
    startMission: missions.start,
    offerMission: missions.offer,
    report: missions.report,
  }),
  [missions.offer, missions.report, missions.start, phase],
);
```

6. Render this activation sheet:

```tsx
<Sheet
  open={phase === 'activation'}
  onClose={() => setPhase('idle')}
  title={t('tutorial.activation.title')}
>
  <p className="text-sm leading-relaxed text-[var(--text-2)]">
    {t('tutorial.activation.body')}
  </p>
  <div className="mt-5 flex flex-col gap-2">
    <Button
      variant="primary"
      size="lg"
      fullWidth
      onClick={() => {
        missions.chooseActivation('template');
        missions.start('TUT-ACT-01');
        setPhase('idle');
      }}
    >
      {t('tutorial.activation.template')}
    </Button>
    <Button
      size="lg"
      fullWidth
      onClick={() => {
        missions.chooseActivation('blank');
        missions.start('TUT-ROU-01');
        setPhase('idle');
      }}
    >
      {t('tutorial.activation.blank')}
    </Button>
    <Button variant="ghost" size="lg" fullWidth onClick={() => setPhase('idle')}>
      {t('tutorial.activation.later')}
    </Button>
  </div>
</Sheet>
```

7. Prepend `contextualMissionsForPath(pathname, missions.state, missionFacts).slice(0, 3)` to the help actions. Each action uses `t(mission.titleKey)` and calls `missions.start(mission.id)`. Keep page explanation and full orientation replay after those mission actions.
8. Render the coach after sheets and before the orientation overlay:

```tsx
{missions.activeMission !== null && phase === 'idle' && (
  <TutorialMissionCoach
    mission={missions.activeMission}
    stepIndex={missions.state.activeStepIndex}
    onDismiss={missions.dismiss}
  />
)}
```

9. Remove `loadTutorialCompletion` and `saveTutorialCompletion` from `tutorialStore.ts`; no production caller remains after this provider migration.

- [ ] **Step 6: Add the activation choice copy to `fr.ts`**

Under `tutorial`, add `activation` beside the complete `mission` object from Tasks 2–3:

```ts
activation: {
  title: 'Préparer ma première séance',
  body: 'Choisis un point de départ. FitTrack te laissera effectuer chaque geste sur tes propres données.',
  template: 'Choisir un modèle',
  blank: 'Créer ma routine',
  later: 'Plus tard',
},
```

- [ ] **Step 7: Run provider, store and machine tests**

Run: `npm run test:run -- src/features/tutorial && npm run typecheck`

Expected: all tutorial tests PASS and no v1 provider import remains.

- [ ] **Step 8: Commit**

```bash
git add src/features/tutorial/useTutorialMissions.ts src/features/tutorial/tutorialContext.ts src/features/tutorial/TutorialProvider.tsx src/features/tutorial/TutorialProvider.test.tsx src/i18n/fr.ts
git commit -m "feat(tutorial): add activation and route-aware help"
```

---

### Task 5: Missions de création et configuration d'une routine

**Files:**
- Modify: `src/features/routines/RoutinesScreen.tsx`
- Modify: `src/features/routines/ExercisePickerScreen.tsx`
- Modify: `src/features/routines/RoutineEditorScreen.tsx`
- Modify: `src/features/routines/RoutineExerciseCard.tsx`
- Modify: `src/features/routines/RoutineFlow.integration.test.tsx`

**Interfaces:**
- Consumes: `useTutorialControls().report` and UI `tutorialId` from earlier tasks.
- Produces events: `routine-created`, `routine-opened`, `routine-exercise-added`, `routine-set-added`, `routine-target-updated`, `routine-rest-updated`, `workout-started`.
- Produces anchors: `routine-create`, `routine-add-exercise`, `routine-add-set`, `routine-first-set`, `routine-exercise-menu`, `routine-start`.

- [ ] **Step 1: Add failing integration assertions**

In `RoutineFlow.integration.test.tsx`, change the helper signature to `renderRoutineFlow(initialEntry = '/routines', report = vi.fn())` and wrap its router in:

```tsx
<TutorialContext.Provider
  value={{
    openHelp: vi.fn(),
    startMission: vi.fn(),
    offerMission: vi.fn(),
    report,
  }}
>
  <MemoryRouter initialEntries={[initialEntry]}>
    <Routes>
      <Route path="/routines" element={<RoutinesScreen />} />
      <Route path="/routines/:id" element={<RoutineEditorScreen />} />
      <Route path="/routines/:id/add" element={<ExercisePickerScreen />} />
      <Route path="/programs" element={<p>Liste des programmes</p>} />
    </Routes>
  </MemoryRouter>
</TutorialContext.Provider>
```

Add two tests:

```tsx
it('reports creation, exercise addition and routine start only after repository success', async () => {
  const report = vi.fn();
  const user = userEvent.setup();
  renderRoutineFlow('/routines', report);
  await user.click(screen.getByRole('button', { name: t('routines.create') }));
  await user.click(screen.getByRole('button', { name: t('routines.newBlank') }));
  await waitFor(() =>
    expect(report).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'routine-created' }),
    ),
  );
  expect(document.querySelector('[data-tutorial-id="routine-add-exercise"]')).not.toBeNull();
});

it('marks the first set, exercise menu and start band with exact anchors', async () => {
  const exercise = await createCustomExercise({
    name: 'Développé guidé',
    primaryMuscle: 'chest',
    secondaryMuscles: [],
    equipment: 'machine',
    measurementType: 'weight_reps',
    isUnilateral: 0,
  });
  const routine = await createRoutine('Poussée');
  await addExercisesToRoutine(routine.id, [exercise.id]);
  renderRoutineFlow(`/routines/${routine.id}`);
  expect(document.querySelector('[data-tutorial-id="routine-first-set"]')).not.toBeNull();
  expect(document.querySelector('[data-tutorial-id="routine-add-set"]')).not.toBeNull();
  expect(document.querySelector('[data-tutorial-id="routine-exercise-menu"]')).not.toBeNull();
  expect(document.querySelector('[data-tutorial-id="routine-start"]')).not.toBeNull();
});
```

- [ ] **Step 2: Run RED**

Run: `npm run test:run -- src/features/routines/RoutineFlow.integration.test.tsx`

Expected: new event and anchor assertions FAIL.

- [ ] **Step 3: Instrument routine creation without moving repository writes**

In `RoutinesScreen`, read the context once:

```ts
const tutorial = useTutorialControls();
```

Change blank creation to report after the promise resolves:

```ts
const startBlank = () => {
  void createRoutine(t('routines.defaultName')).then((routine) => {
    tutorial?.report({ type: 'routine-created', routineId: routine.id });
    openEditor(routine);
  });
};
```

Change routine start in both `RoutinesScreen` and `RoutineEditorScreen` to retain the returned workout:

```ts
void startWorkoutFromRoutine(routineId).then((workout) => {
  tutorial?.report({
    type: 'workout-started',
    workoutId: workout.id,
    routineId,
  });
  navigate('/workout');
});
```

Pass `tutorialId="routine-create"` to the create `HeaderAction` and `tutorialId="routine-start"` to the editor's `ActionBand`.

- [ ] **Step 4: Report exercise addition after persistence**

In `ExercisePickerScreen`, change `add` to:

```ts
const tutorial = useTutorialControls();

const add = () => {
  void addExercisesToRoutine(id, selected).then(() => {
    tutorial?.report({
      type: 'routine-exercise-added',
      routineId: id,
      count: selected.length,
    });
    navigate(-1);
  });
};
```

Pass `tutorialId="routine-add-exercise"` to the `AddRow` in `RoutineEditorScreen`, not to the picker footer: the mission must point at the entry into the picker.

- [ ] **Step 5: Mark only the first exercise and first set**

Extend `RoutineExerciseCard` props with `tutorial?: boolean`. Apply:

```tsx
data-tutorial-id={tutorial ? 'routine-exercise-menu' : undefined}
```

to its exercise options button, and:

```tsx
data-tutorial-id={tutorial && number === 1 ? 'routine-first-set' : undefined}
```

to `SetRow`'s root button. Pass `tutorial={index === 0}` from `RoutineEditorScreen`'s `renderItem` callback; rename `_index` to `index`.

Also pass `tutorialId={tutorial ? 'routine-add-set' : undefined}` to the card's `AddRow`. Extend `AddRow` already supports this prop from Task 3. Change the editor callback so the event is emitted only after the copied set exists:

```ts
onAddSet={() => {
  void addRoutineSet(line.row.id).then((set) => {
    tutorial?.report({ type: 'routine-set-added', routineId: routine.id, setId: set.id });
  });
}}
```

- [ ] **Step 6: Report target and rest writes from their existing callbacks**

In `RoutineEditorScreen`, keep the repository call first and report from its resolution:

```ts
const saveSetTargets = (setId: string, changes: RoutineSetTargets) => {
  void updateRoutineSet(setId, changes).then(() => {
    const hasTarget = Object.entries(changes).some(
      ([key, value]) => key.startsWith('target') && typeof value === 'number',
    );
    if (hasTarget) tutorial?.report({ type: 'routine-target-updated', routineId: routine.id });
  });
};
```

Use `saveSetTargets(sheet.setId, changes)` in `RoutineSetSheet.onSave`.

For the exercise sheet:

```ts
const saveExerciseChanges = (rowId: string, changes: { restSeconds?: number; notes?: string }) => {
  void updateRoutineExercise(rowId, changes).then(() => {
    if (changes.restSeconds !== undefined) {
      tutorial?.report({
        type: 'routine-rest-updated',
        routineId: routine.id,
        seconds: changes.restSeconds,
      });
    }
  });
};
```

Use it in `RoutineExerciseSheet.onWrite`.

Add a `useEffect` that reports `routine-opened` only when `detail` is loaded for the current `id`:

```ts
useEffect(() => {
  if (detail?.routine.id === id) {
    tutorial?.report({ type: 'routine-opened', routineId: id });
  }
}, [detail?.routine.id, id, tutorial]);
```

If the context object identity makes this effect repeat, depend on `tutorial?.report` instead of the object.

- [ ] **Step 7: Run routine tests and typecheck**

Run: `npm run test:run -- src/features/routines && npm run typecheck`

Expected: routine component and integration tests PASS; repository behavior remains unchanged.

- [ ] **Step 8: Commit**

```bash
git add src/features/routines/RoutinesScreen.tsx src/features/routines/ExercisePickerScreen.tsx src/features/routines/RoutineEditorScreen.tsx src/features/routines/RoutineExerciseCard.tsx src/features/routines/RoutineFlow.integration.test.tsx
git commit -m "feat(tutorial): guide routine creation"
```

---

### Task 6: Première série, repos, fin de séance et récupération sûre

**Files:**
- Create: `src/app/staleWorkout.ts`
- Create: `src/app/staleWorkout.test.ts`
- Create: `src/app/ActiveWorkoutRecoverySheet.tsx`
- Create: `src/app/ActiveWorkoutRecoverySheet.test.tsx`
- Modify: `src/app/ActiveWorkoutBar.tsx`
- Modify: `src/features/workout/WorkoutSetRow.tsx`
- Modify: `src/features/workout/WorkoutExerciseCard.tsx`
- Modify: `src/features/workout/WorkoutScreen.tsx`
- Modify: `src/features/workout/WorkoutFinishScreen.tsx`
- Modify: `src/features/workout/WorkoutScreen.integration.test.tsx`
- Modify: `src/features/workout/WorkoutFinishScreen.test.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Produces: `STALE_WORKOUT_MS`, `isWorkoutStale(startedAt, now?)`.
- Produces: explicit recovery choices `resume | finish | discard`; discard remains behind confirmation.
- Produces events: `workout-set-written`, `workout-set-completed`, `rest-finished`, `workout-finish-opened`, `workout-saved`, `stale-workout-choice`.
- Produces anchors: `active-workout-bar`, `workout-first-set`, `workout-first-set-complete`, `workout-rest`, `workout-finish`, `workout-save`.

- [ ] **Step 1: Write stale-workout boundary tests**

Create `src/app/staleWorkout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { STALE_WORKOUT_MS, isWorkoutStale } from './staleWorkout';

describe('isWorkoutStale', () => {
  const now = 2_000_000_000_000;

  it('keeps a workout younger than twelve hours on the direct resume path', () => {
    expect(isWorkoutStale(now - STALE_WORKOUT_MS + 1, now)).toBe(false);
  });

  it('offers recovery at twelve hours and after', () => {
    expect(isWorkoutStale(now - STALE_WORKOUT_MS, now)).toBe(true);
    expect(isWorkoutStale(now - 48 * 60 * 60 * 1_000, now)).toBe(true);
  });
});
```

- [ ] **Step 2: Write recovery UI tests**

Create `src/app/ActiveWorkoutRecoverySheet.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActiveWorkoutRecoverySheet } from './ActiveWorkoutRecoverySheet';

describe('ActiveWorkoutRecoverySheet', () => {
  it('resumes without discarding anything', async () => {
    const resume = vi.fn();
    const discard = vi.fn();
    render(
      <ActiveWorkoutRecoverySheet
        open
        workoutName="Poussée"
        validatedSetCount={2}
        onClose={vi.fn()}
        onResume={resume}
        onFinish={vi.fn()}
        onDiscard={discard}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Reprendre la séance' }));
    expect(resume).toHaveBeenCalledOnce();
    expect(discard).not.toHaveBeenCalled();
  });

  it('requires a counted confirmation before discard', async () => {
    const discard = vi.fn();
    render(
      <ActiveWorkoutRecoverySheet
        open
        workoutName="Poussée"
        validatedSetCount={2}
        onClose={vi.fn()}
        onResume={vi.fn()}
        onFinish={vi.fn()}
        onDiscard={discard}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Abandonner la séance' }));
    expect(screen.getByText(/2 séries validées/)).toBeVisible();
    expect(discard).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Confirmer l’abandon' }));
    expect(discard).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: Run RED**

Run: `npm run test:run -- src/app/staleWorkout.test.ts src/app/ActiveWorkoutRecoverySheet.test.tsx`

Expected: FAIL because both modules are absent.

- [ ] **Step 4: Implement the pure age rule**

Create `src/app/staleWorkout.ts`:

```ts
export const STALE_WORKOUT_MS = 12 * 60 * 60 * 1_000;

export function isWorkoutStale(startedAt: number, now = Date.now()): boolean {
  return now - startedAt >= STALE_WORKOUT_MS;
}
```

- [ ] **Step 5: Implement the recovery sheet**

Create `ActiveWorkoutRecoverySheet.tsx` with one internal `confirmingDiscard` boolean. Render a normal `Sheet` while choosing and the existing `ConfirmSheet` only while confirming; never stack two open sheets:

```tsx
import { useEffect, useState } from 'react';
import { t } from '@/i18n/fr';
import { Button, ConfirmSheet, Sheet } from '@/ui';

export function ActiveWorkoutRecoverySheet({
  open,
  workoutName,
  validatedSetCount,
  onClose,
  onResume,
  onFinish,
  onDiscard,
}: {
  open: boolean;
  workoutName: string;
  validatedSetCount: number;
  onClose: () => void;
  onResume: () => void;
  onFinish: () => void;
  onDiscard: () => void;
}) {
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  useEffect(() => {
    if (!open) setConfirmingDiscard(false);
  }, [open]);

  const discardBody =
    validatedSetCount === 0
      ? t('tutorial.recovery.discardBodyNone')
      : validatedSetCount === 1
        ? t('tutorial.recovery.discardBodyOne')
        : t('tutorial.recovery.discardBody', { count: validatedSetCount });

  return (
    <>
      <Sheet
        open={open && !confirmingDiscard}
        onClose={onClose}
        title={t('tutorial.recovery.title')}
      >
        <p className="text-base font-semibold text-[var(--text-1)]">{workoutName}</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">
          {t('tutorial.recovery.body')}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button variant="primary" size="lg" fullWidth onClick={onResume}>
            {t('tutorial.recovery.resume')}
          </Button>
          <Button size="lg" fullWidth onClick={onFinish}>
            {t('tutorial.recovery.finish')}
          </Button>
          <Button
            variant="danger"
            size="lg"
            fullWidth
            onClick={() => setConfirmingDiscard(true)}
          >
            {t('tutorial.recovery.discard')}
          </Button>
        </div>
      </Sheet>

      <ConfirmSheet
        open={open && confirmingDiscard}
        onClose={() => setConfirmingDiscard(false)}
        title={t('tutorial.recovery.discardTitle')}
        body={discardBody}
        confirmLabel={t('tutorial.recovery.discardConfirm')}
        danger
        onConfirm={() => {
          setConfirmingDiscard(false);
          onDiscard();
        }}
      />
    </>
  );
}
```

`onConfirm` calls `onDiscard`; it does not call a repository directly. This keeps the component testable and the write owned by `ActiveWorkoutBar`.

- [ ] **Step 6: Refactor the active bar without changing the young-workout path**

In `ActiveWorkoutBar`:

1. Keep the current `<Link to="/workout">` for workouts younger than 12 hours.
2. For a stale workout, render a `<button>` with the same full class string and `data-tutorial-id="active-workout-bar"`.
3. On click, call `tutorial?.offerMission('TUT-REC-01')`, then open `ActiveWorkoutRecoverySheet`. `offerMission` is idempotent and does not restart a completed or dismissed mission.
4. Read `getWorkoutDetail(active.id)` with `useLiveQuery` and count only sets where `isCompleted === 1 && deletedAt === 0`.
5. Wire choices exactly:

```ts
const choose = (choice: 'resume' | 'finish') => {
  tutorial?.report({ type: 'stale-workout-choice', workoutId: active.id, choice });
  setRecoveryOpen(false);
  navigate(choice === 'resume' ? '/workout' : '/workout/finish');
};

const discard = () => {
  void discardWorkout(active.id).then(() => {
    tutorial?.report({
      type: 'stale-workout-choice',
      workoutId: active.id,
      choice: 'discard',
    });
    setRecoveryOpen(false);
    navigate('/', { replace: true });
  });
};
```

No timeout or effect may call `discardWorkout`.

- [ ] **Step 7: Add recovery copy**

Under `tutorial`, add:

```ts
recovery: {
  title: 'Séance toujours en cours',
  body: 'Cette séance a commencé il y a plus de douze heures. Choisis ce que tu veux en faire.',
  resume: 'Reprendre la séance',
  finish: 'Voir le bilan et terminer',
  discard: 'Abandonner la séance',
  discardTitle: 'Abandonner cette séance ?',
  discardBodyNone: 'Aucune série validée ne sera conservée.',
  discardBodyOne: 'La série validée ne sera pas conservée.',
  discardBody: '{count} séries validées ne seront pas conservées.',
  discardConfirm: 'Confirmer l’abandon',
},
```

- [ ] **Step 8: Carry exact first-set anchors through workout components**

Extend `WorkoutExerciseCard` with `tutorial?: boolean` and pass it from `WorkoutScreen` only for `index === 0`. Extend `WorkoutSetRow` with:

```ts
tutorial?: boolean;
onWrite: (values: Partial<SetValues>, recordable: boolean) => void;
```

On the row root:

```tsx
data-tutorial-id={tutorial ? 'workout-first-set' : undefined}
```

On the complete button:

```tsx
data-tutorial-id={tutorial ? 'workout-first-set-complete' : undefined}
```

Add a local writer that evaluates the merged values before delegating:

```ts
const write = (values: Partial<SetValues>) => {
  const next: ResolvedValues = { ...resolved };
  const apply = (field: keyof ResolvedValues, key: keyof SetValues) => {
    if (!(key in values)) return;
    const value = values[key];
    if (typeof value === 'number') next[field] = value;
    else delete next[field];
  };
  apply('weight', 'weight');
  apply('reps', 'reps');
  apply('duration', 'durationSeconds');
  apply('distance', 'distanceMeters');
  onWrite(values, isSetRecordable(columns, next));
};
```

Use `write` for both the previous-value button and each `SetValueCell.onChange`. Pass the boolean through `WorkoutExerciseCard` to `WorkoutScreen`.

- [ ] **Step 9: Report workout events after successful writes**

In `WorkoutScreen`:

```ts
const tutorial = useTutorialControls();
```

Change the write callback to:

```ts
onWrite={(setId, values, recordable) => {
  void updateSetValues(setId, values).then(() => {
    tutorial?.report({ type: 'workout-set-written', setId, recordable });
  });
  pace.armFromTypedReps(line, setId, values.reps);
}}
```

Keep rest/audio behavior immediate, but report validation after persistence:

```ts
void completeSet(setId, values).then(() => {
  tutorial?.report({ type: 'workout-set-completed', setId });
});
```

Inside `renderItem`, capture the narrowed active rest ID before constructing the card props:

```ts
const activeRestSetId =
  rest.setId !== null && line.sets.some((set) => set.id === rest.setId) ? rest.setId : null;
```

Use `activeRestSetId !== null` to build the existing `rest` prop. In its `onDone`, report before handing the clock to pace:

```ts
tutorial?.report({ type: 'rest-finished', setId: activeRestSetId });
```

Apply `data-tutorial-id="workout-rest"` to the exercise card wrapper only while its `rest` prop is non-null. Pass `tutorialId="workout-finish"` to the footer `ActionBand`; its click first reports `workout-finish-opened` with the active workout ID and then navigates.

- [ ] **Step 10: Report the final save only after `finishWorkout` succeeds**

In `WorkoutFinishScreen`, pass `tutorialId="workout-save"` to the footer `ActionBand`. Insert the event after the durable write and before coach finalization:

```ts
void finishWorkout(workout.id)
  .then(() => {
    tutorial?.report({ type: 'workout-saved', workoutId: workout.id });
    return finalizeCoachForWorkout(workout.id).catch(() => undefined);
  })
  .then(() => navigate('/', { replace: true }));
```

The existing `discardWorkout` path remains unchanged; a normal finish-screen discard does not masquerade as a completed first-session mission.

- [ ] **Step 11: Add/adjust focused workout tests**

In `WorkoutScreen.integration.test.tsx`, assert that:

- a partial numeric edit reports `recordable: false`;
- a complete first row reports `recordable: true` only after `updateSetValues` resolves;
- validating reports `workout-set-completed` and starts rest;
- expiry reports `rest-finished`;
- the first row and footer carry exact anchors.

Wrap the workout route in a `TutorialContext.Provider` using the same complete four-control value as Task 5 (`openHelp`, `startMission`, `offerMission`, `report`). Pass the per-test report mock into that helper; do not mock the context module.

In `WorkoutFinishScreen.test.tsx`, inject a context reporter and assert `workout-saved` occurs after the workout status is `completed`, never on discard.

Run: `npm run test:run -- src/app src/features/workout && npm run typecheck`

Expected: all focused tests PASS.

- [ ] **Step 12: Commit**

```bash
git add src/app/staleWorkout.ts src/app/staleWorkout.test.ts src/app/ActiveWorkoutRecoverySheet.tsx src/app/ActiveWorkoutRecoverySheet.test.tsx src/app/ActiveWorkoutBar.tsx src/features/workout/WorkoutSetRow.tsx src/features/workout/WorkoutExerciseCard.tsx src/features/workout/WorkoutScreen.tsx src/features/workout/WorkoutFinishScreen.tsx src/features/workout/WorkoutScreen.integration.test.tsx src/features/workout/WorkoutFinishScreen.test.tsx src/i18n/fr.ts
git commit -m "feat(tutorial): guide workout and safe recovery"
```

---

### Task 7: Missions de sécurité des données

**Files:**
- Modify: `src/features/settings/BackupActions.tsx`
- Modify: `src/features/settings/BackupActions.test.tsx`

**Interfaces:**
- Consumes: `tutorialId` on `ListRow` and `useTutorialControls().report`.
- Produces events: `backup-exported` only for `shared | downloaded`; `restore-confirmation-opened` only after parsing a valid file.
- Produces anchors: `backup-export`, `backup-restore`.

- [ ] **Step 1: Write failing event tests**

Add a `TutorialContext.Provider` test helper around `BackupActions`. Add:

```tsx
function renderBackupActions(report = vi.fn(), reload = vi.fn()) {
  return render(
    <TutorialContext.Provider
      value={{
        openHelp: vi.fn(),
        startMission: vi.fn(),
        offerMission: vi.fn(),
        report,
      }}
    >
      <BackupActions reload={reload} />
    </TutorialContext.Provider>,
  );
}
```

Then add:

```tsx
it('reports a successful export but not a failed save', async () => {
  const report = vi.fn();
  saveTextFileMock.mockResolvedValueOnce('downloaded');
  renderBackupActions(report);
  await userEvent.click(screen.getByRole('button', { name: /Exporter tout le compte/ }));
  await waitFor(() =>
    expect(report).toHaveBeenCalledWith({
      type: 'backup-exported',
      outcome: 'downloaded',
    }),
  );
  report.mockClear();
  saveTextFileMock.mockResolvedValueOnce('failed');
  await userEvent.click(screen.getByRole('button', { name: /Exporter tout le compte/ }));
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/n’a pas pu/));
  expect(report).not.toHaveBeenCalled();
});

it('completes the restore lesson at confirmation, without restoring', async () => {
  const report = vi.fn();
  const restoreSpy = vi.spyOn(backupRepository, 'restoreBackup');
  renderBackupActions(report);
  await chooseFile(userEvent.setup(), jsonFile(serializeBackup(await buildBackup())));
  expect(await screen.findByRole('dialog', { name: /Restaurer cette sauvegarde/ })).toBeVisible();
  expect(report).toHaveBeenCalledWith({ type: 'restore-confirmation-opened' });
  expect(restoreSpy).not.toHaveBeenCalled();
});
```

If the test currently imports named repository functions, change it to `import * as backupRepository` so the spy observes the same module binding.

- [ ] **Step 2: Run RED**

Run: `npm run test:run -- src/features/settings/BackupActions.test.tsx`

Expected: new event assertions FAIL.

- [ ] **Step 3: Instrument successful outcomes only**

Read the context once in `BackupActions`:

```ts
const tutorial = useTutorialControls();
```

After `saveTextFile` resolves:

```ts
if (outcome === 'failed') fail('settings.backupExportFailed');
else if (outcome === 'shared' || outcome === 'downloaded') {
  tutorial?.report({ type: 'backup-exported', outcome });
  if (outcome === 'downloaded') {
    setNotice({ text: t('settings.backupExportDownloaded'), failed: false });
  }
}
```

The `cancelled` outcome intentionally emits no success event and no error notice. Do not cast the union.

After a valid parse and immediately after `setPending`:

```ts
tutorial?.report({ type: 'restore-confirmation-opened' });
```

Do not report for unreadable, invalid, empty or future-version files.

- [ ] **Step 4: Add exact anchors**

Pass `tutorialId="backup-export"` and `tutorialId="backup-restore"` to the corresponding `ListRow` components.

- [ ] **Step 5: Run settings and tutorial tests**

Run: `npm run test:run -- src/features/settings/BackupActions.test.tsx src/features/tutorial && npm run typecheck`

Expected: PASS; confirmation can be closed without any database write.

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/BackupActions.tsx src/features/settings/BackupActions.test.tsx
git commit -m "feat(tutorial): guide backup safety"
```

---

### Task 8: Parcours intégré, reprise après fermeture et sauvegarde du tutoriel

**Files:**
- Create: `src/features/tutorial/TutorialFirstSession.integration.test.ts`
- Modify: `src/data/repositories/backup.test.ts`
- Modify: `src/audio/voicePack.test.ts`

**Interfaces:**
- Verifies the complete chain from `TUT-ROU-01` through `TUT-DAT-02`.
- Verifies a persisted mid-mission step resumes exactly.
- Verifies `fittrack:tutorial:v2` survives full backup/restore.
- Verifies text-only missions do not expand the current 43-clip pack.

- [ ] **Step 1: Write the full machine-flow integration test**

Create `src/features/tutorial/TutorialFirstSession.integration.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { advanceMission, startMission } from './tutorialMissionMachine';
import { createTutorialState, loadTutorialState, saveTutorialState } from './tutorialStore';

describe('first-session tutorial flow', () => {
  it('reaches data safety only through observed user outcomes', () => {
    let state = startMission(createTutorialState(), 'TUT-ROU-01');
    state = advanceMission(state, { type: 'routine-created', routineId: 'routine-1' });
    state = advanceMission(state, {
      type: 'routine-exercise-added',
      routineId: 'routine-1',
      count: 1,
    });
    state = advanceMission(state, {
      type: 'routine-set-added',
      routineId: 'routine-1',
      setId: 'planned-set-2',
    });
    state = advanceMission(state, { type: 'routine-target-updated', routineId: 'routine-1' });
    state = advanceMission(state, {
      type: 'routine-rest-updated',
      routineId: 'routine-1',
      seconds: 90,
    });
    state = advanceMission(state, {
      type: 'workout-started',
      workoutId: 'workout-1',
      routineId: 'routine-1',
    });
    state = advanceMission(state, {
      type: 'workout-set-written',
      setId: 'set-1',
      recordable: true,
    });
    state = advanceMission(state, { type: 'workout-set-completed', setId: 'set-1' });
    state = advanceMission(state, { type: 'rest-finished', setId: 'set-1' });
    state = advanceMission(state, { type: 'workout-finish-opened', workoutId: 'workout-1' });
    state = advanceMission(state, { type: 'workout-saved', workoutId: 'workout-1' });
    state = advanceMission(state, { type: 'backup-exported', outcome: 'downloaded' });
    state = advanceMission(state, { type: 'restore-confirmation-opened' });

    expect(state.activeMissionId).toBeNull();
    expect(state.missions).toMatchObject({
      'TUT-ROU-01': 'completed',
      'TUT-ROU-02': 'completed',
      'TUT-ROU-03': 'completed',
      'TUT-ROU-04': 'completed',
      'TUT-WRK-01': 'completed',
      'TUT-WRK-02': 'completed',
      'TUT-WRK-03': 'completed',
      'TUT-WRK-04': 'completed',
      'TUT-DAT-01': 'completed',
      'TUT-DAT-02': 'completed',
    });
  });

  it('resumes the second step of a mission after a reload', () => {
    const started = startMission(createTutorialState(), 'TUT-ROU-03');
    const targeted = advanceMission(started, {
      type: 'routine-target-updated',
      routineId: 'routine-1',
    });
    saveTutorialState(targeted);
    expect(loadTutorialState()).toMatchObject({
      activeMissionId: 'TUT-ROU-03',
      activeStepIndex: 1,
    });
  });
});
```

- [ ] **Step 2: Run the flow test**

Run: `npm run test:run -- src/features/tutorial/TutorialFirstSession.integration.test.ts`

Expected: PASS. If it fails, fix the catalogue/transition mismatch rather than weakening the expected completed IDs.

- [ ] **Step 3: Pin tutorial progress inside full backup/restore**

In `src/data/repositories/backup.test.ts`, add:

```ts
it('round-trips the namespaced tutorial v2 progress', async () => {
  const tutorial = JSON.stringify({
    version: 2,
    scriptVersion: 1,
    orientation: 'completed',
    activationPath: 'blank',
    activeMissionId: 'TUT-WRK-02',
    activeStepIndex: 0,
    missions: { 'TUT-ROU-01': 'completed' },
  });
  localStorage.setItem('fittrack:tutorial:v2', tutorial);
  const backup = await buildBackup();
  localStorage.removeItem('fittrack:tutorial:v2');
  await restoreBackup(backup);
  expect(localStorage.getItem('fittrack:tutorial:v2')).toBe(tutorial);
});
```

This test should pass through the existing `fittrack:` preference rule. If it does not, fix the repository's namespace filter; do not special-case the tutorial key.

- [ ] **Step 4: Pin the pre-voice state**

In `voicePack.test.ts`, import `P1_MISSIONS` and add:

```ts
it('keeps new missions text-only until the dedicated voice phase', () => {
  expect(P1_MISSIONS.flatMap((mission) => mission.steps).every((step) => step.clipId === undefined))
    .toBe(true);
});
```

Do not change `src/audio/voiceScript.json` or `public/voice/` in this plan.

- [ ] **Step 5: Run all affected suites**

Run:

```bash
npm run test:run -- src/features/tutorial src/features/routines src/features/workout src/features/settings/BackupActions.test.tsx src/data/repositories/backup.test.ts src/audio/voicePack.test.ts
```

Expected: all selected tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/tutorial/TutorialFirstSession.integration.test.ts src/data/repositories/backup.test.ts src/audio/voicePack.test.ts
git commit -m "test(tutorial): cover first-session mission flow"
```

---

### Task 9: Vérification complète, documentation et checkpoint téléphone

**Files:**
- Modify: `docs/product/FEATURE-INVENTORY.md`
- Modify: `PROGRESS.md`

**Interfaces:**
- Produces: evidence-backed delivered status and the exact next voice phase.
- Consumes: all implementation tasks and their verification output.

- [ ] **Step 1: Scan the implementation for forbidden coupling**

Run:

```bash
rg -n "voiceScript|generate-voice|ELEVEN|VITE_.*KEY" src/features/tutorial src/app src/features/routines src/features/workout src/features/settings
```

Expected: no API key or voice-generation call. Imports of normal audio playback from the existing orientation provider are allowed.

Run:

```bash
rg -n "data-tutorial-id" src/app src/features src/ui
```

Expected: every P1 target from Task 2 appears at least once, and set-specific targets appear only on the first exercise/set.

- [ ] **Step 2: Run the project gates**

Run each command separately and retain its exit code:

```bash
npm run typecheck
npm run test:run
npm run build
```

Expected: all exit with code 0. Do not describe the lot as complete from partial or stale output.

- [ ] **Step 3: Perform the mobile browser checkpoint at 390 × 844**

Use a clean tutorial state and real seeded catalogue. Verify this exact path without changing data on the user's normal browser origin:

1. First launch → skip or finish orientation → choose **Créer ma routine**.
2. Create a routine, add one exercise and a second set.
3. Set a valid target and a non-zero rest.
4. Start, enter the first set, validate it and let the rest end.
5. Open the finish screen and save.
6. Export the JSON backup; select it for restore, inspect the confirmation, then close it.
7. Reload once during `TUT-ROU-03` step 2 and confirm the same mission/step returns.
8. At 390 × 844, ensure the coach never covers the highlighted action and no root horizontal overflow appears.
9. Switch announcer to Silence and confirm every mission still carries its complete instruction.
10. Seed or age an active workout past 12 hours; confirm Resume, Finish and confirmed Discard are explicit and that closing the sheet preserves the workout.

- [ ] **Step 4: Update the master inventory with evidence**

In `FEATURE-INVENTORY.md`:

- change only the delivered P1 mission rows from `Absent`/`Survolé` to `Action`;
- record the v2 storage key, 12-hour recovery threshold and text-only status;
- keep voice inventory at 43/43 and label future P1 clips as not generated;
- leave every P2/P3 row unchanged.

- [ ] **Step 5: Update `PROGRESS.md`**

Record:

- commit IDs for Tasks 1–8;
- exact typecheck/test/build results;
- manual 390 × 844 checkpoint result;
- any mission skipped because its real guard was incompatible;
- next work: freeze the twelve P1 voice texts, then execute a separate voice-generation plan using the restored API key without exposing it.

- [ ] **Step 6: Commit documentation**

```bash
git add docs/product/FEATURE-INVENTORY.md PROGRESS.md
git diff --cached --check
git commit -m "docs: close tutorial p1 implementation"
```

- [ ] **Step 7: Stop for user validation**

Ask the user to repeat the checkpoint on their phone before any voice generation. The acceptance statement is:

> Je peux aller d'une première routine à une séance sauvegardée, reprendre après fermeture, résoudre une vieille séance sans perte et comprendre la sauvegarde, même en Silence.

Do not start P2 or run `npm run voice:generate` until this checkpoint and the final French transcripts are approved.
