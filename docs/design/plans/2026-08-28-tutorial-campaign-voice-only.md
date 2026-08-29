# Tutoriel campagne, Programmes et Voix uniquement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer la visite passive par une campagne interactive et des chapitres contextuels exacts, ajouter le tutoriel détaillé Programmes, puis livrer un mode Voix uniquement compatible avec un suivi unilatéral persistant.

**Architecture:** Le moteur tutoriel devient un registre v3 de missions dirigées par événements métier, avec résolution de sous-routes et HUD partagé. Le guidage de séance reste un sous-système distinct : une politique audio centrale désactive uniquement la cadence de répétitions, tandis que l'état Premier/Second côté est persisté sur la série et peut être avancé manuellement ou par la cadence.

**Tech Stack:** React 19, TypeScript strict, React Router hash, Dexie/IndexedDB, Zustand pour les horloges éphémères, Tailwind CSS v4, Vitest + Testing Library + `fake-indexeddb`, navigateur intégré.

## Global Constraints

- Spécification : `docs/design/specs/2026-08-28-tutorial-campaign-voice-only-design.md`.
- Inventaire source : `docs/product/FEATURE-INVENTORY.md`.
- Aucun écran, composant ou comportement frontend n'est modifié sans appliquer brainstorming, Impeccable, frontend-design puis contrôle navigateur.
- Aucune mission ne crée, remplit, valide, active, supprime ou restaure une donnée à la place de l'utilisateur.
- Aucune fausse séance ni faux historique ; la campagne reprend seulement après un vrai `workout-started`.
- Exercice de découverte exact : slug `dumbbell-curl`, nom UI « Curl haltères », bilatéral.
- Tous les textes UI vivent dans `src/i18n/fr.ts`. Code, types et commentaires en anglais. Aucun `any`.
- Local-first, hors ligne, sans compte, sans secret et sans dépendance réseau.
- Cibles tactiles ≥ 48 px. HUD ≤ 28 % de `100dvh`, détail replié par défaut.
- Aucun passage automatique après la voix ; action métier ou bouton « Continuer » explicite.
- Aucun nouveau MP3 et aucun remplacement de voix dans ce plan.
- Voix uniquement supprime la cadence de répétitions et son 3–2–1, mais conserve tout le reste, notamment le 3–2–1 de repos.
- Une série unilatérale reste une ligne et une validation ; les répétitions restent saisies par côté et le tonnage n'est pas doublé.
- Échauffements exclus du cycle unilatéral.
- Vérification finale obligatoire : `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build`.

## File Map

| Unité                                              | Responsabilité                                             |
| -------------------------------------------------- | ---------------------------------------------------------- |
| `src/features/tutorial/tutorialTypes.ts`           | État v3, IDs, événements et règles d'avancement            |
| `src/features/tutorial/tutorialStore.ts`           | Migration v1/v2 → v3 et persistance défensive              |
| `src/features/tutorial/tutorialScreens.ts`         | Résolution exacte des routes statiques et dynamiques       |
| `src/features/tutorial/tutorialMissions.ts`        | Campagne, Programmes et catalogue contextuel               |
| `src/features/tutorial/tutorialMissionMachine.ts`  | Transitions pures et vérification des identités            |
| `src/features/tutorial/tutorialHudPosition.ts`     | Placement pur du HUD à l'opposé de la cible                |
| `src/features/tutorial/TutorialHud.tsx`            | HUD partagé, spotlight, progression et repli               |
| `src/features/tutorial/TutorialProvider.tsx`       | Invite, aide, orchestration et attente route/cible         |
| `src/features/tutorial/useTutorialMissions.ts`     | Navigation, reprise, pause de campagne et événements       |
| `src/audio/announcer.ts`                           | Politique pure des quatre modes et filtrage de cues        |
| `src/audio/cues.ts`                                | Marquage sémantique `repCadence` des cues                  |
| `src/stores/announcer.ts`                          | Persistance de `voice-only`                                |
| `src/features/workout/sideProgress.ts`             | Machine pure Premier/transition/Second côté                |
| `src/data/types.ts`                                | Deadline optionnelle du second côté sur `WorkoutSet`       |
| `src/data/repositories/workoutSets.ts`             | Écriture atomique du premier côté et nettoyage final       |
| `src/features/workout/useWorkoutPace.ts`           | Cadence de reps conditionnée, maintien conservé            |
| `src/features/workout/WorkoutSetRow.tsx`           | Libellé et bouton manuel du côté courant                   |
| `src/features/workout/WorkoutScreen.tsx`           | Orchestration de validation, repos et annonces             |
| Écrans métier                                      | Ancres uniques et événements seulement après résultat réel |
| `src/i18n/fr.ts`                                   | Toute la copie française                                   |
| `docs/product/FEATURE-INVENTORY.md`, `PROGRESS.md` | Couverture finale, preuves et checkpoint téléphone         |

---

## Phase 1 — Moteur tutoriel v3 et campagne

### Task 1: État tutoriel v3 et migration sans perte

**Files:**

- Modify: `src/features/tutorial/tutorialTypes.ts`
- Modify: `src/features/tutorial/tutorialStore.ts`
- Modify: `src/features/tutorial/tutorialStore.test.ts`
- Modify: `src/features/tutorial/TutorialFirstSession.integration.test.ts`

**Interfaces:**

- Produces: `TutorialStateV3`, `TutorialCampaignStatus`, `TutorialAdvance`, `TutorialRouteContext`.
- Keeps: `loadTutorialState()` / `saveTutorialState()` names so callers migrate atomically.

- [ ] **Step 1: écrire les tests RED de migration**

Ajouter des tests qui prouvent : état neuf v3, migration v2 conservant les missions reconnues,
ancienne orientation ne valant pas campagne terminée, IDs dynamiques persistés et état futur rejeté.

```ts
it('migre v2 sans prétendre que la campagne interactive a été faite', () => {
  localStorage.setItem(
    'fittrack:tutorial:v2',
    JSON.stringify({
      version: 2,
      scriptVersion: 1,
      orientation: 'completed',
      activationPath: 'blank',
      activeMissionId: null,
      activeStepIndex: 0,
      missionRoutineId: 'r-old',
      missions: { 'TUT-DAT-01': 'completed' },
    }),
  );

  expect(loadTutorialState()).toMatchObject({
    version: 3,
    scriptVersion: 2,
    orientation: 'completed',
    campaign: 'not-started',
    missionRoutineId: 'r-old',
    campaignRoutineId: null,
    missionProgramId: null,
    missions: { 'TUT-DAT-01': 'completed' },
  });
});

it('reprend une routine prête sans inventer de séance', () => {
  const state = {
    ...createTutorialState(),
    campaign: 'routine-ready' as const,
    campaignRoutineId: 'r-discovery',
  };
  saveTutorialState(state);
  expect(loadTutorialState()).toEqual(state);
});
```

- [ ] **Step 2: lancer RED**

Run: `npm run test:run -- src/features/tutorial/tutorialStore.test.ts src/features/tutorial/TutorialFirstSession.integration.test.ts`

Expected: FAIL sur `version: 3`, `campaign` et `campaignRoutineId` absents.

- [ ] **Step 3: définir les contrats v3**

Remplacer le contrat d'état par :

```ts
export type TutorialCampaignStatus =
  'not-started' | 'preparing' | 'routine-ready' | 'workout-active' | 'completed' | 'dismissed';

export type TutorialAdvance =
  | { kind: 'event'; accepts: (event: TutorialEvent, state: TutorialStateV3) => boolean }
  | { kind: 'manual' };

export interface TutorialStateV3 {
  version: 3;
  scriptVersion: 2;
  orientation: TutorialCompletion | null;
  campaign: TutorialCampaignStatus;
  activeMissionId: TutorialMissionId | null;
  activeStepIndex: number;
  campaignRoutineId: string | null;
  missionRoutineId: string | null;
  missionProgramId: string | null;
  missions: Partial<Record<TutorialMissionId, TutorialMissionStatus>>;
}

export interface TutorialRouteContext {
  routineId: string | null;
  programId: string | null;
}
```

Étendre `TUTORIAL_MISSION_IDS` avec les identifiants exacts suivants :

```ts
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
```

- [ ] **Step 4: implémenter la migration**

Ajouter `LEGACY_TUTORIAL_V2_STORAGE_KEY`, écrire `createTutorialState()` avec les valeurs de la
spec, valider strictement les enums/IDs, puis sauvegarder la migration sous
`fittrack:tutorial:v3`. Ne jamais supprimer les anciennes clés pendant la lecture.

```ts
export const TUTORIAL_STORAGE_KEY = 'fittrack:tutorial:v3';
export const LEGACY_TUTORIAL_V2_STORAGE_KEY = 'fittrack:tutorial:v2';

export function createTutorialState(): TutorialStateV3 {
  return {
    version: 3,
    scriptVersion: 2,
    orientation: null,
    campaign: 'not-started',
    activeMissionId: null,
    activeStepIndex: 0,
    campaignRoutineId: null,
    missionRoutineId: null,
    missionProgramId: null,
    missions: {},
  };
}
```

- [ ] **Step 5: vérifier GREEN**

Run: `npm run test:run -- src/features/tutorial/tutorialStore.test.ts src/features/tutorial/TutorialFirstSession.integration.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: commit**

```bash
git add src/features/tutorial/tutorialTypes.ts src/features/tutorial/tutorialStore.ts src/features/tutorial/tutorialStore.test.ts src/features/tutorial/TutorialFirstSession.integration.test.ts
git commit -m "feat(tutorial): migrate progress to campaign v3"
```

---

### Task 2: Résolution exacte des écrans et attente de cible

**Files:**

- Modify: `src/features/tutorial/tutorialScreens.ts`
- Modify: `src/features/tutorial/tutorialScreens.test.ts`
- Modify: `src/features/tutorial/tutorialScript.ts`
- Modify: `src/features/tutorial/tutorialScript.test.ts`
- Modify: `src/features/tutorial/useTutorialMissions.ts`
- Modify: `src/features/tutorial/TutorialProvider.test.tsx`

**Interfaces:**

- Produces: `pathForScreen(screen, context)`, `screenHolds(pathname, screen, context)`.
- Removes: `contextualTutorial()` qui efface `route`.

- [ ] **Step 1: écrire les cas RED**

```ts
it.each([
  ['routines', {}, '/routines'],
  ['routine-editor', { routineId: 'r1' }, '/routines/r1'],
  ['routine-picker', { routineId: 'r1' }, '/routines/r1/add'],
  ['programs', {}, '/programs'],
  ['program-editor', { programId: null }, '/programs/new'],
  ['program-detail', { programId: 'p1' }, '/programs/p1'],
  ['history', {}, '/history'],
  ['analytics', {}, '/analytics'],
  ['exercises', {}, '/exercises'],
  ['settings', {}, '/settings'],
] as const)('résout %s', (screen, partial, expected) => {
  expect(pathForScreen(screen, { routineId: null, programId: null, ...partial })).toBe(expected);
});

it('envoie l’aide Routines sur la liste plutôt que la laisser dans un éditeur', async () => {
  const user = userEvent.setup();
  renderTutorial('/routines/r1');
  await user.click(screen.getByRole('button', { name: 'Aide sur cette page' }));
  await user.click(screen.getByRole('button', { name: /Expliquer cette page · Routines/ }));
  expect(await screen.findByText('adresse : /routines')).toBeVisible();
});
```

- [ ] **Step 2: lancer RED**

Run: `npm run test:run -- src/features/tutorial/tutorialScreens.test.ts src/features/tutorial/tutorialScript.test.ts src/features/tutorial/TutorialProvider.test.tsx`

Expected: FAIL parce que Programmes et le picker ne sont pas des `TutorialScreen`, et parce que le
test existant attend encore que l'aide reste sur place.

- [ ] **Step 3: remplacer le contrat d'écran**

```ts
export type TutorialScreen =
  | 'home'
  | 'routines'
  | 'routine-editor'
  | 'routine-picker'
  | 'programs'
  | 'program-editor'
  | 'program-detail'
  | 'workout'
  | 'workout-finish'
  | 'history'
  | 'analytics'
  | 'exercises'
  | 'settings'
  | 'knowledge'
  | 'anywhere';
```

`pathForScreen` doit rendre `null` uniquement lorsqu'un écran dynamique exige un ID absent.
`screenHolds` doit distinguer strictement liste, création, détail et édition.

- [ ] **Step 4: faire attendre route puis ancre**

Dans `useTutorialMissions`, naviguer d'abord, puis exposer `stepReady` seulement lorsque
`screenHolds` est vrai et que `[data-tutorial-id="..."]` existe. Dans `TutorialProvider`, ne jouer
la narration que si `stepReady` est vrai.

```ts
const stepReady =
  activeStep !== null &&
  screenHolds(pathname, activeStep.screen, routeContext) &&
  (activeStep.targetId === null || anchorPresent(activeStep.targetId));
```

Supprimer le comportement qui planifie `next` depuis `ended()` et le `fallbackMs`.

- [ ] **Step 5: vérifier GREEN**

Run: `npm run test:run -- src/features/tutorial/tutorialScreens.test.ts src/features/tutorial/tutorialScript.test.ts src/features/tutorial/TutorialProvider.test.tsx && npm run typecheck`

Expected: PASS ; aucune narration avant cible ; aucune avance sur fin de clip.

- [ ] **Step 6: commit**

```bash
git add src/features/tutorial/tutorialScreens.ts src/features/tutorial/tutorialScreens.test.ts src/features/tutorial/tutorialScript.ts src/features/tutorial/tutorialScript.test.ts src/features/tutorial/useTutorialMissions.ts src/features/tutorial/TutorialProvider.test.tsx
git commit -m "fix(tutorial): route every lesson to its exact screen"
```

---

### Task 3: HUD compact partagé et progression manuelle

**Files:**

- Create: `src/features/tutorial/tutorialHudPosition.ts`
- Create: `src/features/tutorial/tutorialHudPosition.test.ts`
- Create: `src/features/tutorial/TutorialHud.tsx`
- Create: `src/features/tutorial/TutorialHud.test.tsx`
- Modify: `src/features/tutorial/TutorialMissionCoach.tsx`
- Modify: `src/features/tutorial/TutorialProvider.tsx`
- Modify: `src/features/tutorial/useTutorialAnchor.ts`
- Modify: `src/i18n/fr.ts`

**Interfaces:**

- Produces: `hudPlacement(target, viewport) -> 'top' | 'bottom'` et `TutorialHud`.
- Consumes: une étape avec `advance.kind === 'manual' | 'event'`.

Le composant expose ce contrat :

```ts
export interface TutorialHudProps {
  targetRect: DOMRectReadOnly | null;
  index: number;
  count: number;
  title: string;
  instruction: string;
  detail: string;
  advanceKind: 'manual' | 'event';
  onContinue: () => void;
  onDismiss: () => void;
}
```

- [ ] **Step 1: écrire les tests RED de placement et interaction**

```ts
it('place le HUD à l’opposé de la cible', () => {
  expect(hudPlacement({ top: 620, bottom: 680 }, { height: 844 })).toBe('top');
  expect(hudPlacement({ top: 80, bottom: 140 }, { height: 844 })).toBe('bottom');
});

it('ne rend Continuer que pour une étape manuelle', () => {
  const props: TutorialHudProps = {
    targetRect: null,
    index: 0,
    count: 1,
    title: 'Découverte',
    instruction: 'Ouvre Planifier.',
    detail: 'Tu y trouveras tes routines.',
    advanceKind: 'event',
    onContinue: vi.fn(),
    onDismiss: vi.fn(),
  };
  const { rerender } = render(<TutorialHud {...props} advanceKind="event" />);
  expect(screen.queryByRole('button', { name: 'Continuer' })).toBeNull();
  rerender(<TutorialHud {...props} advanceKind="manual" />);
  expect(screen.getByRole('button', { name: 'Continuer' })).toBeVisible();
});

it('replie le détail par défaut même en Silence', () => {
  render(<TutorialHud {...props} />);
  expect(screen.getByRole('button', { name: 'Lire le détail' })).toHaveAttribute('aria-expanded', 'false');
});
```

- [ ] **Step 2: lancer RED**

Run: `npm run test:run -- src/features/tutorial/tutorialHudPosition.test.ts src/features/tutorial/TutorialHud.test.tsx`

Expected: FAIL, nouveaux modules absents.

- [ ] **Step 3: implémenter le calcul pur**

```ts
export interface VerticalRect {
  top: number;
  bottom: number;
}
export interface Viewport {
  height: number;
}

export function hudPlacement(target: VerticalRect | null, viewport: Viewport): 'top' | 'bottom' {
  if (target === null) return 'bottom';
  return (target.top + target.bottom) / 2 > viewport.height / 2 ? 'top' : 'bottom';
}
```

- [ ] **Step 4: créer le HUD**

Le composant rend : ligne segmentée, `record-figure` pour `{index}/{count}`, titre sur une ligne,
instruction, détail replié, Quitter et éventuellement Continuer. Utiliser les tokens existants et
ces limites :

```tsx
<section
  data-placement={placement}
  className={`pointer-events-auto safe-bottom absolute right-3 left-3 mx-auto
    max-h-[28dvh] max-w-[34rem] overflow-hidden rounded-2xl border
    border-[var(--border)] bg-[var(--surface-1)] shadow-[0_18px_48px_rgba(0,0,0,0.45)]
    ${placement === 'top' ? 'top-[calc(env(safe-area-inset-top)+0.75rem)]' : 'bottom-[4.5rem]'}`}
>
```

Le spotlight conserve 6 px d'air, ne capte aucun pointer event et utilise le vrai rectangle de
l'ancre. La cible reste cliquable.

- [ ] **Step 5: remplacer les deux panneaux existants**

`TutorialMissionCoach` devient un adaptateur mince vers `TutorialHud`. `TutorialOverlay` disparaît
de `TutorialProvider`; la visite et les missions utilisent le même composant.

- [ ] **Step 6: ajouter la copie française**

Ajouter notamment : `tutorial.hud.continue`, `tutorial.hud.readDetail`,
`tutorial.hud.hideDetail`, `tutorial.hud.retry`, `tutorial.hud.quit`, `tutorial.hud.loadingTarget`.

- [ ] **Step 7: vérifier GREEN**

Run: `npm run test:run -- src/features/tutorial/tutorialHudPosition.test.ts src/features/tutorial/TutorialHud.test.tsx src/features/tutorial/TutorialMissionCoach.test.tsx src/features/tutorial/TutorialProvider.test.tsx && npm run typecheck`

Expected: PASS ; aucune transcription ouverte au montage.

- [ ] **Step 8: commit**

```bash
git add src/features/tutorial/tutorialHudPosition.ts src/features/tutorial/tutorialHudPosition.test.ts src/features/tutorial/TutorialHud.tsx src/features/tutorial/TutorialHud.test.tsx src/features/tutorial/TutorialMissionCoach.tsx src/features/tutorial/TutorialProvider.tsx src/features/tutorial/useTutorialAnchor.ts src/i18n/fr.ts
git commit -m "feat(tutorial): replace overlays with a compact mission HUD"
```

---

### Task 4: Campagne Curl haltères sans données préalables

**Files:**

- Modify: `src/features/tutorial/tutorialTypes.ts`
- Modify: `src/features/tutorial/tutorialMissions.ts`
- Modify: `src/features/tutorial/tutorialMissionMachine.ts`
- Modify: `src/features/tutorial/tutorialMissionMachine.test.ts`
- Modify: `src/features/tutorial/useTutorialMissions.ts`
- Modify: `src/features/routines/RoutinesScreen.tsx`
- Modify: `src/features/routines/RoutineEditorScreen.tsx`
- Modify: `src/features/routines/ExercisePickerScreen.tsx`
- Modify: `src/features/exercises/ExerciseBrowser.tsx`
- Modify: `src/features/exercises/ExerciseList.tsx`
- Modify: `src/ui/Input.tsx`
- Modify: `src/ui/ActionBand.tsx`
- Modify: `src/ui/ListRow.tsx`
- Modify: `src/features/workout/WorkoutScreen.tsx`
- Modify: `src/features/workout/WorkoutFinishScreen.tsx`
- Modify: `src/i18n/fr.ts`
- Modify: `src/features/routines/RoutineFlow.integration.test.tsx`
- Modify: `src/features/workout/WorkoutScreen.integration.test.tsx`
- Modify: `src/features/tutorial/TutorialFirstSession.integration.test.ts`

**Interfaces:**

- Produces: `TUT-CAM-01` (préparation), `TUT-CAM-02` (première séance),
  `startCampaign(state)` et `resumeCampaignForWorkout(state, event)`.
- Adds events: `routine-create-opened`, `routine-renamed`, `routine-picker-opened`,
  `routine-exercise-query-changed`, `routine-exercise-selected`, `routine-prepared`.

- [ ] **Step 1: écrire le parcours RED complet**

Le test de machine part d'un état vierge, refuse un autre exercice, accepte uniquement le slug du
curl, s'arrête à `routine-ready`, ignore un workout d'une autre routine et reprend sur le bon ID.

```ts
it('prépare Curl haltères puis attend le vrai démarrage de cette routine', () => {
  let state = startCampaign(createTutorialState());
  state = advanceMission(state, { type: 'routine-created', routineId: 'r1' });
  state = advanceMission(state, {
    type: 'routine-renamed',
    routineId: 'r1',
    name: 'Séance découverte',
  });
  state = advanceMission(state, {
    type: 'routine-exercise-selected',
    routineId: 'r1',
    exerciseSlug: 'barbell-curl',
  });
  expect(state.activeStepIndex).toBe(4);
  state = advanceMission(state, {
    type: 'routine-exercise-selected',
    routineId: 'r1',
    exerciseSlug: 'dumbbell-curl',
  });
  state = advanceMission(state, {
    type: 'routine-exercise-added',
    routineId: 'r1',
    exerciseSlugs: ['dumbbell-curl'],
  });
  state = advanceMission(state, {
    type: 'routine-set-added',
    routineId: 'r1',
    setId: 's2',
    count: 2,
  });
  state = advanceMission(state, { type: 'routine-target-updated', routineId: 'r1', setId: 's1' });
  state = advanceMission(state, { type: 'routine-rest-updated', routineId: 'r1', seconds: 60 });
  state = advanceMission(state, { type: 'routine-prepared', routineId: 'r1' });
  expect(state).toMatchObject({
    campaign: 'routine-ready',
    activeMissionId: null,
    campaignRoutineId: 'r1',
  });
  expect(resumeCampaignForWorkout(state, { workoutId: 'w-other', routineId: 'other' })).toBe(state);
  expect(resumeCampaignForWorkout(state, { workoutId: 'w1', routineId: 'r1' })).toMatchObject({
    campaign: 'workout-active',
    activeMissionId: 'TUT-CAM-02',
    activeStepIndex: 0,
  });
});
```

- [ ] **Step 2: lancer RED**

Run: `npm run test:run -- src/features/tutorial/tutorialMissionMachine.test.ts src/features/tutorial/TutorialFirstSession.integration.test.ts`

Expected: FAIL sur les événements et fonctions de campagne absents.

- [ ] **Step 3: définir les événements avec identités**

```ts
export type TutorialEvent =
  | { type: 'routine-create-opened' }
  | { type: 'routine-created'; routineId: string }
  | { type: 'routine-renamed'; routineId: string; name: string }
  | { type: 'routine-picker-opened'; routineId: string }
  | { type: 'routine-exercise-query-changed'; routineId: string; query: string }
  | { type: 'routine-exercise-selected'; routineId: string; exerciseSlug: string }
  | { type: 'routine-exercise-added'; routineId: string; exerciseSlugs: readonly string[] }
  | { type: 'routine-set-added'; routineId: string; setId: string; count: number }
  | { type: 'routine-target-updated'; routineId: string; setId: string }
  | { type: 'routine-rest-updated'; routineId: string; seconds: number }
  | { type: 'routine-prepared'; routineId: string }
  | { type: 'workout-started'; workoutId: string; routineId?: string; programId?: string }
  | { type: 'workout-set-written'; workoutId: string; setId: string; recordable: boolean }
  | { type: 'workout-set-completed'; workoutId: string; setId: string }
  | { type: 'rest-adjusted'; setId: string }
  | { type: 'rest-finished'; setId: string }
  | { type: 'workout-finish-opened'; workoutId: string }
  | { type: 'workout-saved'; workoutId: string }
  | TutorialProgramEvent
  | TutorialContextualEvent;
```

- [ ] **Step 4: écrire explicitement les 20 étapes C01–C20**

Dans `tutorialMissions.ts`, définir `CAMPAIGN_PREPARE` et `CAMPAIGN_WORKOUT` avec les routes,
ancres, clés de texte et prédicats de la section 6 de la spec. Utiliser des helpers identitaires :

```ts
const forCampaignRoutine =
  <T extends TutorialEvent['type']>(
    type: T,
    extra?: (event: Extract<TutorialEvent, { type: T }>) => boolean,
  ) =>
  (event: TutorialEvent, state: TutorialStateV3): boolean =>
    event.type === type &&
    'routineId' in event &&
    event.routineId === state.campaignRoutineId &&
    (extra?.(event as Extract<TutorialEvent, { type: T }>) ?? true);

const pickedDumbbellCurl = (event: TutorialEvent, state: TutorialStateV3): boolean =>
  forCampaignRoutine(
    'routine-exercise-selected',
    (candidate) => candidate.exerciseSlug === 'dumbbell-curl',
  )(event, state);
```

La dernière étape de préparation met `campaign: 'routine-ready'` et aucune mission active. Le
report global de `workout-started` appelle `resumeCampaignForWorkout` avant `advanceMission`.

- [ ] **Step 5: poser les ancres exactes et publier après les écritures**

- `RoutinesScreen`: `routine-create`, `routine-create-blank` et événement d'ouverture.
- `RoutineEditorScreen`: `routine-name`, `routine-add-exercise`, `routine-add-set`,
  `routine-first-set`, `routine-exercise-menu`, `routine-start`.
- `ExerciseBrowser`: `exercise-search`.
- `ExerciseList`: `exercise-dumbbell-curl` seulement quand `exercise.slug === 'dumbbell-curl'`.
- `ExercisePickerScreen`: `routine-exercise-add-confirm` et événements avec slugs réels.

Étendre `Input`, `ActionBand` et `ListRow` avec un prop neutre `tutorialId?: string` lorsque
nécessaire ; le prop ne contient aucune logique de tutoriel.

- [ ] **Step 6: écrire toute la copie française de C01–C20**

La phrase visible décrit uniquement la cible. Exemple fixé pour la sélection :

```ts
'tutorial.campaign.curl.instruction': 'Sélectionne Curl haltères.',
'tutorial.campaign.curl.detail': 'Tu feras les répétitions avec les deux bras ensemble : une seule ligne et une seule validation.',
```

Les anciens clips restent facultatifs ; ne pas ajouter d'entrée à `voiceScript.json` dans cette
tâche.

- [ ] **Step 7: faire passer les intégrations métier**

Run: `npm run test:run -- src/features/routines/RoutineFlow.integration.test.tsx src/features/workout/WorkoutScreen.integration.test.tsx src/features/tutorial/TutorialFirstSession.integration.test.ts`

Expected: campagne complète PASS, aucune séance créée avant le clic Démarrer.

- [ ] **Step 8: commit**

```bash
git add src/features/tutorial/tutorialTypes.ts src/features/tutorial/tutorialMissions.ts src/features/tutorial/tutorialMissionMachine.ts src/features/tutorial/tutorialMissionMachine.test.ts src/features/tutorial/useTutorialMissions.ts src/features/tutorial/TutorialFirstSession.integration.test.ts src/features/routines/RoutinesScreen.tsx src/features/routines/RoutineEditorScreen.tsx src/features/routines/ExercisePickerScreen.tsx src/features/routines/RoutineFlow.integration.test.tsx src/features/exercises/ExerciseBrowser.tsx src/features/exercises/ExerciseList.tsx src/ui/Input.tsx src/ui/ActionBand.tsx src/ui/ListRow.tsx src/features/workout/WorkoutScreen.tsx src/features/workout/WorkoutFinishScreen.tsx src/features/workout/WorkoutScreen.integration.test.tsx src/i18n/fr.ts
git commit -m "feat(tutorial): teach a first dumbbell curl workout"
```

---

## Phase 2 — Programmes et couverture contextuelle

### Task 5: Tutoriel détaillé Programmes, de Cadre au suivi

**Files:**

- Modify: `src/features/tutorial/tutorialTypes.ts`
- Modify: `src/features/tutorial/tutorialMissions.ts`
- Modify: `src/features/tutorial/tutorialScreens.ts`
- Modify: `src/features/programs/ProgramListScreen.tsx`
- Modify: `src/features/programs/ProgramEditorScreen.tsx`
- Modify: `src/features/programs/ProgramBasicsStep.tsx`
- Modify: `src/features/programs/ProgramSplitStep.tsx`
- Modify: `src/features/programs/ProgramWeeksStep.tsx`
- Modify: `src/features/programs/ProgramDetailScreen.tsx`
- Modify: `src/features/programs/ProgramSessionList.tsx`
- Modify: `src/features/programs/ProgramActionsSheet.tsx`
- Modify: `src/features/programs/ProgramFlow.integration.test.tsx`
- Modify: `src/features/tutorial/TutorialProvider.test.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**

- Produces: `TutorialProgramEvent` et missions `TUT-PRG-01` à `TUT-PRG-04`.
- Persists: `missionProgramId` dès création du brouillon.

- [ ] **Step 1: écrire les tests RED du parcours P01–P18**

```ts
it('retient le programme créé et rejoint chacune de ses sous-routes', () => {
  let state = startMission(createTutorialState(), 'TUT-PRG-01');
  state = advanceMission(state, { type: 'program-editor-opened', mode: 'create' });
  state = advanceMission(state, { type: 'program-basics-saved', programId: 'p1' });
  expect(state.missionProgramId).toBe('p1');
  state = advanceMission(state, { type: 'program-split-saved', programId: 'p1', entryCount: 1 });
  state = advanceMission(state, {
    type: 'program-recipe-applied',
    programId: 'p1',
    recipeId: 'hypertrophy',
  });
  state = advanceMission(state, { type: 'program-week-opened', programId: 'p1', weekIndex: 0 });
  state = advanceMission(state, { type: 'program-activated', programId: 'p1' });
  expect(state.activeMissionId).toBe('TUT-PRG-04');
  expect(
    pathForScreen('program-detail', { routineId: null, programId: state.missionProgramId }),
  ).toBe('/programs/p1');
});
```

Le test UI doit démarrer sans programme, créer un vrai brouillon, lui affecter une routine,
appliquer Hypertrophie, activer, sélectionner une séance et ouvrir le menu sans démarrer de workout.

- [ ] **Step 2: lancer RED**

Run: `npm run test:run -- src/features/programs/ProgramFlow.integration.test.tsx src/features/tutorial/tutorialMissionMachine.test.ts src/features/tutorial/TutorialProvider.test.tsx`

Expected: FAIL, événements et ancres Programmes absents.

- [ ] **Step 3: ajouter les événements Programmes**

```ts
export type TutorialProgramEvent =
  | { type: 'program-editor-opened'; mode: 'create' | 'edit'; programId?: string }
  | { type: 'program-basics-saved'; programId: string }
  | { type: 'program-split-saved'; programId: string; entryCount: number }
  | { type: 'program-session-added'; programId: string }
  | { type: 'program-recipe-applied'; programId: string; recipeId: ProgramRecipeId }
  | { type: 'program-week-opened'; programId: string; weekIndex: number }
  | { type: 'program-activated'; programId: string }
  | { type: 'program-session-selected'; programId: string; entryId: string }
  | { type: 'program-actions-opened'; programId: string };
```

Publier `program-basics-saved`, `program-split-saved` et `program-activated` uniquement après les
promesses repository réussies. Les événements de lecture viennent des clics qui ouvrent réellement
la semaine, sélectionnent la séance ou ouvrent le menu.

- [ ] **Step 4: définir les missions complètes**

Répartir P01–P18 :

- `TUT-PRG-01`: P01–P06, route liste puis création ;
- `TUT-PRG-02`: P07–P10, même `/programs/new` ;
- `TUT-PRG-03`: P11–P13, semaines puis activation ;
- `TUT-PRG-04`: P14–P18, `/programs/:missionProgramId`.

Les pas P01, P09, P14, P16 et P18 sont `manual`. Tous les autres attendent l'événement exact et le
bon `programId`.

- [ ] **Step 5: poser les ancres Programmes**

Utiliser exactement :

```ts
const PROGRAM_TUTORIAL_IDS = [
  'program-create',
  'program-basics',
  'program-name',
  'program-start-date',
  'program-duration',
  'program-continue',
  'program-split-first-day',
  'program-split-first-routine',
  'program-add-session',
  'program-recipe-hypertrophy',
  'program-first-week',
  'program-activate',
  'program-intention',
  'program-session-list',
  'program-upcoming-weeks',
  'program-actions',
] as const;
```

Chaque ID apparaît au plus une fois dans le DOM visible. Ajouter une assertion d'unicité au test
d'intégration.

- [ ] **Step 6: écrire la copie détaillée**

Employer « programme » dans le tutoriel tout en conservant les libellés produit existants si
l'écran dit encore « bloc ». La première phrase fixe la différence :

```ts
'tutorial.program.intro.instruction': 'Une routine décrit une séance. Un programme organise tes routines sur plusieurs semaines.',
```

Ne pas annoncer qu'une recette multiplie les charges : `loadIndex` reste une intention, conformément
au design Programmes existant.

- [ ] **Step 7: vérifier GREEN**

Run: `npm run test:run -- src/features/programs/ProgramFlow.integration.test.tsx src/features/tutorial/tutorialMissionMachine.test.ts src/features/tutorial/TutorialProvider.test.tsx && npm run typecheck`

Expected: PASS ; aucun workout créé pendant le chapitre.

- [ ] **Step 8: commit**

```bash
git add src/features/tutorial src/features/programs src/i18n/fr.ts
git commit -m "feat(tutorial): add the complete programs chapter"
```

---

### Task 6: Missions contextuelles restantes, écran par écran

**Files:**

- Modify: `src/features/tutorial/tutorialTypes.ts`
- Modify: `src/features/tutorial/tutorialMissions.ts`
- Modify: `src/features/tutorial/tutorialScreens.ts`
- Modify: `src/features/tutorial/tutorialMissionMachine.test.ts`
- Modify: `src/features/home/HomeScreen.tsx`
- Modify: `src/features/workout/WorkoutExerciseCard.tsx`
- Modify: `src/features/workout/WorkoutSetRow.tsx`
- Modify: `src/features/history/HistoryScreen.tsx`
- Modify: `src/features/history/HistoryDetailScreen.tsx`
- Modify: `src/features/history/HistoryEditScreen.tsx`
- Modify: `src/features/history/HevyImportScreen.tsx`
- Modify: `src/features/analytics/AnalyticsScreen.tsx`
- Modify: `src/features/analytics/ChartExportAction.tsx`
- Modify: `src/features/exercises/ExercisesScreen.tsx`
- Modify: `src/features/exercises/ExerciseFormScreen.tsx`
- Modify: `src/features/knowledge/KnowledgeScreen.tsx`
- Modify: `src/features/knowledge/LearnProgrammingScreen.tsx`
- Modify: `src/features/settings/SettingsScreen.tsx`
- Modify: `src/features/settings/NotificationSettings.tsx`
- Modify: `src/i18n/fr.ts`
- Test: intégrations existantes dans chacune des zones ci-dessus.

**Interfaces:**

- Produces: tous les IDs P2 de `TutorialMissionId`, sans nouveau moteur.
- Extends: `TutorialMissionFacts` avec les préconditions de données utilisées par les gardes.

- [ ] **Step 1: écrire un test de couverture RED du catalogue**

```ts
it('offre au moins une tâche propre à chaque grande route', () => {
  const cases = [
    ['/', false],
    ['/routines', false],
    ['/programs', false],
    ['/workout', true],
    ['/history', false],
    ['/analytics', false],
    ['/exercises', false],
    ['/knowledge', false],
    ['/settings', false],
  ] as const;
  for (const [route, hasActiveWorkout] of cases) {
    expect(
      contextualMissionsForPath(route, createTutorialState(), {
        hasActiveWorkout,
        hasRoutine: true,
        hasHistory: true,
        hasRecordableSet: true,
      }),
    ).not.toHaveLength(0);
  }
});

it('n’utilise aucun targetId deux fois sur un même écran rendu', () => {
  for (const mission of TUTORIAL_MISSIONS) {
    expect(new Set(mission.steps.map((step) => `${step.screen}:${step.targetId}`)).size).toBe(
      mission.steps.length,
    );
  }
});
```

- [ ] **Step 2: lancer RED**

Run: `npm run test:run -- src/features/tutorial/tutorialMissionMachine.test.ts src/features/tutorial/TutorialProvider.test.tsx`

Expected: FAIL pour Accueil, Connaissances et les P2 non implémentées.

- [ ] **Step 3: ajouter les événements contextuels exacts**

Étendre d'abord les faits lus par `TutorialProvider` :

```ts
export interface TutorialMissionFacts {
  hasActiveWorkout: boolean | null;
  hasRoutine: boolean | null;
  hasHistory: boolean | null;
  hasRecordableSet: boolean | null;
}
```

```ts
export type TutorialContextualEvent =
  | { type: 'workout-set-added'; rowId: string }
  | { type: 'workout-exercise-added'; exerciseId: string }
  | { type: 'workout-set-type-updated'; setId: string; setType: SetType }
  | { type: 'workout-rpe-updated'; setId: string; rpe: number }
  | { type: 'plate-sheet-opened'; rowId: string }
  | { type: 'warmup-inserted'; rowId: string; count: number }
  | { type: 'pace-started'; setId: string }
  | { type: 'pace-stopped'; setId: string }
  | { type: 'history-selection-changed'; kind: 'date' | 'calendar' | 'exercise' }
  | { type: 'history-edit-opened'; workoutId: string }
  | { type: 'history-edit-saved'; workoutId: string }
  | { type: 'history-share-opened'; workoutId: string }
  | { type: 'hevy-review-opened'; workoutCount: number }
  | { type: 'analytics-view-opened'; view: string }
  | { type: 'analytics-period-changed'; period: string }
  | { type: 'chart-share-opened'; chart: string }
  | { type: 'exercise-query-changed'; query: string }
  | { type: 'exercise-created'; exerciseId: string }
  | { type: 'knowledge-result-opened'; resultId: string }
  | { type: 'learning-step-opened'; stepId: string }
  | { type: 'announcer-mode-changed'; mode: AnnouncerMode }
  | { type: 'announcer-echo-changed'; enabled: boolean }
  | { type: 'notification-settings-saved' };
```

- [ ] **Step 4: définir les missions selon ce tableau**

| Mission       | Étapes d'action                                   | Garde                                        |
| ------------- | ------------------------------------------------- | -------------------------------------------- |
| `TUT-WRK-05`  | ajouter série, puis exercice                      | séance active                                |
| `TUT-WRK-06`  | ouvrir menu série, choisir un type non normal     | série présente                               |
| `TUT-WRK-07`  | valider une série, renseigner RPE                 | RPE activé                                   |
| `TUT-WRK-08`  | ouvrir plaques, ajuster une valeur, fermer        | charge compatible                            |
| `TUT-WRK-09`  | ouvrir échauffement, insérer au moins une série   | charge cible valide                          |
| `TUT-WRK-10`  | lancer puis arrêter cadence                       | mode différent de Voix uniquement            |
| `TUT-WRK-11`  | démarrer maintien, finir premier puis second côté | exercice durée/unilatéral                    |
| `TUT-WRK-12`  | ouvrir décharge ou appliquer recommandation       | contexte disponible                          |
| `TUT-HIS-01`  | choisir date/calendrier/exercice, ouvrir résultat | historique non vide                          |
| `TUT-HIS-02`  | ouvrir édition, sauvegarder                       | workout existant                             |
| `TUT-HIS-03`  | ouvrir partage, quitter                           | workout existant                             |
| `TUT-IMP-01`  | choisir CSV, associer si besoin, atteindre revue  | fichier utilisateur                          |
| `TUT-ANA-01`  | choisir analyse puis période                      | historique suffisant                         |
| `TUT-ANA-02`  | ouvrir partage du graphique                       | graphique rendu                              |
| `TUT-EXE-01`  | rechercher puis filtrer                           | toujours                                     |
| `TUT-EXE-02`  | créer, choisir mesure/unilatéral, enregistrer     | aucun workout requis                         |
| `TUT-KNW-01`  | rechercher, ouvrir résultat, lire sources/limites | toujours                                     |
| `TUT-KNW-02`  | ouvrir et reprendre le parcours de programmation  | toujours                                     |
| `TUT-HOME-01` | ouvrir poids, carte musculaire et objectif        | cartes disponibles                           |
| `TUT-SET-01`  | choisir mode puis écho                            | toujours                                     |
| `TUT-SET-02`  | modifier puis enregistrer notifications           | runtime compatible ou explication navigateur |

Les confirmations destructives utilisent un dernier pas manuel qui explique, mais leur bouton de
confirmation n'est jamais la cible.

- [ ] **Step 5: poser les ancres et publier les événements**

Ajouter les `tutorialId` aux contrôles existants, jamais aux conteneurs génériques, selon cette
table exhaustive :

| Mission       | Ancres successives                                                                     |
| ------------- | -------------------------------------------------------------------------------------- |
| `TUT-WRK-05`  | `workout-add-set`, `workout-add-exercise`                                              |
| `TUT-WRK-06`  | `workout-first-set-menu`, `workout-set-type`                                           |
| `TUT-WRK-07`  | `workout-first-set-complete`, `workout-rpe`                                            |
| `TUT-WRK-08`  | `workout-plates`, `plate-load-control`                                                 |
| `TUT-WRK-09`  | `workout-warmup`, `workout-warmup-insert`                                              |
| `TUT-WRK-10`  | `workout-pace`, `workout-pace-stop`                                                    |
| `TUT-WRK-11`  | `workout-hold`, `workout-first-side`, `workout-second-side`                            |
| `TUT-WRK-12`  | `workout-deload`, `workout-coach-apply`                                                |
| `TUT-HIS-01`  | `history-date`, `history-calendar`, `history-exercise-filter`, `history-first-workout` |
| `TUT-HIS-02`  | `history-edit`, `history-save`                                                         |
| `TUT-HIS-03`  | `history-share`                                                                        |
| `TUT-IMP-01`  | `hevy-import`, `hevy-file`, `hevy-review`                                              |
| `TUT-ANA-01`  | `analytics-first-view`, `analytics-period`                                             |
| `TUT-ANA-02`  | `analytics-share`                                                                      |
| `TUT-EXE-01`  | `exercise-search`, `exercise-muscle-filter`, `exercise-equipment-filter`               |
| `TUT-EXE-02`  | `exercise-create`, `exercise-measurement`, `exercise-unilateral`, `exercise-save`      |
| `TUT-KNW-01`  | `knowledge-search`, `knowledge-first-result`, `knowledge-sources`                      |
| `TUT-KNW-02`  | `knowledge-programming-path`, `knowledge-current-step`                                 |
| `TUT-HOME-01` | `home-body-weight`, `home-muscle-map`, `home-weekly-goal`                              |
| `TUT-SET-01`  | `announcer-modes`, `announcer-echo`                                                    |
| `TUT-SET-02`  | `notification-settings`, `notification-save`                                           |

Publier après la résolution de chaque repository write. Pour recherche/filtre/feuille, publier sur
le geste UI qui rend le nouvel état visible.

- [ ] **Step 6: écrire la copie française**

Chaque instruction tient sur une phrase et chaque détail sur deux phrases maximum. Aucun texte ne
promet une fonctionnalité absente. Les erreurs/états vides disent comment rendre la mission
atteignable.

- [ ] **Step 7: lancer les suites ciblées**

Run: `npm run test:run -- src/features/tutorial src/features/workout src/features/history src/features/analytics src/features/exercises src/features/knowledge src/features/settings`

Expected: PASS.

- [ ] **Step 8: commit**

```bash
git add src/features/tutorial/tutorialTypes.ts src/features/tutorial/tutorialMissions.ts src/features/tutorial/tutorialScreens.ts src/features/tutorial/tutorialMissionMachine.test.ts src/features/home/HomeScreen.tsx src/features/workout/WorkoutExerciseCard.tsx src/features/workout/WorkoutSetRow.tsx src/features/history/HistoryScreen.tsx src/features/history/HistoryDetailScreen.tsx src/features/history/HistoryEditScreen.tsx src/features/history/HevyImportScreen.tsx src/features/analytics/AnalyticsScreen.tsx src/features/analytics/ChartExportAction.tsx src/features/exercises/ExercisesScreen.tsx src/features/exercises/ExerciseFormScreen.tsx src/features/knowledge/KnowledgeScreen.tsx src/features/knowledge/LearnProgrammingScreen.tsx src/features/settings/SettingsScreen.tsx src/features/settings/NotificationSettings.tsx src/i18n/fr.ts
git commit -m "feat(tutorial): cover every contextual product area"
```

---

## Phase 3 — Voix uniquement et côtés persistants

### Task 7: Politique centrale du mode Voix uniquement

**Files:**

- Modify: `src/audio/announcer.ts`
- Modify: `src/audio/announcer.test.ts`
- Modify: `src/audio/cues.ts`
- Modify: `src/audio/cues.test.ts`
- Modify: `src/audio/announce.ts`
- Modify: `src/stores/announcer.ts`
- Modify: `src/stores/announcer.test.ts`
- Modify: `src/features/settings/AnnouncerSettings.tsx`
- Modify: `src/features/settings/SettingsScreen.test.tsx`
- Modify: `src/features/tutorial/TutorialProvider.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**

- Produces: `AnnouncerMode = 'silence' | 'sounds' | 'voice' | 'voice-only'`.
- Produces: `guidancePolicy(mode)` et `CueDefinition.repCadence`.

- [ ] **Step 1: écrire les tests RED de la matrice**

```ts
it('Voix uniquement retire les cues de cadence et garde le repos', () => {
  const first = (clips: readonly string[]): string => clips[0] ?? '';
  const plan = (mode: AnnouncerMode, cue: CueId) =>
    planCue(EMPTY_MEMORY, mode, cue, 10_000, first).plan;
  expect(plan('voice-only', 'rep-tick')).toEqual({ tone: null, clip: null });
  expect(plan('voice-only', 'rep-3')).toEqual({ tone: null, clip: null });
  expect(plan('voice-only', 'pace-start-10')).toEqual({ tone: null, clip: null });
  expect(plan('voice-only', 'rest-3').tone).toBe('tick');
  expect(plan('voice-only', 'rest-3').clip).toBe('rest-3-1');
  expect(plan('voice-only', 'side-change').clip).toBe('side-change-1');
});

it('mémorise voice-only', () => {
  applyAnnouncerMode('voice-only');
  expect(localStorage.getItem(ANNOUNCER_STORAGE_KEY)).toBe('voice-only');
  expect(loadAnnouncerMode()).toBe('voice-only');
});
```

- [ ] **Step 2: lancer RED**

Run: `npm run test:run -- src/audio/announcer.test.ts src/audio/cues.test.ts src/stores/announcer.test.ts src/features/settings/SettingsScreen.test.tsx`

Expected: FAIL, mode inconnu.

- [ ] **Step 3: implémenter la politique pure**

```ts
export interface GuidancePolicy {
  voice: boolean;
  tones: boolean;
  repPacing: boolean;
}

export function guidancePolicy(mode: AnnouncerMode): GuidancePolicy {
  switch (mode) {
    case 'silence':
      return { voice: false, tones: false, repPacing: true };
    case 'sounds':
      return { voice: false, tones: true, repPacing: true };
    case 'voice':
      return { voice: true, tones: true, repPacing: true };
    case 'voice-only':
      return { voice: true, tones: true, repPacing: false };
  }
}
```

Ajouter `repCadence: boolean` à chaque `CueDefinition`. Mettre `true` uniquement sur
`pace-start-10`, `pace-reps-missing`, `rep-tick`, `rep-3`, `rep-2`, `rep-1` et `set-done`.
`rest-3/2/1`, `side-change` et tous les `hold-*` restent `false`.

Dans `planCue`, retourner `SILENT` si `mode === 'voice-only' && definition.repCadence`, puis dériver
tone/clip depuis `guidancePolicy`.

- [ ] **Step 4: ajouter le quatrième choix UI**

Ordre : Silence, Sons, Sons + voix, Voix uniquement. Ajouter le hint exact :

```ts
'settings.announcerVoiceOnly': 'Voix uniquement',
'settings.announcerVoiceOnlyHint': 'Garde les annonces utiles, sans cadence ni décompte des dernières répétitions.',
```

Ajouter aussi ce choix à l'écran audio de fin d'introduction.

- [ ] **Step 5: vérifier GREEN**

Run: `npm run test:run -- src/audio src/stores/announcer.test.ts src/features/settings/SettingsScreen.test.tsx src/features/tutorial/TutorialProvider.test.tsx && npm run typecheck`

Expected: PASS.

- [ ] **Step 6: commit**

```bash
git add src/audio/announcer.ts src/audio/announcer.test.ts src/audio/cues.ts src/audio/cues.test.ts src/audio/announce.ts src/stores/announcer.ts src/stores/announcer.test.ts src/features/settings/AnnouncerSettings.tsx src/features/settings/SettingsScreen.test.tsx src/features/tutorial/TutorialProvider.tsx src/i18n/fr.ts
git commit -m "feat(audio): add voice-only guidance mode"
```

---

### Task 8: État Premier/Second côté persistant en repository

**Files:**

- Modify: `src/data/types.ts`
- Modify: `src/data/repositories/workoutSets.ts`
- Modify: `src/data/repositories/workouts.test.ts`
- Modify: `src/data/repositories/workouts.ts`
- Create: `src/features/workout/sideProgress.ts`
- Create: `src/features/workout/sideProgress.test.ts`
- Modify: `src/data/repositories/backup.test.ts`

**Interfaces:**

- Adds: `WorkoutSet.unilateralSecondSideStartsAt?: number`.
- Produces: `sideStageFor(set, unilateral, now)`, `completeFirstSide(setId, now)`,
  `resetUnilateralProgress(setId)`.

- [ ] **Step 1: écrire les tests RED de machine et repository**

```ts
it('dérive premier, transition et second depuis une deadline absolue', () => {
  expect(sideStageFor({ isCompleted: 0, setType: 'normal' }, true, 1_000)).toBe('first');
  expect(
    sideStageFor(
      { isCompleted: 0, setType: 'normal', unilateralSecondSideStartsAt: 11_000 },
      true,
      5_000,
    ),
  ).toBe('transition');
  expect(
    sideStageFor(
      { isCompleted: 0, setType: 'normal', unilateralSecondSideStartsAt: 11_000 },
      true,
      11_000,
    ),
  ).toBe('second');
  expect(sideStageFor({ isCompleted: 0, setType: 'normal' }, false, 1_000)).toBeNull();
});

it('persiste le premier côté sans valider la série', async () => {
  await completeFirstSide(set.id, 1_000);
  expect(await db.workoutSets.get(set.id)).toMatchObject({
    isCompleted: 0,
    performedAt: 0,
    unilateralSecondSideStartsAt: 11_000,
  });
});

it('efface la progression intermédiaire à la validation et à la décoche', async () => {
  await completeFirstSide(set.id, 1_000);
  await completeSet(set.id, { reps: 10 });
  expect((await db.workoutSets.get(set.id))?.unilateralSecondSideStartsAt).toBeUndefined();
  await uncompleteSet(set.id);
  expect(sideStageFor((await db.workoutSets.get(set.id))!, true, 20_000)).toBe('first');
});
```

- [ ] **Step 2: lancer RED**

Run: `npm run test:run -- src/features/workout/sideProgress.test.ts src/data/repositories/workouts.test.ts src/data/repositories/backup.test.ts`

Expected: FAIL, champ et fonctions absents.

- [ ] **Step 3: écrire la machine pure**

```ts
export const SIDE_TRANSITION_MS = 10_000;
export type SideStage = 'first' | 'transition' | 'second';

export function sideStageFor(
  set: Pick<WorkoutSet, 'isCompleted' | 'setType' | 'unilateralSecondSideStartsAt'>,
  unilateral: boolean,
  now = Date.now(),
): SideStage | null {
  if (!unilateral || set.setType === 'warmup' || set.isCompleted === 1) return null;
  if (set.unilateralSecondSideStartsAt === undefined) return 'first';
  return now < set.unilateralSecondSideStartsAt ? 'transition' : 'second';
}
```

- [ ] **Step 4: écrire les mutations repository atomiques**

```ts
export type FirstSideWrite =
  | { kind: 'started'; startsAt: number }
  | { kind: 'existing'; startsAt: number }
  | { kind: 'ignored' };

export async function completeFirstSide(setId: string, now = Date.now()): Promise<FirstSideWrite> {
  return db.transaction('rw', db.workoutSets, async () => {
    const set = await db.workoutSets.get(setId);
    if (
      set === undefined ||
      set.deletedAt !== 0 ||
      set.isCompleted === 1 ||
      set.setType === 'warmup'
    ) {
      return { kind: 'ignored' };
    }
    if (set.unilateralSecondSideStartsAt !== undefined) {
      return { kind: 'existing', startsAt: set.unilateralSecondSideStartsAt };
    }
    const startsAt = now + SIDE_TRANSITION_MS;
    await db.workoutSets.put(touch(set, { unilateralSecondSideStartsAt: startsAt }));
    return { kind: 'started', startsAt };
  });
}
```

`completeSet` et `uncompleteSet` écrivent explicitement
`unilateralSecondSideStartsAt: undefined`. Le round-trip JSON doit conserver le champ lorsqu'une
séance active est exportée au milieu de la transition.

- [ ] **Step 5: vérifier GREEN**

Run: `npm run test:run -- src/features/workout/sideProgress.test.ts src/data/repositories/workouts.test.ts src/data/repositories/backup.test.ts && npm run typecheck`

Expected: PASS. Aucun `db.version(12)` : le champ n'est pas indexé.

- [ ] **Step 6: commit**

```bash
git add src/data/types.ts src/data/repositories/workoutSets.ts src/data/repositories/workouts.ts src/data/repositories/workouts.test.ts src/features/workout/sideProgress.ts src/features/workout/sideProgress.test.ts src/data/repositories/backup.test.ts
git commit -m "feat(workout): persist unilateral side progress"
```

---

### Task 9: Contrôle manuel des côtés et cadence découplée

**Files:**

- Modify: `src/features/workout/useWorkoutPace.ts`
- Modify: `src/features/workout/useWorkoutPace.test.tsx`
- Modify: `src/features/workout/WorkoutSetRow.tsx`
- Modify: `src/features/workout/WorkoutExerciseCard.tsx`
- Modify: `src/features/workout/WorkoutScreen.tsx`
- Modify: `src/features/workout/WorkoutScreen.integration.test.tsx`
- Modify: `src/features/workout/HoldRail.tsx`
- Modify: `src/features/workout/RepPaceRail.tsx`
- Create: `src/features/workout/RepPaceRail.test.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**

- `WorkoutSetRow` consumes `sideStage: SideStage | null`.
- `useWorkoutPace` no longer owns durable `SideCycle`; it only reacts to a supplied stage.

- [ ] **Step 1: écrire les tests RED des deux modes**

```tsx
it('Voix uniquement ne lance jamais le pacer de répétitions mais garde le maintien', () => {
  applyAnnouncerMode('voice-only');
  const reps = mount('weight_reps', [workoutSet('s1', 10)]);
  expect(reps.pace().startFor(reps.line)).toBe(false);
  expect(useRepPacer.getState().setId).toBeNull();

  const hold = mount('time_only', [workoutSet('h1')]);
  expect(hold.pace().startFor(hold.line)).toBe(true);
  expect(useHoldTimer.getState().setId).toBe('h1');
});

it('valide manuellement premier puis second côté en une seule série', async () => {
  const workoutId = await seedUnilateralRepWorkout();
  applyAnnouncerMode('voice-only');
  const user = userEvent.setup();
  renderWorkout();
  await user.click(screen.getByRole('button', { name: 'Premier côté terminé — série 1' }));
  expect(await firstSet(workoutId)).toMatchObject({ isCompleted: 0 });
  expect(useRestTimer.getState().setId).toBeNull();
  expect(screen.getByText(/Changement de côté/)).toBeVisible();
  vi.setSystemTime(Date.now() + 10_000);
  await user.click(screen.getByRole('button', { name: 'Terminer la série 1' }));
  expect(await firstSet(workoutId)).toMatchObject({ isCompleted: 1 });
});
```

- [ ] **Step 2: lancer RED**

Run: `npm run test:run -- src/features/workout/useWorkoutPace.test.tsx src/features/workout/WorkoutScreen.integration.test.tsx -t "Voix uniquement|Premier côté"`

Expected: FAIL, la cadence part encore et la coche complète dès le premier tap.

- [ ] **Step 3: conditionner uniquement les cibles reps**

Dans `useWorkoutPace`, avant tout armement ou relais d'une cible `kind === 'reps'` :

```ts
const repPacingEnabled = (): boolean => guidancePolicy(loadAnnouncerMode()).repPacing;

if (target.kind === 'reps' && !repPacingEnabled()) {
  stopPace(target.setId);
  setPlan(IDLE_PACE_PLAN);
  return false;
}
```

Ne pas appliquer cette garde aux `hold`. Retirer le `cycleRef` et la responsabilité de persistance
de `useWorkoutPace`. La fin automatique d'une cadence appelle le même callback
`onFirstSideComplete(setId)` que le bouton manuel.

- [ ] **Step 4: rendre le stade dans la ligne**

Libellés :

```ts
'workout.sideFirst': 'Premier côté en cours',
'workout.sideTransition': 'Changement de côté · {seconds}',
'workout.sideSecond': 'Second côté en cours',
'workout.completeFirstSide': 'Premier côté terminé — série {number}',
'workout.completeSecondSide': 'Terminer la série {number}',
```

Pendant `transition`, le bouton est désactivé jusqu'à l'échéance ; un intervalle visuel de 250 ms
met le libellé à jour, mais le stade est toujours dérivé de la deadline persistée.

- [ ] **Step 5: orchestrer le geste dans WorkoutScreen**

Avant `completeSet` :

```ts
const stage = sideStageFor(set, workoutExerciseIdentityOf(line).isUnilateral === 1);
if (stage === 'first') {
  void completeFirstSide(setId).then((result) => {
    if (result.kind === 'started') {
      announce('side-change');
      pace.startSecondSideIfEnabled(line, set, result.startsAt);
    }
  });
  return;
}
if (stage === 'transition') return;
// `second` ou bilatéral : chemin completeSet + repos existant.
```

Le premier côté ne publie pas `workout-set-completed`, ne démarre pas repos/RPE/records. Le second
publie l'événement une fois.

- [ ] **Step 6: vérifier GREEN**

Run: `npm run test:run -- src/features/workout/useWorkoutPace.test.tsx src/features/workout/WorkoutScreen.integration.test.tsx src/features/workout/HoldRail.test.tsx src/features/workout/RepPaceRail.test.tsx && npm run typecheck`

Expected: PASS pour reps, maintien, bilatéral, unilatéral, Silence et Voix uniquement.

- [ ] **Step 7: commit**

```bash
git add src/features/workout/useWorkoutPace.ts src/features/workout/useWorkoutPace.test.tsx src/features/workout/WorkoutSetRow.tsx src/features/workout/WorkoutExerciseCard.tsx src/features/workout/WorkoutScreen.tsx src/features/workout/WorkoutScreen.integration.test.tsx src/features/workout/HoldRail.tsx src/features/workout/RepPaceRail.tsx src/features/workout/RepPaceRail.test.tsx src/i18n/fr.ts
git commit -m "feat(workout): make unilateral sides explicit without cadence"
```

---

### Task 10: Reproduire et supprimer la double annonce du gainage

**Files:**

- Modify: `src/features/workout/WorkoutScreen.integration.test.tsx`
- Modify: `src/features/workout/useWorkoutPace.test.tsx`
- Modify: `src/audio/holdMarks.test.ts`
- Modify: `src/features/workout/WorkoutScreen.tsx`
- Modify: `src/data/repositories/workoutSets.ts`
- Modify: `src/data/repositories/workouts.test.ts`
- Do not modify: `public/voice/*.mp3`

**Interfaces:**

- Invariant: one first-side gesture → one `side-change`, zero `rest-10`, zero `pace-start-10`.

- [ ] **Step 1: écrire la reproduction instrumentée avant le correctif**

```tsx
it('annonce une seule reprise au changement de côté du gainage', async () => {
  await seedUnilateralHoldWorkout();
  const user = userEvent.setup();
  renderWorkout();
  await user.click(screen.getByRole('button', { name: 'Chrono de Planche latérale' }));
  await user.click(await screen.findByRole('button', { name: t('workout.holdStart') }));
  act(() => useHoldTimer.setState({ startedAt: Date.now() - 30_000 }));
  announce.mockClear();
  await user.click(screen.getByRole('button', { name: 'Premier côté terminé — série 1' }));

  expect(announce.mock.calls.map(([cue]) => cue)).toEqual(['side-change']);
  expect(announce).toHaveBeenCalledTimes(1);
  expect(useRestTimer.getState().setId).toBeNull();
});
```

Ajouter un test manifeste : le cue `side-change` possède exactement un clip et son texte source
contient exactement une occurrence normalisée de « reprise dans dix secondes ».

- [ ] **Step 2: lancer la reproduction**

Run: `npm run test:run -- src/features/workout/WorkoutScreen.integration.test.tsx src/features/workout/useWorkoutPace.test.tsx src/audio/holdMarks.test.ts -t "une seule reprise|changement de côté"`

Expected: au moins un test FAIL avant correction. Si tout passe, reproduire dans le navigateur avec
les appels `announce` tracés ; ne modifier aucun code tant que la deuxième source n'est pas située.

- [ ] **Step 3: rendre l'annonce idempotente sur la mutation gagnante**

Conserver l'annonce exclusivement dans la branche `result.kind === 'started'` de Task 9. Un second
tap, un double effet StrictMode ou une reprise qui relit la deadline reçoit `existing` et ne parle
pas. Retirer tout autre `announce('side-change')` du relais de cadence/maintien. `HoldRail` continue
d'armer uniquement `rest-3`, `rest-2`, `rest-1` pour la transition, jamais `rest-10` ni
`pace-start-10`.

Ajouter au test repository :

```ts
const first = await completeFirstSide(set.id, 1_000);
const replay = await completeFirstSide(set.id, 1_001);
expect(first).toEqual({ kind: 'started', startsAt: 11_000 });
expect(replay).toEqual({ kind: 'existing', startsAt: 11_000 });
```

Le test `holdMarks.test.ts` vérifie la source textuelle. Si le navigateur fait encore entendre une
répétition avec un seul appel `voicePack.play`, ajouter dans `PROGRESS.md` la preuve que
`public/voice/side-change-1.mp3` doit être remplacé pendant la phase voix ; ne pas altérer la machine
pour compenser le contenu d'un fichier.

Le résultat code doit respecter :

```ts
expect(cues).toEqual(['side-change', 'rest-3', 'rest-2', 'rest-1']);
```

après les dix secondes complètes, et aucun `rest-10`/`pace-start-10`.

- [ ] **Step 4: vérifier GREEN**

Run: `npm run test:run -- src/features/workout/WorkoutScreen.integration.test.tsx src/features/workout/useWorkoutPace.test.tsx src/audio/holdMarks.test.ts`

Expected: PASS avec une seule annonce de reprise.

- [ ] **Step 5: commit**

```bash
git add src/features/workout/WorkoutScreen.tsx src/features/workout/WorkoutScreen.integration.test.tsx src/features/workout/useWorkoutPace.test.tsx src/data/repositories/workoutSets.ts src/data/repositories/workouts.test.ts src/audio/holdMarks.test.ts
git commit -m "fix(workout): announce unilateral hold transition once"
```

---

## Phase 4 — Validation réelle et documentation

### Task 11: Audit navigateur mobile de tous les scénarios

**Files:**

- Create: `docs/testing/tutorial-browser-checklist.md`
- Modify: `docs/product/FEATURE-INVENTORY.md`
- Modify: `PROGRESS.md`

**Interfaces:**

- Produces: preuve visuelle et fonctionnelle des parcours frais et peuplés.

- [ ] **Step 1: démarrer une origine fraîche**

Run: `npm run dev -- --host 127.0.0.1 --port 5174`

Expected: Vite sert l'application ; utiliser une origine/stockage vierge.

- [ ] **Step 2: vérifier la campagne à 390 × 844**

Dans le navigateur intégré :

1. Commencer sans routine.
2. Vérifier chaque route C01–C20 et chaque cible.
3. Mesurer que le HUD reste ≤ 28 % de la hauteur.
4. Vérifier que l'élément ciblé reste visible et cliquable.
5. Fermer/recharger après C09 puis C16 ; reprendre exactement.
6. Confirmer qu'aucune séance n'existe avant le vrai Démarrer.
7. Rejouer en sombre, clair, Silence et réduction des animations.

- [ ] **Step 3: vérifier Programmes**

Parcourir P01–P18 sur une base avec « Séance découverte », puis sur une base sans routine. Vérifier
liste, `/programs/new`, détail dynamique, absence de démarrage automatique et aides propres à
chaque sous-route.

- [ ] **Step 4: vérifier Voix uniquement et unilatéral**

1. Sélectionner Voix uniquement.
2. Lancer Curl haltères : aucun pacer de reps, aucun impact, aucun 3–2–1 de reps.
3. Laisser finir un repos : « Reprise dans dix secondes », 3–2–1 et fin conservés.
4. Lancer une planche latérale : Premier côté → une annonce → 10 s → Second côté.
5. Recharger pendant les 10 s et après leur fin : le côté reste correct.
6. Valider le second côté : une série, un repos, un événement tutorial.

- [ ] **Step 5: corriger toute divergence avec le même cycle de skills**

Pour chaque divergence frontend : brainstorming ciblé, diagnostic, Impeccable/frontend-design,
test RED, correction, nouvelle capture navigateur. Ne pas accumuler plusieurs défauts non reliés
dans un même commit.

- [ ] **Step 6: mettre à jour l'inventaire et PROGRESS**

Consigner pour chaque mission : route, ancre, événement, garde, état frais/peuplé, texte validé et
clip à générer. Ajouter le checkpoint téléphone : campagne Curl, Programmes, Voix uniquement,
gainage unilatéral avec rechargement.

- [ ] **Step 7: exécuter les quatre portes**

Run: `npm run typecheck`

Expected: exit 0.

Run: `npm run lint`

Expected: exit 0.

Run: `npm run test:run`

Expected: toutes les suites PASS.

Run: `npm run build`

Expected: build Vite réussi.

- [ ] **Step 8: vérifier le diff**

Run: `git diff --check && git status --short`

Expected: aucune erreur d'espacement ; seuls les fichiers du plan et les changements utilisateur
préexistants sont listés.

- [ ] **Step 9: commit documentation et preuves**

```bash
git add PROGRESS.md docs/product/FEATURE-INVENTORY.md docs/testing/tutorial-browser-checklist.md
git commit -m "docs: verify interactive tutorials and voice-only mode"
```

Ne jamais ajouter `.codex-remote-attachments/`.

---

## Séquence de livraison recommandée

1. Phase 1 seule doit déjà livrer une campagne Curl utilisable et corriger le routage/HUD.
2. Phase 2 ajoute Programmes puis la couverture contextuelle sans dépendre de l'audio.
3. Phase 3 ajoute Voix uniquement et la nouvelle autorité manuelle des côtés.
4. Phase 4 bloque la génération des voix tant que les textes et cibles ne sont pas validés dans le
   navigateur.

La génération et le branchement des voix feront l'objet d'un plan séparé après validation de ce
plan et de toutes les copies françaises.
