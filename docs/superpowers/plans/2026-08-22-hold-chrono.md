# Chrono de série chronométrée — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** donner à FitTrack un chrono de série pour les exercices chronométrés — il compte le
temps tenu à voix haute toutes les cinq secondes, et la coche écrit la durée dans la série.

**Architecture :** un jumeau du métronome de répétitions, pas une fusion. `repPacer` reste
intact ; un store éphémère `holdTimer`, un module de repères purs et un relevé `HoldRail` lui
font face. `useWorkoutPace` devient l'arbitre unique : la cible de cadence devient une union
`reps | hold`, et une seule des deux horloges tourne à un instant donné.

**Tech Stack :** React 19 + TypeScript strict, Zustand (état éphémère), Vitest + Testing
Library, Web Audio via `src/audio/*`.

**Spec :** `docs/superpowers/specs/2026-08-22-hold-chrono-design.md`

## Global Constraints

- Code, noms de fichiers et de variables **en anglais** ; interface **en français**.
- Aucune chaîne en dur dans un composant : tout texte d'UI vit dans `src/i18n/fr.ts`.
- Pas de `any`. Dates et instants : epoch ms (`number`).
- Un fichier = une responsabilité ; découper au-delà de ~300 lignes.
- TDD sur la logique métier : le test échoue **avant** l'implémentation.
- **`HOLD_RELEASE_SECONDS = 2`** — valeur exacte, constante nommée, jamais un réglage.
- **`HOLD_MARK_SECONDS`** — 36 valeurs, de 5 à 180 par pas de 5. Aucun repère au-delà.
- **Aucun clip vocal n'est déclaré dans `src/audio/voiceScript.json` ni généré dans ce lot.**
- Le mode **Silence reste silencieux** ; le mode **sons** produit une tonalité, jamais une voix.
- Commits fréquents et conventionnels (`feat(workout):`, `refactor(workout):`, `docs:`).
- Ne jamais lire, afficher ni committer une clé d'API.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/audio/holdMarks.ts` *(créé)* | les 36 secondes des repères et le `CueId` de chacune |
| `src/audio/holdMarks.test.ts` *(créé)* | épingle les 36 valeurs et la forme du cue |
| `src/audio/cues.ts` *(modifié)* | ajoute les 36 définitions, générées depuis le tableau |
| `src/features/workout/holdDuration.ts` *(créé)* | le temps réellement tenu, relâchement retiré |
| `src/features/workout/holdDuration.test.ts` *(créé)* | TDD de la correction |
| `src/features/workout/holdBeats.ts` *(créé)* | les repères d'un maintien et leur armement |
| `src/features/workout/holdBeats.test.ts` *(créé)* | TDD, calqué sur `repBeats.test.ts` |
| `src/stores/holdTimer.ts` *(créé)* | l'état éphémère du maintien en cours |
| `src/features/workout/paceTarget.ts` *(modifié)* | cadence et cible discriminées `reps \| hold` |
| `src/features/workout/useWorkoutPace.ts` *(modifié)* | l'arbitre : une seule horloge à la fois |
| `src/features/workout/HoldRail.tsx` *(créé)* | le relevé « Départ · 7 » puis « 1:12 » |
| `src/features/workout/WorkoutExerciseCard.tsx` *(modifié)* | place le relevé, étend le stop |
| `src/features/workout/WorkoutSetRow.tsx` *(modifié)* | la coche est active pendant un maintien |
| `src/features/workout/PaceSheet.tsx` *(modifié)* | vue « chrono » sans tempo par répétition |
| `src/features/workout/WorkoutScreen.tsx` *(modifié)* | branche le chrono, la coche écrit la durée |
| `src/i18n/fr.ts` *(modifié)* | les textes du chrono |

---

### Task 1 : les 36 repères et leurs cues

**Files:**
- Create: `src/audio/holdMarks.ts`
- Create: `src/audio/holdMarks.test.ts`
- Modify: `src/audio/cues.ts`
- Test: `src/audio/holdMarks.test.ts`, `src/audio/cues.test.ts`

**Interfaces:**
- Consumes: `CueDefinition` et `CueId` de `src/audio/cues.ts`.
- Produces: `HOLD_MARK_SECONDS`, `HoldMarkSeconds`, `HoldMarkCue`,
  `HOLD_MARK_LIMIT_SECONDS: number`, `holdMarkCue(seconds: HoldMarkSeconds): HoldMarkCue`.
  `CueId` inclut désormais `HoldMarkCue`.

- [ ] **Step 1 : écrire le test qui échoue**

Créer `src/audio/holdMarks.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { CUES, clipsFor } from './cues';
import { HOLD_MARK_LIMIT_SECONDS, HOLD_MARK_SECONDS, holdMarkCue } from './holdMarks';

describe('HOLD_MARK_SECONDS', () => {
  it('compte trente-six repères, de cinq en cinq, de 5 s à 3 min', () => {
    expect(HOLD_MARK_SECONDS).toHaveLength(36);
    expect(HOLD_MARK_SECONDS[0]).toBe(5);
    expect(HOLD_MARK_LIMIT_SECONDS).toBe(180);
    expect([...HOLD_MARK_SECONDS]).toEqual(
      Array.from({ length: 36 }, (_, index) => (index + 1) * 5),
    );
  });

  it('nomme le cue d’un repère par ses secondes', () => {
    expect(holdMarkCue(45)).toBe('hold-45');
    expect(holdMarkCue(180)).toBe('hold-180');
  });
});

describe('les cues des repères', () => {
  it('sont tous définis, avec une tonalité et sans musique baissée', () => {
    for (const seconds of HOLD_MARK_SECONDS) {
      const definition = CUES[holdMarkCue(seconds)];
      expect(definition).toBeDefined();
      expect(definition.tone).toBe('repTap');
      expect(definition.duckMusic).toBe(false);
    }
  });

  // Le lot ne génère aucune voix : un identifiant déclaré sans MP3 derrière lui
  // est un silence qui se fait passer pour une phrase.
  it('n’ont encore aucun clip, donc aucune voix', () => {
    for (const seconds of HOLD_MARK_SECONDS) {
      expect(clipsFor(holdMarkCue(seconds))).toHaveLength(0);
    }
  });
});
```

- [ ] **Step 2 : lancer le test et vérifier qu'il échoue**

```bash
npx vitest run src/audio/holdMarks.test.ts
```

Attendu : FAIL — `Failed to resolve import "./holdMarks"`.

- [ ] **Step 3 : écrire `src/audio/holdMarks.ts`**

```ts
/**
 * Les repères parlés d'un maintien : où on en est, toutes les cinq secondes.
 *
 * **Le temps écoulé, jamais un décompte.** Un gainage à l'usure n'a pas de
 * cible : il n'y a rien à décompter, et la seule question de celui qui tient
 * est « depuis combien de temps ». C'est aussi ce qui rend les repères
 * réutilisables d'une série prescrite à une série tenue jusqu'à la faute.
 *
 * **Trois minutes, et pas une seconde de plus.** Au-delà, le chrono continue à
 * l'écran et se tait : un repère annoncé sans clip enregistré derrière lui est
 * un silence qui se fait passer pour une phrase.
 *
 * Ce tableau est **la** source. Le type des cues en dérive, et `cues.ts`
 * génère les définitions depuis lui — trente-six lignes recopiées à la main
 * finiraient par diverger d'une seule.
 */
export const HOLD_MARK_SECONDS = [
  5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100, 105, 110, 115,
  120, 125, 130, 135, 140, 145, 150, 155, 160, 165, 170, 175, 180,
] as const;

export type HoldMarkSeconds = (typeof HOLD_MARK_SECONDS)[number];

/** Un cue par repère : il faut jouer *le* bon nombre, pas un tirage au sort. */
export type HoldMarkCue = `hold-${HoldMarkSeconds}`;

/** Le dernier repère annoncé. Le chrono continue muet ensuite. */
export const HOLD_MARK_LIMIT_SECONDS: number = HOLD_MARK_SECONDS[HOLD_MARK_SECONDS.length - 1];

export function holdMarkCue(seconds: HoldMarkSeconds): HoldMarkCue {
  return `hold-${seconds}`;
}
```

- [ ] **Step 4 : brancher les cues dans `src/audio/cues.ts`**

Ajouter l'import sous `import script from './voiceScript.json';` :

```ts
import { HOLD_MARK_SECONDS, holdMarkCue, type HoldMarkCue } from './holdMarks';
```

Étendre l'union `CueId` — remplacer la dernière branche `| 'workout-finished';` par :

```ts
  | 'workout-finished'
  /** Les repères du chrono de maintien — cf. `holdMarks.ts`. */
  | HoldMarkCue;
```

Insérer, **entre** l'interface `CueDefinition` et la constante `CUES` :

```ts
/**
 * Les trente-six repères du chrono, générés depuis leur seule source.
 *
 * Même profil que les battements de répétitions, et pour la même raison : ils
 * tombent pendant l'effort, sous la barre ou en gainage. Une tonalité douce,
 * pour que le mode « sons » ne soit pas muet sur un maintien — ce serait rater
 * le besoin d'origine —, et pas de musique baissée : on est à l'intérieur d'une
 * série, pas entre deux.
 */
const HOLD_MARK_CUES = Object.fromEntries(
  HOLD_MARK_SECONDS.map((seconds) => [
    holdMarkCue(seconds),
    { tone: 'repTap', priority: 1, gapMs: 700, cooldownMs: 0, duckMusic: false },
  ]),
) as Record<HoldMarkCue, CueDefinition>;
```

Enfin, dans le littéral `CUES`, ajouter la dernière ligne **après** l'entrée
`'workout-finished'` et avant l'accolade fermante :

```ts
  ...HOLD_MARK_CUES,
};
```

- [ ] **Step 5 : relancer et vérifier que tout passe**

```bash
npx vitest run src/audio/holdMarks.test.ts src/audio/cues.test.ts
```

Attendu : PASS sur les deux fichiers.

- [ ] **Step 6 : commit**

```bash
git add src/audio/holdMarks.ts src/audio/holdMarks.test.ts src/audio/cues.ts
git commit -m "feat(workout): déclarer les repères du chrono de maintien"
```

---

### Task 2 : le temps réellement tenu

**Files:**
- Create: `src/features/workout/holdDuration.ts`
- Create: `src/features/workout/holdDuration.test.ts`
- Test: `src/features/workout/holdDuration.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `HOLD_RELEASE_SECONDS: number` (= 2),
  `heldSecondsAt(startedAt: number, tappedAt: number): number`.

- [ ] **Step 1 : écrire le test qui échoue**

Créer `src/features/workout/holdDuration.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { HOLD_RELEASE_SECONDS, heldSecondsAt } from './holdDuration';

describe('heldSecondsAt', () => {
  it('retire le temps de relâchement du temps écoulé', () => {
    expect(HOLD_RELEASE_SECONDS).toBe(2);
    expect(heldSecondsAt(0, 47_000)).toBe(45);
  });

  it('arrondit à la seconde la plus proche avant de corriger', () => {
    expect(heldSecondsAt(0, 47_400)).toBe(45);
    expect(heldSecondsAt(0, 47_600)).toBe(46);
  });

  // Une coche immédiate note zéro, jamais une durée négative : une série de
  // −2 s dans l'historique serait un chiffre que rien ne peut plus expliquer.
  it('ne descend jamais sous zéro', () => {
    expect(heldSecondsAt(0, 1_000)).toBe(0);
    expect(heldSecondsAt(0, 0)).toBe(0);
  });

  // Toucher la coche pendant la préparation, avant même le premier repère.
  it('note zéro quand la coche tombe avant le départ', () => {
    expect(heldSecondsAt(10_000, 4_000)).toBe(0);
  });
});
```

- [ ] **Step 2 : lancer le test et vérifier qu'il échoue**

```bash
npx vitest run src/features/workout/holdDuration.test.ts
```

Attendu : FAIL — `Failed to resolve import "./holdDuration"`.

- [ ] **Step 3 : écrire `src/features/workout/holdDuration.ts`**

```ts
/**
 * Le temps réellement tenu, compté depuis la coche.
 *
 * **On tape après avoir relâché.** La main quitte la barre ou le sol, puis va
 * chercher l'écran : entre la fin de l'effort et le geste, il s'écoule toujours
 * un peu de temps. Sans cette correction, chaque maintien serait sur-noté des
 * mêmes deux secondes, à chaque série, pour toujours — une dérive silencieuse
 * qui finirait dans les records de durée et dans les courbes, sans que rien à
 * l'écran ne permette de la soupçonner.
 *
 * Deux secondes, constante nommée : c'est un nombre qu'on règle une fois. Un
 * écran de réglage pour ça coûterait plus cher à comprendre qu'à corriger ici
 * si la salle dit autre chose.
 */
export const HOLD_RELEASE_SECONDS = 2;

export function heldSecondsAt(startedAt: number, tappedAt: number): number {
  const elapsed = Math.round((tappedAt - startedAt) / 1_000);
  return Math.max(0, elapsed - HOLD_RELEASE_SECONDS);
}
```

- [ ] **Step 4 : relancer et vérifier que ça passe**

```bash
npx vitest run src/features/workout/holdDuration.test.ts
```

Attendu : PASS, 4 tests.

- [ ] **Step 5 : commit**

```bash
git add src/features/workout/holdDuration.ts src/features/workout/holdDuration.test.ts
git commit -m "feat(workout): retirer le relâchement du temps tenu"
```

---

### Task 3 : les battements du chrono

**Files:**
- Create: `src/features/workout/holdBeats.ts`
- Create: `src/features/workout/holdBeats.test.ts`
- Test: `src/features/workout/holdBeats.test.ts`

**Interfaces:**
- Consumes: `HOLD_MARK_SECONDS`, `holdMarkCue` (Task 1) ; `announce` de `@/audio/announce`.
- Produces: `interface HoldBeat { cue: CueId; at: number }`,
  `holdBeats(startedAt: number): HoldBeat[]`,
  `pendingHoldBeats(beats: readonly HoldBeat[], now: number): HoldBeat[]`,
  `armHoldChrono(startedAt: number, now?: number): () => void`.

- [ ] **Step 1 : écrire le test qui échoue**

Créer `src/features/workout/holdBeats.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { armHoldChrono, holdBeats, pendingHoldBeats } from './holdBeats';

const announce = vi.hoisted(() => vi.fn<(cue: string, when?: number) => boolean>(() => true));

vi.mock('@/audio/announce', () => ({ announce }));

describe('holdBeats', () => {
  it('pose un repère toutes les cinq secondes, jusqu’à trois minutes', () => {
    const beats = holdBeats(1_000);
    expect(beats).toHaveLength(36);
    expect(beats[0]).toEqual({ cue: 'hold-5', at: 6_000 });
    expect(beats[11]).toEqual({ cue: 'hold-60', at: 61_000 });
    expect(beats[35]).toEqual({ cue: 'hold-180', at: 181_000 });
  });

  // Dérivés d'un départ absolu, jamais accumulés : un minuteur qui tire en
  // retard coûte ce repère-là, pas l'alignement de tout le maintien.
  it('dérive chaque repère du départ, pas du repère précédent', () => {
    expect(holdBeats(0).map(({ at }) => at)).toEqual(
      Array.from({ length: 36 }, (_, index) => (index + 1) * 5_000),
    );
  });

  // Toute la différence avec `repBeats` : un maintien ne sait pas quand il
  // finit. Une cible prescrite est annoncée à son échéance comme n'importe
  // quel repère, et le chrono continue — une cible est un objectif, pas une
  // limite.
  it('ne décide jamais de la fin d’une série', () => {
    expect(holdBeats(0).some(({ cue }) => cue === 'set-done')).toBe(false);
  });
});

describe('pendingHoldBeats', () => {
  it('garde ce qui est devant, tolère un réveil un peu tardif', () => {
    const beats = holdBeats(0);
    expect(
      pendingHoldBeats(beats, 10_100)
        .map(({ cue }) => cue)
        .slice(0, 2),
    ).toEqual(['hold-15', 'hold-20']);
    expect(pendingHoldBeats(beats, 9_900)[0].cue).toBe('hold-10');
  });

  it('ne garde rien passé le dernier repère', () => {
    expect(pendingHoldBeats(holdBeats(0), 200_000)).toEqual([]);
  });
});

describe('armHoldChrono', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('annonce chaque repère à son instant', () => {
    armHoldChrono(0, 0);

    vi.advanceTimersByTime(5_000);
    expect(announce).toHaveBeenCalledWith('hold-5');
    expect(announce).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5_000);
    expect(announce).toHaveBeenLastCalledWith('hold-10');
  });

  // Relâcher tôt ne doit pas laisser un « quarante-cinq » en l'air.
  it('annule tout ce qui reste', () => {
    const cancel = armHoldChrono(0, 0);
    cancel();
    vi.advanceTimersByTime(200_000);
    expect(announce).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2 : lancer le test et vérifier qu'il échoue**

```bash
npx vitest run src/features/workout/holdBeats.test.ts
```

Attendu : FAIL — `Failed to resolve import "./holdBeats"`.

- [ ] **Step 3 : écrire `src/features/workout/holdBeats.ts`**

```ts
import { announce } from '@/audio/announce';
import type { CueId } from '@/audio/cues';
import { HOLD_MARK_SECONDS, holdMarkCue } from '@/audio/holdMarks';

/**
 * Les repères d'un maintien : un toutes les cinq secondes, et rien d'autre.
 *
 * **Aucun battement de fin.** C'est toute la différence avec `repBeats` : une
 * série en répétitions sait combien de fois battre, donc elle sait quand elle
 * s'arrête. Un maintien ne le sait pas — il s'arrête quand celui qui tient
 * n'en peut plus, et c'est la coche qui le dit. Rien ici ne décide de la fin
 * d'une série.
 *
 * **Dérivés d'un départ absolu, jamais accumulés.** Chaque repère est
 * `startedAt + n × 5 s` : un minuteur qui tire en retard coûte ce repère-là et
 * non l'alignement de tout le maintien. Même règle que la barre de repos et
 * que le métronome de répétitions.
 */
export interface HoldBeat {
  cue: CueId;
  /** Instant du repère, à l'horloge murale. */
  at: number;
}

export function holdBeats(startedAt: number): HoldBeat[] {
  return HOLD_MARK_SECONDS.map((seconds) => ({
    cue: holdMarkCue(seconds),
    at: startedAt + seconds * 1_000,
  }));
}

/**
 * Les repères encore devant. Un chrono armé en retard garde ceux qu'il peut
 * honorer ; les 150 ms de mou absorbent un minuteur qui tire d'un cheveu trop
 * tard — sans quoi le premier repère est celui qu'on perd, à chaque fois.
 */
export function pendingHoldBeats(beats: readonly HoldBeat[], now: number): HoldBeat[] {
  return beats.filter((beat) => beat.at >= now - 150);
}

/**
 * Arme les repères restants et rend l'annulation.
 *
 * Un minuteur par repère plutôt qu'un intervalle, pour la même raison que le
 * métronome : un intervalle qui dérive de 20 ms par tour est à 700 ms au
 * trente-sixième. Annuler les efface tous d'un coup — relâcher tôt ne doit pas
 * laisser un « quarante-cinq » en l'air.
 */
export function armHoldChrono(startedAt: number, now = Date.now()): () => void {
  const timers = pendingHoldBeats(holdBeats(startedAt), now).map((beat) =>
    setTimeout(() => announce(beat.cue), Math.max(0, beat.at - now)),
  );

  return () => {
    for (const timer of timers) clearTimeout(timer);
  };
}
```

- [ ] **Step 4 : relancer et vérifier que ça passe**

```bash
npx vitest run src/features/workout/holdBeats.test.ts
```

Attendu : PASS, 5 tests.

- [ ] **Step 5 : commit**

```bash
git add src/features/workout/holdBeats.ts src/features/workout/holdBeats.test.ts
git commit -m "feat(workout): battre les repères d'un maintien"
```

---

### Task 4 : le store du maintien en cours

**Files:**
- Create: `src/stores/holdTimer.ts`
- Test: couvert par les tests des tâches 6 et 9 — un store Zustand de quinze lignes sans
  règle métier ne se teste pas à part, comme `repPacer` et `restTimer` avant lui.

**Interfaces:**
- Consumes: `zustand`.
- Produces: `interface HoldTimer { setId: string | null; rowId: string | null; startedAt: number }`,
  `useHoldTimer` avec `start(rowId: string, setId: string, leadSeconds?: number): void`
  et `stop(setId?: string): void`.

- [ ] **Step 1 : écrire `src/stores/holdTimer.ts`**

```ts
import { create } from 'zustand';

/**
 * Le chrono du maintien en cours — la troisième et dernière horloge éphémère
 * de l'écran de séance, pour exactement la raison des deux autres (ADR-004) :
 * un temps qui court n'est pas une donnée. Rien ici ne mérite d'être persisté,
 * rien ne survit à un kill, et perdre l'horloge coûte **une série mal notée**,
 * pas une séance. La durée, elle, part en base au moment de la coche.
 *
 * Un maintien à la fois. Démarrer un chrono sur une autre ligne remplace le
 * courant plutôt que d'en faire tourner deux — même règle que le repos et que
 * le métronome, et `useWorkoutPace` est ce qui la fait respecter entre les
 * deux horloges.
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
```

- [ ] **Step 2 : vérifier que le projet compile toujours**

```bash
npm run typecheck
```

Attendu : sortie 0.

- [ ] **Step 3 : commit**

```bash
git add src/stores/holdTimer.ts
git commit -m "feat(workout): tenir l'état du maintien en cours"
```

---

### Task 5 : la cadence et la cible deviennent discriminées

**Files:**
- Modify: `src/features/workout/paceTarget.ts`
- Modify: `src/features/workout/paceTarget.test.ts`
- Modify: `src/features/workout/paceMachine.test.ts`
- Test: `src/features/workout/paceTarget.test.ts`, `src/features/workout/paceMachine.test.ts`

**Interfaces:**
- Consumes: `isTimedMeasurement` de `@/lib/measurement`, `MeasurementType` de `@/data/types`.
- Produces:
  - `type PaceCadence = { kind: 'reps'; repSeconds: number } | { kind: 'hold' }`
  - `type PaceTarget = { kind: 'reps'; setId: string; reps: number; repSeconds: number } | { kind: 'hold'; setId: string }`
  - `cadenceFor(measurementType: MeasurementType, repSeconds: number): PaceCadence`
  - `prepareNextPace(sets: readonly WorkoutSet[], cadence: PaceCadence, afterSetId?: string): PacePreparation`
  - `PaceExerciseLine` porte `cadence: PaceCadence` au lieu de `repSeconds: number`
  - `nextPaceTarget` est **supprimé** (plus aucun appelant hors de son propre test)

- [ ] **Step 1 : écrire les tests qui échouent**

Dans `src/features/workout/paceTarget.test.ts` : supprimer le bloc
`describe('nextPaceTarget', …)` en entier, remplacer chaque appel
`prepareNextPace(sets, 3, …)` par `prepareNextPace(sets, REPS, …)`, et ajouter :

```ts
import { cadenceFor, prepareNextPace } from './paceTarget';

const REPS = { kind: 'reps', repSeconds: 3 } as const;
const HOLD = { kind: 'hold' } as const;

describe('cadenceFor', () => {
  it('bat les répétitions des exercices comptés', () => {
    expect(cadenceFor('weight_reps', 3)).toEqual({ kind: 'reps', repSeconds: 3 });
    expect(cadenceFor('reps_only', 2.5)).toEqual({ kind: 'reps', repSeconds: 2.5 });
    expect(cadenceFor('assisted_weight_reps', 3)).toEqual({ kind: 'reps', repSeconds: 3 });
  });

  it('chronomètre les exercices mesurés à la montre', () => {
    expect(cadenceFor('time_only', 3)).toEqual({ kind: 'hold' });
    expect(cadenceFor('weight_time', 3)).toEqual({ kind: 'hold' });
    expect(cadenceFor('distance_time', 3)).toEqual({ kind: 'hold' });
  });
});

describe('prepareNextPace, en maintien', () => {
  // La différence structurante : il n'y a rien à taper avant de tenir. Un
  // gainage à l'usure part sans savoir combien de temps il va durer.
  it('est prête sans aucune valeur saisie', () => {
    expect(prepareNextPace([{ ...set('a', 0, 8), reps: undefined }], HOLD)).toEqual({
      kind: 'ready',
      target: { kind: 'hold', setId: 'a' },
    });
  });

  it('saute les échauffements comme la cadence', () => {
    expect(prepareNextPace([set('w', 0, 8, 'warmup'), set('a', 0)], HOLD)).toEqual({
      kind: 'ready',
      target: { kind: 'hold', setId: 'a' },
    });
  });

  it('n’a plus rien à tenir quand tout est validé', () => {
    expect(prepareNextPace([set('a', 1)], HOLD)).toEqual({ kind: 'done' });
  });
});

describe('prepareNextPace, en répétitions', () => {
  it('porte le tempo et les répétitions dans la cible', () => {
    expect(prepareNextPace([set('a', 0, 12, 'normal', 7)], REPS)).toEqual({
      kind: 'ready',
      target: { kind: 'reps', setId: 'a', reps: 7, repSeconds: 3 },
    });
  });
});
```

Dans `src/features/workout/paceMachine.test.ts` : remplacer chaque cible littérale
`{ setId: 'x', reps: n, repSeconds: m }` par `{ kind: 'reps', setId: 'x', reps: n, repSeconds: m }`.

- [ ] **Step 2 : lancer les tests et vérifier qu'ils échouent**

```bash
npx vitest run src/features/workout/paceTarget.test.ts src/features/workout/paceMachine.test.ts
```

Attendu : FAIL — `cadenceFor is not a function`, plus des erreurs de forme sur les cibles.

- [ ] **Step 3 : réécrire les types et `prepareNextPace` dans `paceTarget.ts`**

Ajouter en tête du fichier, à côté de l'import de `WorkoutSet` :

```ts
import type { MeasurementType, WorkoutSet } from '@/data/types';
import { isTimedMeasurement } from '@/lib/measurement';
```

Remplacer l'interface `PaceTarget` par les deux types, et ajouter `cadenceFor` :

```ts
/**
 * Ce que bat l'horloge d'une ligne : des répétitions, ou une montre.
 *
 * C'est le type de mesure de l'exercice qui tranche, et lui seul —
 * `cadenceFor` est le seul endroit du dépôt qui a le droit de répondre à cette
 * question, exactement comme `lib/measurement` est le seul à dire de quoi une
 * série est faite.
 */
export type PaceCadence = { kind: 'reps'; repSeconds: number } | { kind: 'hold' };

/**
 * Quelle série l'horloge suit, et à quel rythme.
 *
 * **Répétitions saisies, jamais la prescription.** L'objectif pâle d'un champ
 * vide est un contexte, pas une consigne : le métronome ne prend une série que
 * lorsque le nombre qu'on s'apprête à faire est écrit.
 *
 * **Un maintien n'a pas d'équivalent, et c'est voulu.** Il n'y a rien à saisir
 * avant de tenir — la durée est le résultat, pas l'entrée.
 */
export type PaceTarget =
  | { kind: 'reps'; setId: string; reps: number; repSeconds: number }
  | { kind: 'hold'; setId: string };

/** La montre pour ce qui se mesure en temps, le métronome pour ce qui se compte. */
export function cadenceFor(measurementType: MeasurementType, repSeconds: number): PaceCadence {
  return isTimedMeasurement(measurementType) ? { kind: 'hold' } : { kind: 'reps', repSeconds };
}
```

Remplacer `PaceExerciseLine.repSeconds` par :

```ts
  /** La cadence de l'exercice, tempo déjà résolu contre la préférence. */
  cadence: PaceCadence;
```

Remplacer le corps de `prepareNextPace` :

```ts
export function prepareNextPace(
  sets: readonly WorkoutSet[],
  cadence: PaceCadence,
  afterSetId?: string,
): PacePreparation {
  const working = sets.filter((set) => set.deletedAt === 0 && set.setType !== 'warmup');
  const finishedIndex =
    afterSetId === undefined ? -1 : sets.findIndex((set) => set.id === afterSetId);
  const target = working.find(
    (set) =>
      set.isCompleted === 0 &&
      (finishedIndex < 0 || sets.findIndex((candidate) => candidate.id === set.id) > finishedIndex),
  );
  if (target === undefined) return { kind: 'done' };

  // Un maintien est prêt dès qu'il a une série : la durée est ce qu'il produit,
  // pas ce qu'il attend.
  if (cadence.kind === 'hold') {
    return { kind: 'ready', target: { kind: 'hold', setId: target.id } };
  }

  if (target.reps === undefined || target.reps <= 0) {
    return { kind: 'missing-reps', setId: target.id };
  }

  return {
    kind: 'ready',
    target: { kind: 'reps', setId: target.id, reps: target.reps, repSeconds: cadence.repSeconds },
  };
}
```

Supprimer entièrement `nextPaceTarget`. Dans `prepareFollowingExercisePace`, remplacer
`prepareNextPace(line.sets, line.repSeconds)` par `prepareNextPace(line.sets, line.cadence)`.

- [ ] **Step 4 : relancer et vérifier que tout passe**

```bash
npx vitest run src/features/workout/paceTarget.test.ts src/features/workout/paceMachine.test.ts
```

Attendu : PASS sur les deux fichiers.

- [ ] **Step 5 : commit**

```bash
git add src/features/workout/paceTarget.ts src/features/workout/paceTarget.test.ts src/features/workout/paceMachine.test.ts
git commit -m "refactor(workout): distinguer cadence de répétitions et maintien"
```

---

### Task 6 : `useWorkoutPace` arbitre les deux horloges

**Files:**
- Modify: `src/features/workout/useWorkoutPace.ts`
- Create: `src/features/workout/useWorkoutPace.test.tsx`
- Test: `src/features/workout/useWorkoutPace.test.tsx`

**Interfaces:**
- Consumes: `cadenceFor`, `prepareNextPace`, `prepareFollowingExercisePace`, `PaceTarget`
  (Task 5) ; `useHoldTimer` (Task 4) ; `workoutExerciseIdentityOf` de
  `@/data/repositories/workouts`.
- Produces: `WorkoutPace` garde ses noms de méthodes ; `Line` devient
  `Pick<WorkoutExerciseDetail, 'row' | 'sets' | 'exercise' | 'identity'>` ;
  `PaceSheetView` gagne `kind: 'reps' | 'hold'`.

**Les quatre règles à implémenter, dans l'ordre où elles comptent :**

1. Une seule horloge tourne : démarrer un maintien arrête le métronome, et réciproquement.
2. Un maintien démarré explicitement reçoit **dix secondes** de préparation — le temps de
   se mettre en position. Un maintien qui prend la suite d'un repos n'en reçoit **aucune** :
   le 3-2-1 du repos était sa préparation.
3. `armFromTypedReps` ne s'arme jamais sur une ligne chronométrée.
4. `stop(setId?)` arrête les deux horloges.

- [ ] **Step 1 : écrire le test qui échoue**

Créer `src/features/workout/useWorkoutPace.test.tsx` :

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render } from '@testing-library/react';
import type { Exercise, WorkoutExercise, WorkoutSet } from '@/data/types';
import { useHoldTimer } from '@/stores/holdTimer';
import { useRepPacer } from '@/stores/repPacer';
import { useRestTimer } from '@/stores/restTimer';
import { useWorkoutPace, type WorkoutPace } from './useWorkoutPace';

const announce = vi.hoisted(() => vi.fn(() => true));
vi.mock('@/audio/announce', () => ({ announce, primeAnnouncer: vi.fn() }));

const now = 1_000_000;

function exercise(measurementType: Exercise['measurementType']): Exercise {
  return {
    id: 'ex',
    createdAt: 0,
    updatedAt: 0,
    deletedAt: 0,
    name: 'Gainage',
    primaryMuscle: 'abs',
    secondaryMuscles: [],
    equipment: 'bodyweight',
    measurementType,
    isCustom: 0,
    isUnilateral: 0,
  };
}

function row(): WorkoutExercise {
  return {
    id: 'row',
    createdAt: 0,
    updatedAt: 0,
    deletedAt: 0,
    workoutId: 'w',
    exerciseId: 'ex',
    order: 0,
    supersetGroup: 0,
    restSeconds: 60,
  };
}

function workoutSet(id: string, reps?: number): WorkoutSet {
  return {
    id,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: 0,
    workoutExerciseId: 'row',
    exerciseId: 'ex',
    workoutId: 'w',
    order: 0,
    setType: 'normal',
    side: 'both',
    reps,
    isCompleted: 0,
    performedAt: 0,
  };
}

function mount(
  measurementType: Exercise['measurementType'],
  sets: WorkoutSet[] = [workoutSet('s1', 8)],
) {
  const line = { row: row(), exercise: exercise(measurementType), sets };
  const captured: { pace: WorkoutPace | null } = { pace: null };
  function Probe() {
    captured.pace = useWorkoutPace([line], 3);
    return null;
  }
  render(<Probe />);
  return { line, pace: () => captured.pace as WorkoutPace };
}

describe('useWorkoutPace', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.clearAllMocks();
    useRepPacer.getState().stop();
    useHoldTimer.getState().stop();
    useRestTimer.getState().stop();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('démarre un maintien avec dix secondes pour se mettre en position', () => {
    const { line, pace } = mount('time_only');

    act(() => {
      expect(pace().startFor(line)).toBe(true);
    });

    expect(useHoldTimer.getState().setId).toBe('s1');
    expect(useHoldTimer.getState().startedAt).toBe(now + 10_000);
    expect(announce).toHaveBeenCalledWith('pace-start-10');
  });

  // Le repos a déjà compté 3-2-1 : redonner dix secondes ferait attendre debout.
  it('enchaîne sans préparation quand le maintien suit un repos', () => {
    const { line, pace } = mount('time_only', [
      { ...workoutSet('s0'), isCompleted: 1 },
      workoutSet('s1'),
    ]);

    act(() => {
      expect(pace().startFor(line, 's0')).toBe(true);
    });

    expect(useHoldTimer.getState().startedAt).toBe(now);
  });

  it('n’a jamais deux horloges qui tournent', () => {
    const timed = mount('time_only');
    act(() => {
      useRepPacer.getState().start('row', 's1', 8, 3);
      timed.pace().startFor(timed.line);
    });

    expect(useRepPacer.getState().setId).toBeNull();
    expect(useHoldTimer.getState().setId).toBe('s1');

    const counted = mount('weight_reps');
    act(() => {
      counted.pace().startFor(counted.line);
    });

    expect(useHoldTimer.getState().setId).toBeNull();
    expect(useRepPacer.getState().setId).toBe('s1');
  });

  it('arrête les deux horloges', () => {
    const { line, pace } = mount('time_only');
    act(() => {
      pace().startFor(line);
      pace().stop();
    });

    expect(useHoldTimer.getState().setId).toBeNull();
    expect(useRepPacer.getState().setId).toBeNull();
  });

  // Un exercice chronométré n'a pas de colonne « reps » : rien ne doit s'armer.
  it('ne s’arme pas sur une valeur saisie dans une ligne chronométrée', () => {
    const { line, pace } = mount('time_only');
    act(() => {
      pace().armFromTypedReps(line, 's1', 8);
    });

    expect(useRepPacer.getState().setId).toBeNull();
    expect(useHoldTimer.getState().setId).toBeNull();
  });
});
```

- [ ] **Step 2 : lancer le test et vérifier qu'il échoue**

```bash
npx vitest run src/features/workout/useWorkoutPace.test.tsx
```

Attendu : FAIL — le maintien ne démarre pas, `useHoldTimer.getState().setId` vaut `null`.

- [ ] **Step 3 : implémenter l'arbitrage dans `useWorkoutPace.ts`**

Ajouter aux imports :

```ts
import { workoutExerciseIdentityOf } from '@/data/repositories/workouts';
import { useHoldTimer } from '@/stores/holdTimer';
import {
  cadenceFor,
  prepareFollowingExercisePace,
  prepareNextPace,
  type PaceTarget,
} from './paceTarget';
```

Élargir `Line` :

```ts
/** Une ligne d'exercice, telle que l'horloge la lit. */
type Line = Pick<WorkoutExerciseDetail, 'row' | 'sets' | 'exercise' | 'identity'>;
```

Dans le corps du hook, après `const stopPace = …` :

```ts
  const startHold = useHoldTimer((state) => state.start);
  const stopHold = useHoldTimer((state) => state.stop);
  const holdSetId = useHoldTimer((state) => state.setId);
  const holdRowId = useHoldTimer((state) => state.rowId);
```

Puis, juste après `repSecondsOf` :

```ts
  const cadenceOf = (line: Line) =>
    cadenceFor(workoutExerciseIdentityOf(line).measurementType, repSecondsOf(line));

  /**
   * Une seule horloge à la fois, et c'est ici que ça se décide.
   *
   * Deux horloges vivantes, ce sont deux files audio qui parlent l'une par-dessus
   * l'autre et deux relevés qui se disputent la même place dans le bandeau. Même
   * règle que « un seul repos à la fois », et elle est épinglée par un test
   * plutôt que laissée à la discipline des appelants.
   */
  const startClock = (rowId: string, target: PaceTarget, leadSeconds: number): void => {
    if (target.kind === 'hold') {
      stopPace();
      startHold(rowId, target.setId, leadSeconds);
      return;
    }
    stopHold();
    startPace(rowId, target.setId, target.reps, target.repSeconds, leadSeconds);
  };
```

Dans l'effet, remplacer l'appel `prepareNextPace(line.sets, resolveRepSeconds(…), …)` par
`prepareNextPace(line.sets, cadenceOf(line), …)`, et remplacer le dernier `setTimeout` par :

```ts
    const timer = setTimeout(() => {
      if (decision.announceStart) announce('pace-start-10');
      // Lu maintenant et non au moment de la décision : le délai de
      // stabilisation ne doit pas repousser le premier battement.
      startClock(decision.rowId, decision.target, leadSecondsAt(decision.launchAt, Date.now()));
      setPlan((current) => planWithoutSet(current, decision.setId));
    }, decision.delayMs);
    return () => clearTimeout(timer);
```

Remplacer `startFor` :

```ts
  const startFor = (line: Line, afterSetId?: string): boolean => {
    const preparation = prepareNextPace(line.sets, cadenceOf(line), afterSetId);
    if (preparation.kind === 'done') return false;
    primeAnnouncer();
    // Démarrer la série suivante est le signal le plus clair que le repos est
    // fini. Garder les deux horloges vivantes cache le relevé et laisse le
    // décompte du repos parler par-dessus les battements.
    stopRest();
    if (preparation.kind === 'missing-reps') {
      setPlan({ kind: 'awaiting-reps', rowId: line.row.id, setId: preparation.setId, afterSetId });
      announce('pace-reps-missing');
      return true;
    }
    // Un lancement explicite supplante ce qui se préparait : remplacer le plan
    // unique est ce qui empêche un départ différé de relancer une cadence que
    // l'utilisateur vient d'arrêter.
    setPlan(IDLE_PACE_PLAN);
    const target = preparation.target;
    // Se mettre en gainage prend dix secondes ; se remettre sous la barre après
    // un repos qui vient de compter 3-2-1 n'en prend aucune.
    const lead = target.kind === 'hold' && afterSetId === undefined ? PACE_LEAD_SECONDS : 0;
    if (lead > 0) announce('pace-start-10');
    startClock(line.row.id, target, lead);
    return true;
  };
```

Dans `startFollowing`, remplacer la construction des lignes :

```ts
    const following = prepareFollowingExercisePace(
      lines.map((line) => ({
        rowId: line.row.id,
        sets: line.sets,
        cadence: cadenceOf(line),
      })),
      completedLine.row.id,
    );
```

et la fin de la fonction :

```ts
    const target = following.preparation.target;
    setPlan(IDLE_PACE_PLAN);
    // Un nouvel exercice a droit à sa propre fenêtre de préparation. Le repos
    // vient de finir ; c'est un « dans dix secondes » neuf, suivi du 3-2-1.
    announce('pace-start-10');
    startClock(following.rowId, target, PACE_LEAD_SECONDS);
    return true;
```

Dans `armFromTypedReps`, ajouter en première ligne :

```ts
    // Une ligne chronométrée n'a pas de colonne « répétitions » : rien ne peut
    // y être tapé, et rien ne doit s'y armer.
    if (cadenceOf(line).kind === 'hold') return;
```

et ajouter `holdSetId !== null ||` à sa condition de sortie anticipée.

Remplacer `viewFor` et le `return` final :

```ts
  const viewFor = (line: Line | null, name: string): PaceSheetView | null => {
    if (line === null) return null;
    const cadence = cadenceOf(line);
    const running =
      cadence.kind === 'hold'
        ? holdRowId === line.row.id && holdSetId !== null
        : pacer.rowId === line.row.id && pacer.setId !== null;
    const preparation = prepareNextPace(line.sets, cadence);
    const target = preparation.kind === 'ready' ? preparation.target : null;

    return {
      kind: cadence.kind,
      rowId: line.row.id,
      name,
      repSeconds: running && cadence.kind === 'reps' ? pacer.repSeconds : repSecondsOf(line),
      defaultRepSeconds: defaultRepSeconds ?? repSecondsOf(line),
      reps:
        running && cadence.kind === 'reps'
          ? pacer.reps
          : target !== null && target.kind === 'reps'
            ? target.reps
            : null,
      canStart: preparation.kind !== 'done',
      running,
    };
  };

  const stop = (setId?: string): void => {
    stopPace(setId);
    stopHold(setId);
  };

  return { repSecondsOf, startFor, startFollowing, armFromTypedReps, stop, viewFor };
```

- [ ] **Step 4 : relancer et vérifier que tout passe**

```bash
npx vitest run src/features/workout/useWorkoutPace.test.tsx
```

```bash
npm run typecheck
```

Attendu : PASS (5 tests), puis typecheck sortie 0 — sauf les erreurs de `WorkoutScreen.tsx`
et `PaceSheet.tsx` que les tâches 7 et 8 ferment.

- [ ] **Step 5 : commit**

```bash
git add src/features/workout/useWorkoutPace.ts src/features/workout/useWorkoutPace.test.tsx
git commit -m "feat(workout): arbitrer métronome et chrono de maintien"
```

---

### Task 7 : le relevé du maintien

**Files:**
- Create: `src/features/workout/HoldRail.tsx`
- Create: `src/features/workout/HoldRail.test.tsx`
- Modify: `src/i18n/fr.ts`
- Test: `src/features/workout/HoldRail.test.tsx`

**Interfaces:**
- Consumes: `armHoldChrono` (Task 3), `HoldTimer` (Task 4), `fireCountdown` de
  `./restCountdown`, `formatRest` de `@/lib/rest`, `t` de `@/i18n/fr`.
- Produces: `HoldRail({ hold }: { hold: HoldTimer & { setId: string } })`.

- [ ] **Step 1 : ajouter les textes dans `src/i18n/fr.ts`**

Dans l'objet `workout`, juste après la ligne `paceStatus: …`, insérer :

```ts
    // Le chrono d'un maintien : la préparation réutilise « Départ · n », le
    // relevé dit le temps tenu en m:ss.
    holdStatus: 'Maintien · {time}',
    holdStart: 'Démarrer le chrono',
    holdStop: 'Arrêter le chrono',
    holdTitle: 'Chrono',
    holdOpen: 'Chrono de {name}',
    holdNoSet: 'Aucune série à chronométrer sur cet exercice.',
    holdHelp:
      'Le chrono compte le temps tenu et l’écrit dans la série quand tu valides. Les deux dernières secondes, celles du relâchement, ne sont pas comptées.',
```

- [ ] **Step 2 : écrire le test qui échoue**

Créer `src/features/workout/HoldRail.test.tsx` :

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HoldRail } from './HoldRail';

const announce = vi.hoisted(() => vi.fn(() => true));
vi.mock('@/audio/announce', () => ({ announce }));

const now = 1_000_000;

describe('HoldRail', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('annonce la préparation en secondes avant le départ', () => {
    render(<HoldRail hold={{ setId: 's1', rowId: 'row', startedAt: now + 7_000 }} />);
    expect(screen.getByText('Départ · 7')).toBeInTheDocument();
  });

  it('lit le temps tenu en minutes et secondes', () => {
    render(<HoldRail hold={{ setId: 's1', rowId: 'row', startedAt: now - 72_000 }} />);
    expect(screen.getByText('Maintien · 1:12')).toBeInTheDocument();
  });

  // Démonté, plus un seul repère en l'air : la vie du composant *est* celle du
  // maintien, comme le métronome.
  it('annule ses repères en se démontant', () => {
    const view = render(<HoldRail hold={{ setId: 's1', rowId: 'row', startedAt: now }} />);
    view.unmount();
    vi.advanceTimersByTime(200_000);
    expect(announce).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3 : lancer le test et vérifier qu'il échoue**

```bash
npx vitest run src/features/workout/HoldRail.test.tsx
```

Attendu : FAIL — `Failed to resolve import "./HoldRail"`.

- [ ] **Step 4 : écrire `src/features/workout/HoldRail.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { t } from '@/i18n/fr';
import { formatRest } from '@/lib/rest';
import type { HoldTimer } from '@/stores/holdTimer';
import { armHoldChrono } from './holdBeats';
import { fireCountdown } from './restCountdown';

/**
 * Le chrono du maintien en cours : il arme les repères, dit depuis combien de
 * temps on tient, et s'arrête avec la série.
 *
 * Monté avec la clé du set, comme la barre de repos et le métronome : la vie
 * du composant **est** celle du maintien, donc rien n'a à être annulé à la main
 * quand la série se termine ou qu'on relâche.
 *
 * Un relevé, pas une commande : il s'affiche dans le bouton de repli de
 * l'en-tête, et un bouton dans un bouton n'est pas valide. Arrêter, c'est le
 * carré à côté — cf. `WorkoutExerciseCard`.
 */
export function HoldRail({ hold }: { hold: HoldTimer & { setId: string } }) {
  useEffect(
    () => armHoldChrono(hold.startedAt),
    // Réarmé sur l'identité du maintien, jamais sur celle d'un callback.
    [hold.setId, hold.startedAt],
  );

  // Une préparation n'est pas un silence. Le 3-2-1 parlé n'est armé qu'à T−3
  // pour qu'il ne réserve pas la file vocale dix secondes trop tôt.
  useEffect(() => {
    const leadMs = hold.startedAt - Date.now();
    if (leadMs <= 0) return;
    const id = setTimeout(() => fireCountdown(hold.startedAt), Math.max(0, leadMs - 3_000));
    return () => clearTimeout(id);
  }, [hold.setId, hold.startedAt]);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  const leadSeconds = Math.max(0, Math.ceil((hold.startedAt - now) / 1_000));
  const heldSeconds = Math.max(0, Math.floor((now - hold.startedAt) / 1_000));

  return (
    <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-[var(--accent-ink)]">
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[var(--accent-ink)]" />
      <span className="tabular truncate">
        {leadSeconds > 0
          ? t('workout.pacePreparing', { seconds: leadSeconds })
          : t('workout.holdStatus', { time: formatRest(heldSeconds) })}
      </span>
    </span>
  );
}
```

- [ ] **Step 5 : relancer et vérifier que ça passe**

```bash
npx vitest run src/features/workout/HoldRail.test.tsx
```

Attendu : PASS, 3 tests.

- [ ] **Step 6 : commit**

```bash
git add src/features/workout/HoldRail.tsx src/features/workout/HoldRail.test.tsx src/i18n/fr.ts
git commit -m "feat(workout): lire le temps tenu dans le bandeau"
```

---

### Task 8 : la carte, la coche et la feuille

**Files:**
- Modify: `src/features/workout/WorkoutExerciseCard.tsx`
- Modify: `src/features/workout/WorkoutSetRow.tsx`
- Modify: `src/features/workout/PaceSheet.tsx`
- Modify: `src/features/workout/WorkoutExerciseCard.test.tsx`
- Test: `src/features/workout/WorkoutExerciseCard.test.tsx`

**Interfaces:**
- Consumes: `HoldRail` (Task 7), `HoldTimer` (Task 4), `PaceSheetView.kind` (Task 6).
- Produces: `export type CardHold = HoldTimer & { setId: string }` ;
  `WorkoutExerciseCard` accepte `hold: CardHold | null` ;
  `WorkoutSetRow` accepte `holding?: boolean` ;
  `PaceSheet` lit `view.kind`.

- [ ] **Step 1 : écrire le test qui échoue**

Ajouter à `src/features/workout/WorkoutExerciseCard.test.tsx` un cas qui rend la carte avec
un exercice `time_only`, une série sans durée saisie, et
`hold={{ setId: 's1', rowId: 'row', startedAt: Date.now() - 3_000 }}` :

```tsx
  it('porte le relevé du maintien et garde la coche active', () => {
    expect(screen.getByText(/Maintien ·/)).toBeInTheDocument();
    expect(screen.getByLabelText('Valider la série 1')).toBeEnabled();
  });
```

- [ ] **Step 2 : lancer le test et vérifier qu'il échoue**

```bash
npx vitest run src/features/workout/WorkoutExerciseCard.test.tsx
```

Attendu : FAIL — la prop `hold` n'existe pas ; la coche est désactivée.

- [ ] **Step 3 : `WorkoutSetRow.tsx` — la coche pendant un maintien**

Ajouter à `Props`, après `tutorial?: boolean;` :

```ts
  /**
   * Vrai tant que le chrono tourne sur cette série. La coche est alors le
   * geste qui l'arrête : la désactiver parce qu'aucune durée n'est encore
   * tapée enfermerait le chrono sans aucune sortie — la durée, justement,
   * c'est lui qui l'écrit.
   */
  holding?: boolean;
```

Ajouter `holding = false,` à la déstructuration, puis remplacer la ligne `disabled` du
bouton de validation :

```tsx
        disabled={!done && !holding && !isSetRecordable(columns, resolved)}
```

- [ ] **Step 4 : `WorkoutExerciseCard.tsx` — le relevé et le stop**

Ajouter aux imports :

```ts
import type { HoldTimer } from '@/stores/holdTimer';
import { HoldRail } from './HoldRail';
```

Ajouter, à côté de `export type CardPace = …` :

```ts
/** Le chrono qui tourne sur une série de cette carte, s'il y en a un. */
export type CardHold = HoldTimer & { setId: string };
```

Ajouter à `Props`, après `pace: CardPace | null;` :

```ts
  /** Le chrono de maintien de cette carte, si une série est tenue. */
  hold: CardHold | null;
```

Ajouter `hold,` à la déstructuration du composant.

Dans le bandeau, juste après le bloc `{pace !== null && (…<RepPaceRail …/>…)}`, ajouter :

```tsx
              {/* Monté tant que le maintien dure, pour la même raison que le
                  métronome : la vie du composant *est* celle du chrono, donc le
                  masquer en le démontant annulerait tous ses repères. */}
              {hold !== null && (
                <span className={rest === null ? 'contents' : 'hidden'}>
                  <HoldRail hold={hold} />
                </span>
              )}
```

Remplacer la condition et le libellé du bouton stop du bandeau :

```tsx
          {(pace !== null || hold !== null) && onStopPace !== undefined ? (
```

```tsx
              aria-label={t(hold !== null ? 'workout.holdStop' : 'workout.paceStop')}
```

Le bouton chronomètre au repos ouvre la même feuille, mais ne promet pas la même chose selon
l'exercice. Déclarer, à côté de `columns` :

```ts
  // La carte sait déjà de quoi la série est faite ; le bandeau doit le dire.
  const timed = isTimedMeasurement(identity.measurementType);
```

(ajouter `isTimedMeasurement` à l'import existant de `@/lib/measurement`), puis remplacer le
libellé du bouton :

```tsx
              aria-label={t(timed ? 'workout.holdOpen' : 'workout.paceOpen', { name })}
```

Enfin, là où le composant rend chaque `WorkoutSetRow`, ajouter :

```tsx
                holding={hold?.setId === set.id}
```

- [ ] **Step 5 : `PaceSheet.tsx` — la vue chrono**

Ajouter à `PaceSheetView`, en première position :

```ts
  /** Ce que la feuille pilote : un tempo à battre, ou une montre à lancer. */
  kind: 'reps' | 'hold';
```

Envelopper le stepper de tempo, les préréglages et « Par défaut partout » dans
`{view.kind === 'reps' && ( … )}` — un maintien n'a pas de secondes par répétition, et
afficher un réglage sans effet est pire que ne rien afficher.

Remplacer le titre, l'aide et le libellé du bouton :

```tsx
      title={t(view.kind === 'hold' ? 'workout.holdTitle' : 'workout.paceTitle')}
```

```tsx
            {view.kind === 'hold'
              ? t(view.canStart ? 'workout.holdHelp' : 'workout.holdNoSet')
              : !view.canStart
                ? t('workout.paceNoSet')
                : /* … le reste du texte existant, inchangé … */ null}
```

```tsx
            {view.running
              ? t(view.kind === 'hold' ? 'workout.holdStop' : 'workout.paceStop')
              : t(view.kind === 'hold' ? 'workout.holdStart' : 'workout.pace')}
```

- [ ] **Step 6 : relancer et vérifier**

```bash
npx vitest run src/features/workout/WorkoutExerciseCard.test.tsx
```

Attendu : PASS. `npm run typecheck` signalera encore la prop `hold` manquante dans
`WorkoutScreen.tsx` — c'est la tâche 9 qui la branche.

- [ ] **Step 7 : commit**

```bash
git add src/features/workout/WorkoutExerciseCard.tsx src/features/workout/WorkoutSetRow.tsx src/features/workout/PaceSheet.tsx src/features/workout/WorkoutExerciseCard.test.tsx
git commit -m "feat(workout): montrer le chrono sur la carte et sa feuille"
```

---

### Task 9 : la coche écrit la durée tenue

**Files:**
- Modify: `src/features/workout/WorkoutScreen.tsx`
- Modify: `src/features/workout/WorkoutScreen.integration.test.tsx`
- Test: `src/features/workout/WorkoutScreen.integration.test.tsx`

**Interfaces:**
- Consumes: `useHoldTimer` (Task 4), `heldSecondsAt` (Task 2), `CardHold` (Task 8).
- Produces: rien de nouveau vers l'extérieur.

- [ ] **Step 1 : écrire les tests d'intégration qui échouent**

Dans `src/features/workout/WorkoutScreen.integration.test.tsx`, ajouter d'abord une graine
chronométrée à côté de `seedActiveWorkout` :

```tsx
async function seedTimedWorkout(): Promise<string> {
  const exercise = await createCustomExercise({
    name: 'Gainage',
    primaryMuscle: 'abs',
    secondaryMuscles: [],
    equipment: 'bodyweight',
    measurementType: 'time_only',
    isUnilateral: 0,
  });
  const routine = await createRoutine('Ceinture');
  await addExercisesToRoutine(routine.id, [exercise.id]);
  return (await startWorkoutFromRoutine(routine.id)).id;
}
```

puis, dans un `describe('WorkoutScreen — chrono de maintien', …)` avec
`useHoldTimer.getState().stop()` dans son `beforeEach` et son `afterEach` :

```tsx
  it('écrit le temps tenu, relâchement retiré, quand la série est validée', async () => {
    const workoutId = await seedTimedWorkout();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWorkout();

    await screen.findByText('Gainage');
    await user.click(screen.getByRole('button', { name: 'Chrono de Gainage' }));
    await user.click(await screen.findByRole('button', { name: t('workout.holdStart') }));

    // La préparation, puis quarante-sept secondes tenues avant de relâcher.
    act(() => {
      vi.advanceTimersByTime(10_000 + 47_000);
    });

    await user.click(screen.getByRole('button', { name: 'Valider la série 1' }));

    await waitFor(async () => {
      expect(await firstSet(workoutId)).toMatchObject({ durationSeconds: 45, isCompleted: 1 });
    });
    expect(useHoldTimer.getState().setId).toBeNull();
  });

  it('laisse intacte une série chronométrée validée à la main, sans chrono', async () => {
    const workoutId = await seedTimedWorkout();
    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Gainage');
    await user.type(screen.getByRole('textbox', { name: 'Série 1 — s' }), '40');
    await user.click(screen.getByRole('button', { name: 'Valider la série 1' }));

    await waitFor(async () => {
      expect(await firstSet(workoutId)).toMatchObject({ durationSeconds: 40, isCompleted: 1 });
    });
  });

  // Même raison que pour le repos : une horloge qui suit un set disparu avec sa
  // ligne ne s'arrêterait jamais toute seule.
  it('arrête le chrono quand son exercice est retiré de la séance', async () => {
    await seedTimedWorkout();
    const user = userEvent.setup();
    renderWorkout();

    await screen.findByText('Gainage');
    await user.click(screen.getByRole('button', { name: 'Chrono de Gainage' }));
    await user.click(await screen.findByRole('button', { name: t('workout.holdStart') }));
    expect(useHoldTimer.getState().setId).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Menu de Gainage' }));
    await user.click(await screen.findByRole('button', { name: t('workout.removeExercise') }));
    await user.click(await screen.findByRole('button', { name: t('common.confirm') }));

    await waitFor(() => {
      expect(useHoldTimer.getState().setId).toBeNull();
    });
  });
```

Les libellés exacts des trois derniers boutons (« Menu de … », retrait, confirmation) sont à
relire dans `src/i18n/fr.ts` au moment d'écrire le test : c'est le seul endroit où ils vivent.

- [ ] **Step 2 : lancer les tests et vérifier qu'ils échouent**

```bash
npx vitest run src/features/workout/WorkoutScreen.integration.test.tsx
```

Attendu : FAIL — `durationSeconds` vaut `undefined` sur la première assertion.

- [ ] **Step 3 : brancher le chrono dans `WorkoutScreen.tsx`**

Ajouter aux imports :

```ts
import { useHoldTimer } from '@/stores/holdTimer';
import { heldSecondsAt } from './holdDuration';
```

Après `const pacer = useRepPacer();` :

```ts
  const hold = useHoldTimer();
  const stopHold = useHoldTimer((state) => state.stop);
```

Après l'effet qui arrête les repos dont le set a disparu, ajouter son jumeau :

```ts
  // Même raison que pour le repos : une horloge qui suit un set supprimé avec
  // sa ligne ou son exercice ne s'arrêterait jamais toute seule.
  useEffect(() => {
    if (hold.setId === null || detail == null) return;
    const alive = detail.exercises.some((line) => line.sets.some((set) => set.id === hold.setId));
    if (!alive) stopHold(hold.setId);
  }, [hold.setId, detail, stopHold]);
```

Dans le `renderItem` de la liste, à côté de la prop `pace`, ajouter :

```tsx
                    hold={
                      hold.setId !== null && hold.rowId === line.row.id
                        ? { ...hold, setId: hold.setId }
                        : null
                    }
```

et étendre la condition de `onStopPace` :

```tsx
                    onStopPace={
                      (pacer.rowId === line.row.id && pacer.setId !== null) ||
                      (hold.rowId === line.row.id && hold.setId !== null)
                        ? () => pace.stop()
                        : undefined
                    }
```

Enfin, dans `onComplete`, remplacer la première instruction (le reste du corps ne bouge pas) :

```tsx
                    onComplete={(setId, values, set) => {
                      // Le chrono est ce qui sait combien de temps a été tenu :
                      // la coche est le geste qui l'arrête, donc c'est elle qui
                      // écrit la durée — et la saisie manuelle des secondes
                      // n'a plus lieu d'être quand il tourne.
                      const held =
                        hold.setId === setId ? heldSecondsAt(hold.startedAt, Date.now()) : undefined;
                      const written =
                        held === undefined ? values : { ...values, durationSeconds: held };
                      void completeSet(setId, written)
                        .then(() => {
                          tutorial?.report({ type: 'workout-set-completed', setId });
                        })
                        .catch(() => undefined);
                      // Le métronome ou le chrono suivait cette série ; elle est finie.
                      pace.stop(setId);
                      // … la suite du corps existant reste inchangée …
                    }}
```

- [ ] **Step 4 : relancer et vérifier que ça passe**

```bash
npx vitest run src/features/workout/WorkoutScreen.integration.test.tsx
```

Attendu : PASS.

- [ ] **Step 5 : les quatre portes**

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm run test:run
```

```bash
npm run build
```

Attendu : sortie 0 aux quatre. `test:run` doit annoncer **plus** de fichiers et de tests
qu'avant le lot, et **aucun** échec.

- [ ] **Step 6 : commit**

```bash
git add src/features/workout/WorkoutScreen.tsx src/features/workout/WorkoutScreen.integration.test.tsx
git commit -m "feat(workout): écrire le temps tenu à la validation"
```

---

### Task 10 : la trace écrite

**Files:**
- Modify: `PROGRESS.md`
- Modify: `docs/product/FEATURE-INVENTORY.md`

- [ ] **Step 1 : mettre `PROGRESS.md` à jour**

Ajouter une section datée qui dit : ce que le chrono fait, la correction de deux secondes et
pourquoi elle existe, les 36 repères **déclarés mais non générés**, le chiffre exact des
quatre portes (fichiers de tests, tests, sortie de build), et le checkpoint téléphone
demandé — « tenir un gainage sans sortir de l'app, en Silence puis en sons ».

- [ ] **Step 2 : mettre l'inventaire à jour**

Dans `docs/product/FEATURE-INVENTORY.md`, section 9 « Backlog produit priorisé », marquer le
chrono comme livré et ajouter les 36 clips à la liste des voix à auditer avant génération.

- [ ] **Step 3 : commit**

```bash
git add PROGRESS.md docs/product/FEATURE-INVENTORY.md
git commit -m "docs: consigner le chrono de série chronométrée"
```

---

## Ce que ce plan ne fait pas

- Il ne déclare ni ne génère aucun clip vocal. Les 36 transcriptions passent par la
  validation prévue, puis par l'audit des voix manquantes.
- Il ne touche pas à l'unilatéral : sa spec est écrite ensuite, posée sur celle-ci.
- Il ne rend pas `HOLD_RELEASE_SECONDS` réglable.
- Il n'annonce aucun repère au-delà de trois minutes.
