# Exercices unilatéraux — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** pour un exercice marqué unilatéral, faire représenter les deux côtés par une seule
ligne — une saisie, une validation, un enregistrement — avec annonce du changement de côté et
dix secondes réelles entre les deux.

**Architecture :** un module pur `sideCycle.ts` porte la règle ; `useWorkoutPace`, déjà arbitre
des deux horloges, la câble. Le stade du cycle se **dérive d'un instant absolu** plutôt que d'être
avancé par un minuteur, et les dix secondes **sont** la fenêtre de préparation de l'horloge du
second côté — pas un second décompte.

**Tech Stack :** React 19 + TypeScript strict, Dexie 4, Zustand, Vitest + Testing Library.

**Spec :** `docs/superpowers/specs/2026-08-22-unilateral-sides-design.md`

## Global Constraints

- Code et noms en **anglais**, interface en **français**, textes dans `src/i18n/fr.ts`.
- Pas de `any`. Instants : epoch ms.
- **`SIDE_CHANGE_LEAD_SECONDS = 10`**, exactement.
- **Texte figé, mot pour mot :** « Changement de côté. Reprise dans dix secondes. »
- **Aucun clip n'est déclaré dans `voiceScript.json` ni généré.**
- **`WorkoutSet.side` n'est pas touché** — il reste `'both'`.
- Le `setId` est le même sur les deux côtés.
- Une version Dexie livrée ne se réécrit **jamais** : on ajoute `version(10)`.
- Silence reste silencieux ; le mode sons ne produit pas de voix.
- TDD sur la logique ; les quatre portes avant chaque commit.

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `src/data/types.ts` | `WorkoutExercise.exerciseIsUnilateral?: 0 \| 1` |
| `src/lib/exerciseSnapshot.ts` | écrit, recopie et résout le drapeau |
| `src/data/db.ts` | `version(10).upgrade()` — rattrapage des lignes déjà instantanées |
| `src/lib/backup/backfill.ts` | `toVersion10` + `CURRENT_SCHEMA_VERSION = 10` |
| `src/features/workout/sideCycle.ts` *(créé)* | la règle du cycle, pure |
| `src/audio/cues.ts` | le cue `side-change` |
| `src/features/workout/repBeats.ts` | le cue qui **ferme** une cadence devient paramétrable |
| `src/features/workout/useWorkoutPace.ts` | ouvre, tourne et referme le cycle |
| `src/features/workout/RepPaceRail.tsx` | ferme le premier côté par `side-change`, lit la transition |
| `src/features/workout/HoldRail.tsx` | lit la transition |
| `src/features/workout/WorkoutExerciseCard.tsx` | transmet le stade aux deux relevés |
| `src/features/workout/WorkoutScreen.tsx` | la coche d'un maintien unilatéral change de côté |
| `src/i18n/fr.ts` | « Changement de côté · {seconds} » |

---

### Task 1 : le drapeau entre dans l'instantané

**Files:**
- Modify: `src/data/types.ts`, `src/lib/exerciseSnapshot.ts`
- Test: `src/lib/exerciseSnapshot.test.ts`

**Interfaces:**
- Produces: `WorkoutExercise.exerciseIsUnilateral?: 0 | 1`,
  `ExerciseIdentity.isUnilateral?: 0 | 1` ; `snapshotOf`, `exerciseSnapshotOfRow` et
  `resolveExerciseIdentity` le portent.

- [ ] **Step 1 : écrire les tests qui échouent**

Ajouter à `src/lib/exerciseSnapshot.test.ts` :

```ts
it('gèle le drapeau unilatéral avec le reste de l’identité', () => {
  expect(snapshotOf({ ...exercise, isUnilateral: 1 })).toMatchObject({
    exerciseIsUnilateral: 1,
  });
  expect(snapshotOf({ ...exercise, isUnilateral: 0 })).toMatchObject({
    exerciseIsUnilateral: 0,
  });
});

it('recopie le drapeau d’une ligne, et ne l’invente pas quand il manque', () => {
  expect(exerciseSnapshotOfRow({ ...row, exerciseIsUnilateral: 1 })).toMatchObject({
    exerciseIsUnilateral: 1,
  });
  expect(exerciseSnapshotOfRow(row)).not.toHaveProperty('exerciseIsUnilateral');
});

// L'instantané gagne, comme les cinq autres champs : renommer ou décocher
// l'exercice aujourd'hui ne réécrit pas ce qui a été fait.
it('lit l’instantané avant la bibliothèque', () => {
  expect(
    resolveExerciseIdentity({ ...row, exerciseIsUnilateral: 1 }, { ...exercise, isUnilateral: 0 })
      .isUnilateral,
  ).toBe(1);
  expect(resolveExerciseIdentity(row, { ...exercise, isUnilateral: 1 }).isUnilateral).toBe(1);
  expect(resolveExerciseIdentity(row, undefined).isUnilateral).toBeUndefined();
});
```

- [ ] **Step 2 : lancer et vérifier l'échec**

```bash
npx vitest run src/lib/exerciseSnapshot.test.ts
```

Attendu : FAIL — `exerciseIsUnilateral` absent des trois résultats.

- [ ] **Step 3 : implémenter**

Dans `src/data/types.ts`, sous `exerciseBodyweightLoadFactor?: number;` de `WorkoutExercise` :

```ts
  /**
   * Ajouté après les autres, comme les muscles secondaires : une ligne peut
   * porter l'instantané sans porter ce champ. La séance en direct le lit pour
   * savoir si une ligne représente deux côtés.
   */
  exerciseIsUnilateral?: 0 | 1;
```

Dans `src/lib/exerciseSnapshot.ts` : ajouter `'exerciseIsUnilateral'` à `ExerciseSnapshot`,
`exerciseIsUnilateral: exercise.isUnilateral` dans `snapshotOf` (sans garde : le champ est
obligatoire sur `Exercise`), la recopie gardée dans `exerciseSnapshotOfRow`, `isUnilateral?: 0 | 1`
dans `ExerciseIdentity`, et dans `resolveExerciseIdentity` :

```ts
  const isUnilateral = row.exerciseIsUnilateral ?? exercise?.isUnilateral;
```
puis `...(isUnilateral === undefined ? {} : { isUnilateral }),` dans l'objet rendu.

- [ ] **Step 4 : vérifier**

```bash
npx vitest run src/lib/exerciseSnapshot.test.ts
```

```bash
npm run typecheck
```

- [ ] **Step 5 : commit**

```bash
git add src/data/types.ts src/lib/exerciseSnapshot.ts src/lib/exerciseSnapshot.test.ts
git commit -m "feat(workout): geler le drapeau unilatéral dans l'instantané"
```

---

### Task 2 : la migration et le rattrapage de sauvegarde

**Files:**
- Modify: `src/data/db.ts`, `src/lib/backup/backfill.ts`
- Test: `src/data/dbMigration.test.ts`, `src/lib/backup/backfill.test.ts`,
  `src/data/schemaVersion.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: `db.verno === 10`, `CURRENT_SCHEMA_VERSION === 10`, `toVersion10` dans `BACKFILLS`.

- [ ] **Step 1 : écrire les tests qui échouent**

Dans `src/lib/backup/backfill.test.ts` :

```ts
describe('version 10 — le drapeau unilatéral de l’instantané', () => {
  // Même garde que la version 4 : seules les lignes déjà instantanées. Une
  // ligne sans instantané retombe sur la bibliothèque en bloc, et lui donner
  // ce seul champ casserait ce repli.
  it('remplit les lignes déjà instantanées depuis la bibliothèque du fichier', () => {
    const tables = backfillBackupTables(
      {
        ...EMPTY_TABLES,
        exercises: [{ id: 'ex', isUnilateral: 1, isCustom: 0 }],
        workoutExercises: [
          { id: 'we-1', exerciseId: 'ex', exerciseName: 'Fente', exercisePrimaryMuscle: 'quads' },
          { id: 'we-2', exerciseId: 'ex' },
        ],
      },
      9,
    );

    expect(tables.workoutExercises[0]).toMatchObject({ exerciseIsUnilateral: 1 });
    expect(tables.workoutExercises[1]).not.toHaveProperty('exerciseIsUnilateral');
  });

  it('n’écrase jamais un drapeau déjà gelé', () => {
    const tables = backfillBackupTables(
      {
        ...EMPTY_TABLES,
        exercises: [{ id: 'ex', isUnilateral: 1, isCustom: 0 }],
        workoutExercises: [
          { id: 'we', exerciseId: 'ex', exercisePrimaryMuscle: 'quads', exerciseIsUnilateral: 0 },
        ],
      },
      9,
    );

    expect(tables.workoutExercises[0]).toMatchObject({ exerciseIsUnilateral: 0 });
  });
});
```

(`EMPTY_TABLES` : réutiliser l'assistant déjà présent dans ce fichier ; s'il porte un autre nom,
prendre celui du fichier.)

Dans `src/data/dbMigration.test.ts`, ajouter un cas qui ouvre une base au schéma précédent avec
une ligne instantanée, puis ouvre la base courante et vérifie
`exerciseIsUnilateral === 1` sur la ligne instantanée et son absence sur la ligne non instantanée.
Suivre exactement la forme du cas de migration déjà présent dans ce fichier.

- [ ] **Step 2 : lancer et vérifier l'échec**

```bash
npx vitest run src/lib/backup/backfill.test.ts src/data/schemaVersion.test.ts
```

Attendu : FAIL sur les deux — `toVersion10` n'existe pas, et
`CURRENT_SCHEMA_VERSION` (9) ne suit pas `db.verno`.

- [ ] **Step 3 : ajouter `version(10)` dans `src/data/db.ts`**

À la fin du constructeur, **après** le bloc `version(9)`, sans toucher à aucun bloc existant :

```ts
    /**
     * Gèle le drapeau unilatéral sur les lignes de séance déjà instantanées.
     *
     * Le champ vient d'entrer dans `snapshotOf` : les lignes créées à partir de
     * maintenant le portent, celles d'avant non. Sans ce rattrapage, une séance
     * passée sur un exercice unilatéral lirait le drapeau d'aujourd'hui — la
     * réécriture de l'histoire que les instantanés existent pour empêcher, le
     * jour où le drapeau est décoché.
     *
     * Seules les lignes **déjà instantanées**, exactement comme la version 4 :
     * une ligne sans instantané retombe sur la bibliothèque en bloc, et lui
     * donner ce seul champ casserait ce repli.
     *
     * Pas de `.stores()` : le champ n'est pas indexé.
     */
    this.version(10).upgrade(async (tx) => {
      const exercises = await tx.table<Exercise>('exercises').toArray();
      const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]));

      await tx
        .table<WorkoutExercise>('workoutExercises')
        .toCollection()
        .modify((row) => {
          if (row.exercisePrimaryMuscle === undefined) return;
          const flag = byId.get(row.exerciseId)?.isUnilateral;
          if (flag !== undefined) row.exerciseIsUnilateral = flag;
        });
    });
```

- [ ] **Step 4 : ajouter le rattrapage dans `src/lib/backup/backfill.ts`**

Passer la constante à 10 :

```ts
export const CURRENT_SCHEMA_VERSION = 10;
```

Ajouter la fonction, à la suite de `toVersion9` :

```ts
/**
 * Version 10 — le drapeau unilatéral de l'instantané.
 *
 * Mêmes gardes que la version 4 : uniquement les lignes déjà instantanées, et
 * jamais par-dessus un drapeau que le fichier porte déjà. Écraser un instantané
 * gelé avec le catalogue d'aujourd'hui est précisément la réécriture de
 * l'histoire que les instantanés empêchent.
 */
function toVersion10(tables: Tables): Tables {
  const library = libraryOf(tables);

  return mapTable(tables, 'workoutExercises', (row) => {
    if (row.exercisePrimaryMuscle === undefined) return row;
    if (row.exerciseIsUnilateral !== undefined) return row;
    if (typeof row.exerciseId !== 'string') return row;
    const flag = library.get(row.exerciseId)?.isUnilateral;
    return flag === undefined ? row : { ...row, exerciseIsUnilateral: flag };
  });
}
```

et l'entrée dans la table :

```ts
  { version: 10, apply: toVersion10 },
```

- [ ] **Step 5 : vérifier**

```bash
npx vitest run src/lib/backup/backfill.test.ts src/data/schemaVersion.test.ts src/data/dbMigration.test.ts
```

Attendu : PASS sur les trois.

- [ ] **Step 6 : commit**

```bash
git add src/data/db.ts src/lib/backup/backfill.ts src/lib/backup/backfill.test.ts src/data/dbMigration.test.ts
git commit -m "feat(workout): rattraper le drapeau unilatéral des séances passées"
```

---

### Task 3 : la règle du cycle, pure

**Files:**
- Create: `src/features/workout/sideCycle.ts`, `src/features/workout/sideCycle.test.ts`
- Test: `src/features/workout/sideCycle.test.ts`

**Interfaces:**
- Produces:
  - `type SideStage = 'first' | 'transition' | 'second'`
  - `type SideCycle = { kind: 'idle' } | { kind: 'first'; setId: string } | { kind: 'second'; setId: string; resumesAt: number }`
  - `IDLE_SIDE_CYCLE: SideCycle`, `SIDE_CHANGE_LEAD_SECONDS = 10`
  - `openSideCycle(setId: string, unilateral: boolean): SideCycle`
  - `sideStageAt(cycle: SideCycle, setId: string, now: number): SideStage | null`
  - `turnSide(cycle: SideCycle, setId: string, now: number): SideTurn`
    avec `type SideTurn = { kind: 'change'; cycle: SideCycle } | { kind: 'complete' } | { kind: 'ignore' }`
  - `sideCycleWithoutSet(cycle: SideCycle, setId?: string): SideCycle`

- [ ] **Step 1 : écrire le test qui échoue**

Créer `src/features/workout/sideCycle.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import {
  IDLE_SIDE_CYCLE,
  SIDE_CHANGE_LEAD_SECONDS,
  openSideCycle,
  sideCycleWithoutSet,
  sideStageAt,
  turnSide,
} from './sideCycle';

describe('openSideCycle', () => {
  it('n’ouvre rien sur un exercice bilatéral', () => {
    expect(openSideCycle('s1', false)).toEqual(IDLE_SIDE_CYCLE);
  });

  it('ouvre sur le premier côté d’un exercice unilatéral', () => {
    expect(openSideCycle('s1', true)).toEqual({ kind: 'first', setId: 's1' });
  });
});

describe('sideStageAt', () => {
  it('ne dit rien pour une série qui n’est pas dans le cycle', () => {
    expect(sideStageAt(openSideCycle('s1', true), 'autre', 0)).toBeNull();
    expect(sideStageAt(IDLE_SIDE_CYCLE, 's1', 0)).toBeNull();
  });

  // Trois stades visibles, deux stockés : `transition` est `second` avant son
  // instant de reprise. Dérivé d'un instant absolu, comme toutes les horloges
  // de l'écran — pas avancé par un minuteur de plus.
  it('dérive la transition de l’instant de reprise', () => {
    const cycle = { kind: 'second', setId: 's1', resumesAt: 10_000 } as const;
    expect(sideStageAt(cycle, 's1', 0)).toBe('transition');
    expect(sideStageAt(cycle, 's1', 9_999)).toBe('transition');
    expect(sideStageAt(cycle, 's1', 10_000)).toBe('second');
    expect(sideStageAt(cycle, 's1', 30_000)).toBe('second');
  });
});

describe('turnSide', () => {
  it('passe au second côté, dix secondes plus tard', () => {
    const turn = turnSide(openSideCycle('s1', true), 's1', 1_000);
    expect(turn).toEqual({
      kind: 'change',
      cycle: { kind: 'second', setId: 's1', resumesAt: 1_000 + SIDE_CHANGE_LEAD_SECONDS * 1_000 },
    });
    expect(SIDE_CHANGE_LEAD_SECONDS).toBe(10);
  });

  // La série n'est terminée qu'après le second côté.
  it('termine la série à la fin du second côté', () => {
    const second = { kind: 'second', setId: 's1', resumesAt: 0 } as const;
    expect(turnSide(second, 's1', 30_000)).toEqual({ kind: 'complete' });
  });

  // Pendant les dix secondes, le côté n'a pas commencé : il n'y a rien à finir.
  it('ignore un tour pendant la transition', () => {
    const second = { kind: 'second', setId: 's1', resumesAt: 10_000 } as const;
    expect(turnSide(second, 's1', 5_000)).toEqual({ kind: 'ignore' });
  });

  it('ignore une série hors cycle', () => {
    expect(turnSide(IDLE_SIDE_CYCLE, 's1', 0)).toEqual({ kind: 'ignore' });
    expect(turnSide(openSideCycle('s1', true), 'autre', 0)).toEqual({ kind: 'ignore' });
  });
});

describe('sideCycleWithoutSet', () => {
  it('referme le cycle de cette série, et laisse les autres', () => {
    const cycle = openSideCycle('s1', true);
    expect(sideCycleWithoutSet(cycle, 's1')).toEqual(IDLE_SIDE_CYCLE);
    expect(sideCycleWithoutSet(cycle, 'autre')).toEqual(cycle);
    expect(sideCycleWithoutSet(cycle)).toEqual(IDLE_SIDE_CYCLE);
  });
});
```

- [ ] **Step 2 : lancer et vérifier l'échec**

```bash
npx vitest run src/features/workout/sideCycle.test.ts
```

Attendu : FAIL — `Failed to resolve import "./sideCycle"`.

- [ ] **Step 3 : écrire `src/features/workout/sideCycle.ts`**

```ts
/**
 * Le cycle deux côtés d'une série unilatérale.
 *
 * **Une ligne, deux côtés, un `setId`.** Le contrat est là : une saisie, une
 * validation, un enregistrement. Ce module ne connaît donc qu'une série — il
 * dit à quel côté elle en est, jamais combien de séries il y a.
 *
 * **Trois stades visibles, deux stockés.** `transition` n'est pas un état de
 * plus : c'est `second` avant son instant de reprise. Le stade se dérive d'un
 * instant absolu au lieu d'être avancé par un minuteur — même règle que la
 * barre de repos, le métronome et le chrono, et une raison de moins pour que
 * deux horloges se désynchronisent.
 *
 * **Les dix secondes ne sont pas comptées deux fois.** Elles *sont* la fenêtre
 * de préparation de l'horloge du second côté : `resumesAt` et le `startedAt` de
 * cette horloge sont le même instant.
 */
export type SideStage = 'first' | 'transition' | 'second';

export type SideCycle =
  | { kind: 'idle' }
  | { kind: 'first'; setId: string }
  | { kind: 'second'; setId: string; resumesAt: number };

export const IDLE_SIDE_CYCLE: SideCycle = { kind: 'idle' };

/** « Changement de côté. Reprise dans dix secondes. » — et dix, réellement. */
export const SIDE_CHANGE_LEAD_SECONDS = 10;

/** Ce que devient le cycle quand une horloge démarre sur une série. */
export function openSideCycle(setId: string, unilateral: boolean): SideCycle {
  return unilateral ? { kind: 'first', setId } : IDLE_SIDE_CYCLE;
}

/** Le stade visible d'une série, `null` quand elle n'est pas dans le cycle. */
export function sideStageAt(cycle: SideCycle, setId: string, now: number): SideStage | null {
  if (cycle.kind === 'idle' || cycle.setId !== setId) return null;
  if (cycle.kind === 'first') return 'first';
  return now < cycle.resumesAt ? 'transition' : 'second';
}

export type SideTurn =
  /** Le premier côté est fini : annoncer, attendre dix secondes, reprendre. */
  | { kind: 'change'; cycle: SideCycle }
  /** Le second côté est fini : la série peut se terminer. */
  | { kind: 'complete' }
  /** Rien à faire : hors cycle, ou pendant les dix secondes. */
  | { kind: 'ignore' };

export function turnSide(cycle: SideCycle, setId: string, now: number): SideTurn {
  const stage = sideStageAt(cycle, setId, now);
  if (stage === null) return { kind: 'ignore' };
  if (stage === 'first') {
    return {
      kind: 'change',
      cycle: { kind: 'second', setId, resumesAt: now + SIDE_CHANGE_LEAD_SECONDS * 1_000 },
    };
  }
  // Pendant la transition le second côté n'a pas commencé : il n'y a rien à
  // finir, et le compter finirait la série sur un côté qui n'a pas eu lieu.
  return stage === 'transition' ? { kind: 'ignore' } : { kind: 'complete' };
}

/** Referme le cycle d'une série validée, arrêtée ou supprimée. */
export function sideCycleWithoutSet(cycle: SideCycle, setId?: string): SideCycle {
  if (cycle.kind === 'idle') return cycle;
  return setId === undefined || cycle.setId === setId ? IDLE_SIDE_CYCLE : cycle;
}
```

- [ ] **Step 4 : vérifier**

```bash
npx vitest run src/features/workout/sideCycle.test.ts
```

Attendu : PASS, 10 tests.

- [ ] **Step 5 : commit**

```bash
git add src/features/workout/sideCycle.ts src/features/workout/sideCycle.test.ts
git commit -m "feat(workout): poser la règle du cycle deux côtés"
```

---

### Task 4 : le son du changement de côté, et le cue qui ferme un côté

**Files:**
- Modify: `src/audio/cues.ts`, `src/features/workout/repBeats.ts`,
  `src/features/workout/repBeats.test.ts`, `src/i18n/fr.ts`
- Test: `src/features/workout/repBeats.test.ts`, `src/audio/cues.test.ts`

**Interfaces:**
- Produces: `CueId` gagne `'side-change'` ; `repBeats(pacer, endCue?: CueId)` et
  `armRepPacer(pacer, onFinished, now?, endCue?)`.

- [ ] **Step 1 : écrire les tests qui échouent**

Ajouter à `src/features/workout/repBeats.test.ts` :

```ts
// « Validé. » et « Série terminée. » sont faux au milieu d'une série : sur le
// premier côté d'une ligne unilatérale, la cadence se ferme autrement.
it('ferme le premier côté par le changement de côté, pas par la fin de série', () => {
  const beats = repBeats(pacer, 'side-change');
  expect(beats[beats.length - 1]).toEqual({ cue: 'side-change', at: 25_000 });
  expect(beats.some(({ cue }) => cue === 'set-done')).toBe(false);
});

it('ferme par la fin de série quand rien n’est précisé', () => {
  expect(repBeats(pacer).at(-1)?.cue).toBe('set-done');
});
```

et, dans le `describe('armRepPacer')` :

```ts
it('prévient la fin quel que soit le cue de clôture', () => {
  const finished = vi.fn();
  armRepPacer({ reps: 1, repSeconds: 1, startedAt: 0 }, finished, 0, 'side-change');
  vi.advanceTimersByTime(1_000);
  expect(announce).toHaveBeenCalledWith('side-change');
  expect(finished).toHaveBeenCalledOnce();
});
```

Ajouter à `src/audio/holdMarks.test.ts` (ou `cues.test.ts`) :

```ts
it('le changement de côté sonne et ne parle pas encore', () => {
  expect(CUES['side-change'].tone).toBe('chime');
  expect(clipsFor('side-change')).toHaveLength(0);
});
```

- [ ] **Step 2 : lancer et vérifier l'échec**

```bash
npx vitest run src/features/workout/repBeats.test.ts src/audio/holdMarks.test.ts
```

Attendu : FAIL — `repBeats` ignore son second argument, `CUES['side-change']` est `undefined`.

- [ ] **Step 3 : ajouter le cue dans `src/audio/cues.ts`**

Dans l'union `CueId`, après `'set-done'` :

```ts
  | 'side-change'
```

Dans `CUES`, après l'entrée `'set-done'` :

```ts
  /*
   * « Changement de côté. Reprise dans dix secondes. »
   *
   * Priorité 3 et pas de refroidissement : la phrase est la seule chose qui
   * distingue une série qui continue d'une série finie, et la manquer laisse
   * l'utilisateur debout à attendre une reprise qu'il n'a pas entendue venir.
   */
  'side-change': { tone: 'chime', priority: 3, gapMs: 700, cooldownMs: 0, duckMusic: true },
```

- [ ] **Step 4 : paramétrer le cue de clôture dans `repBeats.ts`**

```ts
export function repBeats(
  pacer: Pick<RepPacer, 'reps' | 'repSeconds' | 'startedAt'>,
  /**
   * Ce qui ferme la cadence. `set-done` par défaut — mais ses clips disent
   * « Validé. » et « Série terminée. », faux au milieu d'une série unilatérale,
   * dont le premier côté se ferme par le changement de côté.
   */
  endCue: CueId = 'set-done',
): RepBeat[] {
```

et, dans le corps, remplacer le battement de fin :

```ts
  beats.push({ cue: endCue, at: pacer.startedAt + pacer.reps * pacer.repSeconds * 1_000 });
```

Dans `armRepPacer`, ajouter le paramètre et le propager :

```ts
export function armRepPacer(
  pacer: Pick<RepPacer, 'reps' | 'repSeconds' | 'startedAt'>,
  onFinished: () => void,
  now = Date.now(),
  endCue: CueId = 'set-done',
): () => void {
  const timers = pendingBeats(repBeats(pacer, endCue), now).map((beat) =>
    setTimeout(
      () => {
        announce(beat.cue);
        if (beat.cue === endCue) onFinished();
      },
      Math.max(0, beat.at - now),
    ),
  );
```

- [ ] **Step 5 : ajouter le texte du relevé dans `src/i18n/fr.ts`**

Sous `holdStatus`, dans l'objet `workout` :

```ts
    // La transition entre les deux côtés d'une série unilatérale. Même forme
    // que « Départ · n » parce que c'est la même attente — en Silence, ce
    // relevé est tout ce qui dit que la série n'est pas finie.
    sideChanging: 'Changement de côté · {seconds}',
```

- [ ] **Step 6 : vérifier**

```bash
npx vitest run src/features/workout/repBeats.test.ts src/audio/holdMarks.test.ts src/audio/cues.test.ts
```

```bash
npm run typecheck
```

- [ ] **Step 7 : commit**

```bash
git add src/audio/cues.ts src/features/workout/repBeats.ts src/features/workout/repBeats.test.ts src/audio/holdMarks.test.ts src/i18n/fr.ts
git commit -m "feat(workout): annoncer le changement de côté"
```

---

### Task 5 : `useWorkoutPace` ouvre, tourne et referme le cycle

**Files:**
- Modify: `src/features/workout/useWorkoutPace.ts`, `src/features/workout/useWorkoutPace.test.tsx`
- Test: `src/features/workout/useWorkoutPace.test.tsx`

**Interfaces:**
- Consumes: `sideCycle.ts` (Task 3), l'identité `isUnilateral` (Task 1).
- Produces, sur `WorkoutPace` :
  - `sideStageOf: (setId: string) => SideStage | null`
  - `turnSideOf: (line: Line, setId: string) => 'changed' | 'completed' | 'none'`

**Les règles :**

1. `startClock` **ouvre** le cycle quand la ligne est unilatérale, sauf quand elle reprend le
   second côté (le cycle est déjà ouvert sur ce `setId`).
2. `turnSideOf` applique `turnSide` : sur `change`, il annonce `side-change` et relance **la même
   horloge, sur le même `setId`**, avec `SIDE_CHANGE_LEAD_SECONDS` de préparation ; sur
   `complete`, il referme le cycle et rend `'completed'`.
3. `stop` referme le cycle avec l'horloge.

- [ ] **Step 1 : écrire les tests qui échouent**

Ajouter à `src/features/workout/useWorkoutPace.test.tsx` (l'assistant `mount` reçoit un
paramètre `unilateral` qui passe `isUnilateral: 1` à l'exercice) :

```ts
it('ouvre le cycle sur une ligne unilatérale, et pas ailleurs', () => {
  const uni = mount('weight_reps', [workoutSet('s1', 8)], true);
  act(() => {
    uni.pace().startFor(uni.line);
  });
  expect(uni.pace().sideStageOf('s1')).toBe('first');

  const bi = mount('weight_reps');
  act(() => {
    bi.pace().startFor(bi.line);
  });
  expect(bi.pace().sideStageOf('s1')).toBeNull();
});

// Le contrat : même série, même identifiant, dix secondes réelles.
it('reprend le second côté sur le même setId, dix secondes plus tard', () => {
  const { line, pace } = mount('weight_reps', [workoutSet('s1', 8)], true);
  act(() => {
    pace().startFor(line);
  });
  expect(useRepPacer.getState().startedAt).toBe(now);

  act(() => {
    expect(pace().turnSideOf(line, 's1')).toBe('changed');
  });

  expect(announce).toHaveBeenCalledWith('side-change');
  expect(useRepPacer.getState().setId).toBe('s1');
  expect(useRepPacer.getState().startedAt).toBe(now + 10_000);
  expect(pace().sideStageOf('s1')).toBe('transition');
});

it('termine la série au bout du second côté', () => {
  const { line, pace } = mount('time_only', [workoutSet('s1')], true);
  act(() => {
    pace().startFor(line);
    pace().turnSideOf(line, 's1');
  });

  // Les dix secondes passées, le second côté a commencé.
  act(() => {
    vi.setSystemTime(now + 30_000);
  });
  act(() => {
    expect(pace().turnSideOf(line, 's1')).toBe('completed');
  });
  expect(pace().sideStageOf('s1')).toBeNull();
});

it('ne tourne rien sur une ligne bilatérale', () => {
  const { line, pace } = mount('weight_reps');
  act(() => {
    pace().startFor(line);
    expect(pace().turnSideOf(line, 's1')).toBe('none');
  });
});

it('referme le cycle avec l’horloge', () => {
  const { line, pace } = mount('weight_reps', [workoutSet('s1', 8)], true);
  act(() => {
    pace().startFor(line);
    pace().stop();
  });
  expect(pace().sideStageOf('s1')).toBeNull();
});
```

- [ ] **Step 2 : lancer et vérifier l'échec**

```bash
npx vitest run src/features/workout/useWorkoutPace.test.tsx
```

Attendu : FAIL — `sideStageOf is not a function`.

- [ ] **Step 3 : implémenter**

Imports :

```ts
import {
  IDLE_SIDE_CYCLE,
  SIDE_CHANGE_LEAD_SECONDS,
  openSideCycle,
  sideCycleWithoutSet,
  sideStageAt,
  turnSide,
  type SideCycle,
  type SideStage,
} from './sideCycle';
```

État et lecture, à côté de `plan` :

```ts
  /** Le cycle deux côtés de la série unilatérale en cours, s'il y en a une. */
  const [sideCycle, setSideCycle] = useState<SideCycle>(IDLE_SIDE_CYCLE);

  const unilateralOf = (line: Line): boolean =>
    workoutExerciseIdentityOf(line).isUnilateral === 1;

  const sideStageOf = (setId: string): SideStage | null =>
    sideStageAt(sideCycle, setId, Date.now());
```

Dans `startClock`, ajouter un paramètre `unilateral: boolean` et, avant de démarrer l'horloge :

```ts
    // Le cycle s'ouvre au démarrage d'une horloge, jamais à la reprise du
    // second côté : celui-là court déjà sur le même `setId`.
    setSideCycle((current) =>
      sideStageAt(current, target.setId, Date.now()) === null
        ? openSideCycle(target.setId, unilateral)
        : current,
    );
```

Chaque appelant de `startClock` passe `unilateralOf(line)` (l'effet lit la ligne par
`lines.find` comme aujourd'hui ; `startFollowing` passe la ligne suivante, pas la ligne finie).

Le tour, à côté de `startFor` :

```ts
  /**
   * Un côté vient de finir.
   *
   * Sur le premier, la même horloge repart **sur le même `setId`** après dix
   * secondes : c'est la même série, et le contrat l'exige. Sur le second, le
   * cycle se referme et l'appelant reprend la main — c'est lui qui valide,
   * démarre le repos et ouvre le RPE, ce qu'aucun premier côté ne doit faire.
   */
  const turnSideOf = (line: Line, setId: string): 'changed' | 'completed' | 'none' => {
    const turn = turnSide(sideCycle, setId, Date.now());
    if (turn.kind === 'ignore') return 'none';
    if (turn.kind === 'complete') {
      setSideCycle((current) => sideCycleWithoutSet(current, setId));
      return 'completed';
    }

    setSideCycle(turn.cycle);
    announce('side-change');
    const preparation = prepareNextPace(line.sets, cadenceOf(line));
    if (preparation.kind === 'ready' && preparation.target.setId === setId) {
      startClock(line.row.id, preparation.target, SIDE_CHANGE_LEAD_SECONDS, unilateralOf(line));
    }
    return 'changed';
  };
```

`stop` referme le cycle :

```ts
  const stop = (setId?: string): void => {
    stopPace(setId);
    stopHold(setId);
    setSideCycle((current) => sideCycleWithoutSet(current, setId));
  };
```

et `sideStageOf` / `turnSideOf` rejoignent l'objet rendu.

- [ ] **Step 4 : vérifier**

```bash
npx vitest run src/features/workout/useWorkoutPace.test.tsx
```

```bash
npm run typecheck
```

- [ ] **Step 5 : si `useWorkoutPace.ts` dépasse ~300 lignes**

Extraire `viewFor` dans `src/features/workout/paceSheetView.ts` — une fonction pure qui reçoit
la cadence, la préparation, l'état des deux horloges et rend le `PaceSheetView`. C'est un
découpage par responsabilité, pas un refactoring d'occasion : la feuille est une vue, pas une
horloge.

- [ ] **Step 6 : commit**

```bash
git add src/features/workout/useWorkoutPace.ts src/features/workout/useWorkoutPace.test.tsx
git commit -m "feat(workout): enchaîner les deux côtés sur la même série"
```

---

### Task 6 : les relevés disent le côté, et la coche d'un maintien le change

**Files:**
- Modify: `src/features/workout/RepPaceRail.tsx`, `src/features/workout/HoldRail.tsx`,
  `src/features/workout/WorkoutExerciseCard.tsx`, `src/features/workout/WorkoutScreen.tsx`
- Test: `src/features/workout/HoldRail.test.tsx`, `src/features/workout/RestRail.test.tsx`

**Interfaces:**
- `RepPaceRail` et `HoldRail` reçoivent `sideStage: SideStage | null`.
- `WorkoutExerciseCard` reçoit `sideStageOf: (setId: string) => SideStage | null`.

- [ ] **Step 1 : écrire les tests qui échouent**

Ajouter à `src/features/workout/HoldRail.test.tsx` :

```tsx
// En Silence, ce relevé est tout ce qui dit que la série n'est pas finie.
it('lit la transition entre les deux côtés', () => {
  render(
    <HoldRail
      hold={{ setId: 's1', rowId: 'row', startedAt: now + 7_000 }}
      sideStage="transition"
    />,
  );
  expect(screen.getByText('Changement de côté · 7')).toBeInTheDocument();
});
```

- [ ] **Step 2 : lancer et vérifier l'échec**

```bash
npx vitest run src/features/workout/HoldRail.test.tsx
```

Attendu : FAIL — le relevé lit encore « Départ · 7 ».

- [ ] **Step 3 : les deux relevés**

Dans `HoldRail`, ajouter la prop `sideStage: SideStage | null` (par défaut `null`) et remplacer la
branche de préparation :

```tsx
        {leadSeconds > 0
          ? t(sideStage === 'transition' ? 'workout.sideChanging' : 'workout.pacePreparing', {
              seconds: leadSeconds,
            })
          : t('workout.holdStatus', { time: formatRest(heldSeconds) })}
```

Faire la même substitution dans `RepPaceRail`, et y passer le cue de clôture :

```tsx
  useEffect(
    () => armRepPacer(pacer, onFinished, Date.now(), sideStage === 'first' ? 'side-change' : 'set-done'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pacer.setId, pacer.startedAt, pacer.reps, pacer.repSeconds, sideStage],
  );
```

- [ ] **Step 4 : la carte transmet le stade**

`WorkoutExerciseCard` reçoit `sideStageOf` et le passe aux deux relevés :

```tsx
<RepPaceRail pacer={pace} onFinished={pace.onFinished} sideStage={sideStageOf(pace.setId)} />
```
```tsx
<HoldRail hold={hold} sideStage={sideStageOf(hold.setId)} />
```

- [ ] **Step 5 : l'écran**

Dans `WorkoutScreen`, passer `sideStageOf={pace.sideStageOf}` à la carte, remplacer le
`onFinished` de la cadence :

```tsx
                        ? {
                            ...pacer,
                            setId: pacer.setId,
                            // La fin d'un côté n'est pas la fin de la série :
                            // sur le premier, la cadence repart d'elle-même
                            // après dix secondes.
                            onFinished: () => {
                              if (pace.turnSideOf(line, pacer.setId ?? '') === 'changed') return;
                              pace.stop();
                            },
                          }
                        : null
```

et brancher la coche d'un maintien unilatéral, **avant** toute écriture, dans `onComplete` :

```tsx
                    onComplete={(setId, values, set) => {
                      // Sur une ligne unilatérale tenue, la première coche finit
                      // le côté et non la série : ni validation, ni repos, ni
                      // RPE, ni record ne doivent en découler.
                      if (hold.setId === setId && pace.turnSideOf(line, setId) === 'changed') {
                        return;
                      }
                      // … le corps existant, inchangé …
                    }}
```

- [ ] **Step 6 : vérifier**

```bash
npx vitest run src/features/workout/
```

```bash
npm run typecheck
```

- [ ] **Step 7 : commit**

```bash
git add src/features/workout/RepPaceRail.tsx src/features/workout/HoldRail.tsx src/features/workout/HoldRail.test.tsx src/features/workout/WorkoutExerciseCard.tsx src/features/workout/WorkoutScreen.tsx
git commit -m "feat(workout): changer de côté sans terminer la série"
```

---

### Task 7 : la preuve — une ligne, deux côtés, une validation

**Files:**
- Modify: `src/features/workout/WorkoutScreen.integration.test.tsx`

- [ ] **Step 1 : écrire le test**

Dans un `describe('WorkoutScreen — exercice unilatéral', …)`, avec une graine
`seedUnilateralHoldWorkout()` calquée sur `seedTimedWorkout` mais `isUnilateral: 1` :

```tsx
it('fait deux côtés et une seule validation sur la même série', async () => {
  const workoutId = await seedUnilateralHoldWorkout();
  const user = userEvent.setup();
  renderWorkout();

  await screen.findByText('Planche latérale');
  await user.click(screen.getByRole('button', { name: 'Chrono de Planche latérale' }));
  await user.click(await screen.findByRole('button', { name: t('workout.holdStart') }));
  const setId = useHoldTimer.getState().setId;

  // Premier côté.
  act(() => {
    useHoldTimer.setState({ startedAt: Date.now() - 42_000 });
  });
  await user.click(screen.getByRole('button', { name: 'Valider la série 1' }));

  // Rien de durable : pas de validation, pas de repos, pas de RPE.
  expect((await firstSet(workoutId)).isCompleted).toBe(0);
  expect(useRestTimer.getState().setId).toBeNull();
  expect(screen.queryByRole('group', { name: t('workout.effortQuestion') })).toBeNull();
  expect(await screen.findByText(/Changement de côté ·/)).toBeInTheDocument();
  // Même série : le changement de côté ne crée pas de ligne.
  expect(useHoldTimer.getState().setId).toBe(setId);

  // Second côté, après les dix secondes.
  act(() => {
    useHoldTimer.setState({ startedAt: Date.now() - 40_000 });
  });
  await user.click(screen.getByRole('button', { name: 'Valider la série 1' }));

  await waitFor(async () => {
    expect(await firstSet(workoutId)).toMatchObject({ durationSeconds: 38, isCompleted: 1 });
  });

  // Une seule série en base, et son côté n'a pas bougé.
  const detail = await getWorkoutDetail(workoutId);
  expect(detail?.exercises[0]?.sets).toHaveLength(1);
  expect(detail?.exercises[0]?.sets[0]?.side).toBe('both');
});
```

- [ ] **Step 2 : lancer, ajuster ce qui doit l'être, faire passer**

```bash
npx vitest run src/features/workout/WorkoutScreen.integration.test.tsx -t "unilatéral"
```

Si le test échoue, corriger le **code**, jamais l'assertion, sans avoir compris pourquoi.

- [ ] **Step 3 : les quatre portes**

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

- [ ] **Step 4 : commit**

```bash
git add src/features/workout/WorkoutScreen.integration.test.tsx
git commit -m "test(workout): prouver une ligne, deux côtés, une validation"
```

---

### Task 8 : la trace écrite

**Files:**
- Modify: `PROGRESS.md`, `docs/product/FEATURE-INVENTORY.md`

- [ ] **Step 1** — `PROGRESS.md` : ce que le cycle fait, la migration `version(10)` et son
  rattrapage de sauvegarde, le texte figé du changement de côté **non encore enregistré**, les
  chiffres exacts des quatre portes, les pièges rencontrés, et le checkpoint téléphone :

  > Une série unilatérale se fait en une ligne : je saisis une fois, la cadence part, elle
  > m'annonce le changement de côté, j'ai dix secondes pour changer, elle repart, et je ne valide
  > qu'une fois. En Silence, le relevé me dit où j'en suis.

- [ ] **Step 2** — `docs/product/FEATURE-INVENTORY.md` : marquer l'unilatéral livré au backlog P1
  et à l'ordre de réalisation, et ajouter « Changement de côté. Reprise dans dix secondes. » à la
  liste des textes à valider avant génération.

- [ ] **Step 3 : commit**

```bash
git add PROGRESS.md docs/product/FEATURE-INVENTORY.md
git commit -m "docs: consigner les exercices unilatéraux"
```

---

## Ce que ce plan ne fait pas

- Enregistrer les deux côtés séparément.
- Doubler le tonnage d'une série unilatérale.
- Écrire `left` / `right` dans `WorkoutSet.side`.
- Déclarer ou générer le moindre clip vocal.
