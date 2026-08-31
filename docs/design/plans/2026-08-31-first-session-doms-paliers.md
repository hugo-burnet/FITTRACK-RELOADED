# Première séance et premières DOMS — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deux paliers à vie — `sessions-1` (Malphite-Chad, « Rock solid. ») à la première séance close, `doms-48` (la porte) 48 h plus tard — badge d'accueil partout, notification APK seulement si la première séance a été fêtée en direct.

**Architecture:** `sessions-1` réutilise `session_count`. `doms-48` est un genre `hours_since_first_session` : le moteur reste pur, `now` est injecté. Un drapeau settings `milestoneDomsFollowUp` distingue fête live et rattrapage silencieux. L'APK arme l'id `41004` ; `clearAll` de séance ne le touche pas. PWA : zéro notif, zéro pop-up.

**Tech Stack:** Vite + React + TypeScript, Dexie, Vitest, Capacitor LocalNotifications, JPEG embarqués (`public/milestones/`).

## Global Constraints

- UI française, code anglais. Exception demandée : légende `Rock solid.`
- Toutes les chaînes UI dans `src/i18n/fr.ts`. Jamais de chaîne en dur dans un composant.
- Accès données uniquement via `src/data/repositories/*`.
- Local-first, hors-ligne, pas de `VITE_*` secret.
- IDs catalogue `sessions-1` et `doms-48` : jamais renommés.
- TDD sur le moteur, le dépôt, la notif. Les JPEG ne se testent pas au pixel.
- La notif n'est jamais une barrière : un échec Capacitor n'empêche pas d'enregistrer la séance.
- Nintendo dehors. Hommage original, pas de splash Riot, pas de photo volée.
- Branche `master`. Commits `test:` / `feat:` / `fix:`.

## File map

| File | Responsibility |
|---|---|
| `src/lib/milestones/types.ts` | `hours_since_first_session`, `now?` |
| `src/lib/milestones/catalogue.ts` | `sessions-1`, `doms-48`, ids exportés |
| `src/lib/milestones/engine.ts` | franchissement à +48 h |
| `src/lib/milestones/art.ts` | clés `rock-solid`, `doms-door` |
| `src/features/milestones/milestoneCopy.ts` | titres `sessionOne` / `doms` |
| `src/i18n/fr.ts` | titres, légendes, canal de notif |
| `src/data/repositories/milestones.ts` | v2, `now`, drapeau, `bootMilestones` |
| `src/data/initialize.ts` | boot + réconciliation notif |
| `src/platform/nativeNotifications.ts` | canal `fittrack-doms`, id 41004 |
| `src/platform/NativeRuntimeBridge.tsx` | sync au `appStateChange` |
| `src/features/workout/WorkoutFinishScreen.tsx` | réconciliation après `celebrate: true` |
| `public/milestones/rock-solid.jpg` | jeton première séance |
| `public/milestones/doms-door.jpg` | jeton DOMS |

Pas de nouveau composant d'accueil : `HomeMilestoneCard` / `MilestonePeek` lisent le catalogue.

---

### Task 1: Moteur, types, catalogue

**Files:**
- Modify: `src/lib/milestones/types.ts`
- Modify: `src/lib/milestones/catalogue.ts`
- Modify: `src/lib/milestones/engine.ts`
- Test: `src/lib/milestones/engine.test.ts`
- Test: `src/lib/milestones/catalogue.test.ts` (déjà générique ; ajouter deux assertions d'id)

**Interfaces:**
- Consumes: `MILESTONES`, `nthSession` existants
- Produces: `MilestoneKind` inclut `'hours_since_first_session'` ; `MilestoneInput.now?: number` ; `FIRST_SESSION_MILESTONE_ID = 'sessions-1'` ; `FIRST_DOMS_MILESTONE_ID = 'doms-48'` ; `FIRST_DOMS_HOURS = 48` ; `earnMilestones` accorde `sessions-1` / `doms-48`

- [ ] **Step 1: Write the failing tests**

In `src/lib/milestones/engine.test.ts`, keep `run` as-is (it does not pass `now`). Append:

```ts
describe('la première séance et les premières DOMS', () => {
  const HOUR = 3_600_000;
  const FORTY_EIGHT = 48 * HOUR;

  it('accorde la première séance close', () => {
    const earned = run({ sessions: [session(MONDAY)] });
    expect(find(earned, 'sessions-1')).toMatchObject({
      value: 1,
      achievedAt: MONDAY,
      workoutId: `w-${String(MONDAY)}`,
    });
  });

  it('ne rend pas les DOMS sans now, même avec une séance vieille', () => {
    expect(find(run({ sessions: [session(MONDAY)] }), 'doms-48')).toBeUndefined();
  });

  it('ne rend pas les DOMS une milliseconde trop tôt', () => {
    const earned = earnMilestones({
      sets: [],
      sessions: [session(MONDAY)],
      now: MONDAY + FORTY_EIGHT - 1,
    });
    expect(find(earned, 'doms-48')).toBeUndefined();
  });

  it('accorde les DOMS à startedAt + 48 h pile, rattachées à la première séance', () => {
    const second = session(MONDAY + DAY);
    const earned = earnMilestones({
      sets: [],
      sessions: [session(MONDAY), second],
      now: MONDAY + FORTY_EIGHT,
    });
    expect(find(earned, 'doms-48')).toMatchObject({
      value: 48,
      achievedAt: MONDAY + FORTY_EIGHT,
      workoutId: `w-${String(MONDAY)}`,
    });
  });

  it('ignore une deuxième séance à +24 h pour dater les DOMS', () => {
    const earned = earnMilestones({
      sets: [],
      sessions: [session(MONDAY), session(MONDAY + DAY)],
      now: MONDAY + FORTY_EIGHT + DAY,
    });
    expect(find(earned, 'doms-48')?.workoutId).toBe(`w-${String(MONDAY)}`);
    expect(find(earned, 'doms-48')?.achievedAt).toBe(MONDAY + FORTY_EIGHT);
  });

  it('ne rend ni l’un ni l’autre sans séance', () => {
    expect(run({})).toEqual([]);
    expect(
      earnMilestones({ sets: [], sessions: [], now: MONDAY + FORTY_EIGHT }),
    ).toEqual([]);
  });
});
```

In `src/lib/milestones/catalogue.test.ts`, add:

```ts
  it('place la première séance et les DOMS avant le palier des dix séances', () => {
    expect(milestoneById('sessions-1')).toMatchObject({
      kind: 'session_count',
      threshold: 1,
      group: 'practice',
    });
    expect(milestoneById('doms-48')).toMatchObject({
      kind: 'hours_since_first_session',
      threshold: 48,
      group: 'practice',
    });
    const ids = MILESTONES.map((row) => row.id);
    expect(ids.indexOf('sessions-1')).toBeLessThan(ids.indexOf('sessions-10'));
    expect(ids.indexOf('doms-48')).toBeLessThan(ids.indexOf('sessions-10'));
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/milestones/engine.test.ts src/lib/milestones/catalogue.test.ts`

Expected: FAIL — `sessions-1` / `doms-48` introuvables.

- [ ] **Step 3: Types, catalogue, moteur**

`src/lib/milestones/types.ts` — add the kind and `now`:

```ts
  /** Des années écoulées depuis la première séance, et encore là. */
  | 'training_years'
  /** Des kilos soulevés depuis toujours. */
  | 'lifetime_tonnage'
  /** Des heures écoulées depuis la première séance close. */
  | 'hours_since_first_session';
```

```ts
export interface MilestoneInput {
  sets: readonly MilestoneSet[];
  sessions: readonly MilestoneSession[];
  /**
   * Instant d'évaluation. Absent, les genres horaires restent muets — c'est
   * ce qui laisse les tests existants inchangés.
   */
  now?: number;
}
```

`src/lib/milestones/catalogue.ts` — export ids, insert the two practice rows **before** `sessions-10`, widen `practice()`:

```ts
export const FIRST_SESSION_MILESTONE_ID = 'sessions-1';
export const FIRST_DOMS_MILESTONE_ID = 'doms-48';
export const FIRST_DOMS_HOURS = 48;
```

Replace the practice block opening so it reads that the first session and the first DOMS are the door, then ten sessions, and insert:

```ts
  practice(FIRST_SESSION_MILESTONE_ID, 'session_count', 1),
  practice(FIRST_DOMS_MILESTONE_ID, 'hours_since_first_session', FIRST_DOMS_HOURS),
  practice('sessions-10', 'session_count', 10),
```

```ts
function practice(
  id: string,
  kind:
    | 'session_count'
    | 'active_weeks'
    | 'training_years'
    | 'lifetime_tonnage'
    | 'hours_since_first_session',
  threshold: number,
): MilestoneDefinition {
  return { id, kind, group: kind === 'lifetime_tonnage' ? 'volume' : 'practice', threshold };
}
```

`src/lib/milestones/engine.ts` — pass `now`, add the case:

```ts
  MILESTONES.forEach((definition, order) => {
    const hit = firstCrossing(definition, sets, sessions, input.now);
    if (hit !== undefined) earned.push({ ...hit, order });
  });
```

```ts
function firstCrossing(
  definition: MilestoneDefinition,
  sets: readonly MilestoneSet[],
  sessions: readonly MilestoneSession[],
  now: number | undefined,
): Crossing | undefined {
  switch (definition.kind) {
    case 'exercise_load':
    case 'exercise_reps':
    case 'exercise_duration':
    case 'dumbbell_pair':
      return firstQualifyingSet(definition, sets);
    case 'session_count':
      return nthSession(definition, sessions);
    case 'active_weeks':
      return nthActiveWeek(definition, sessions);
    case 'training_years':
      return trainingAnniversary(definition, sessions);
    case 'lifetime_tonnage':
      return tonnageCrossing(definition, sets);
    case 'hours_since_first_session':
      return hoursSinceFirstSession(definition, sessions, now);
  }
}

const HOUR_MS = 3_600_000;

function hoursSinceFirstSession(
  definition: MilestoneDefinition,
  sessions: readonly MilestoneSession[],
  now: number | undefined,
): Crossing | undefined {
  if (now === undefined) return undefined;
  const first = sessions[0];
  if (first === undefined) return undefined;
  const dueAt = first.startedAt + definition.threshold * HOUR_MS;
  if (now < dueAt) return undefined;
  return {
    definitionId: definition.id,
    achievedAt: dueAt,
    workoutId: first.workoutId,
    value: definition.threshold,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/milestones/engine.test.ts src/lib/milestones/catalogue.test.ts`

Expected: PASS. Existing practice tests still pass: they use `not.toContain` / `toMatchObject`, not an exact id list.

- [ ] **Step 5: Commit**

```bash
git add src/lib/milestones/types.ts src/lib/milestones/catalogue.ts src/lib/milestones/engine.ts src/lib/milestones/engine.test.ts src/lib/milestones/catalogue.test.ts
git commit -m "feat(milestones): paliers première séance et DOMS 48h"
```

---

### Task 2: Titres i18n

**Files:**
- Modify: `src/i18n/fr.ts` (`milestone` + `androidNotification`)
- Modify: `src/features/milestones/milestoneCopy.ts`
- Test: `src/features/milestones/milestoneCopy.test.ts`

**Interfaces:**
- Consumes: `hours_since_first_session`, `session_count` threshold 1
- Produces: `t('milestone.sessionOne')`, `t('milestone.doms')`, clés notif `androidNotification.doms*` ; `milestoneReading('sessions-1', 1).title === 'Ta première séance'`

- [ ] **Step 1: Write the failing test**

Append to `src/features/milestones/milestoneCopy.test.ts`:

```ts
  it('accorde la première séance au singulier', () => {
    expect(milestoneReading('sessions-1', 1)?.title).toBe('Ta première séance');
    expect(milestoneReading('sessions-1', 1)?.token).toBe('1');
    expect(milestoneReading('sessions-10', 10)?.title).toBe('10 séances');
  });

  it('nomme les premières DOMS par leur phrase, pas un gabarit', () => {
    expect(milestoneReading('doms-48', 48)?.title).toBe('Tes premières DOMS');
    expect(milestoneReading('doms-48', 48)?.token).toBe('48');
  });
```

The existing loop « titre et jeton non vides à tout le catalogue » will also fail until `titleOf` handles the new kind (it would return `undefined` / not compile).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/milestones/milestoneCopy.test.ts`

Expected: FAIL or typecheck error on non-exhaustive `titleOf`.

- [ ] **Step 3: Copy + titles**

In `src/i18n/fr.ts` `milestone`, next to `sessions`:

```ts
    sessionOne: 'Ta première séance',
    sessions: '{value} séances',
    doms: 'Tes premières DOMS',
```

In `milestone.art`, add:

```ts
      'rock-solid': 'Rock solid.',
      'doms-door': 'Ça fait mal. FitTrack est toujours là. Tu lâches pas.',
```

In `androidNotification`, add:

```ts
    domsChannel: 'Premières courbatures',
    domsChannelDescription: 'Un message unique, 48 h après ta première séance.',
    domsTitle: 'Tes premières DOMS',
    domsBody: 'La porte résiste. Toi aussi.',
```

`src/features/milestones/milestoneCopy.ts` `titleOf`:

```ts
    case 'session_count':
      return definition.threshold === 1
        ? t('milestone.sessionOne')
        : t('milestone.sessions', { value });
    case 'hours_since_first_session':
      return t('milestone.doms');
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/milestones/milestoneCopy.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/i18n/fr.ts src/features/milestones/milestoneCopy.ts src/features/milestones/milestoneCopy.test.ts
git commit -m "feat(milestones): titres première séance et premières DOMS"
```

---

### Task 3: Jetons `rock-solid` et `doms-door`

**Files:**
- Modify: `src/lib/milestones/art.ts`
- Modify: `src/features/milestones/artCaption.test.ts`
- Create: `public/milestones/rock-solid.jpg`
- Create: `public/milestones/doms-door.jpg`
- Test: `src/lib/milestones/art.test.ts` (déjà générique : 58 ids, JPEG présent, unicité)

**Interfaces:**
- Consumes: ids `sessions-1`, `doms-48` ; clés i18n `milestone.art.rock-solid` / `doms-door`
- Produces: `artForMilestone('sessions-1') === 'rock-solid'` ; `artForMilestone('doms-48') === 'doms-door'` ; `captionForArt('rock-solid') === 'Rock solid.'`

- [ ] **Step 1: Write the failing tests**

`src/lib/milestones/art.test.ts` — add:

```ts
  it('réserve rock-solid à la première séance et la porte aux DOMS', () => {
    expect(artForMilestone('sessions-1')).toBe('rock-solid');
    expect(artForMilestone('doms-48')).toBe('doms-door');
  });
```

The existing tests « clé à chaque entrée » and « JPEG pour chaque clé » will fail until mapping + files exist.

`src/features/milestones/artCaption.test.ts` — replace the French-only loop and add exact captions:

```ts
describe('la légende d’un jeton', () => {
  it('donne une légende à chaque illustration', () => {
    for (const key of MILESTONE_ART_KEYS) {
      const caption = captionForArt(key);
      expect(caption, key).not.toBe(`milestone.art.${key}`);
      expect(caption, key).not.toBe('');
    }
  });

  it('explique git gud sans trophée', () => {
    expect(captionForArt('git-gud')).toBe('Tu es mort. Tu recommences.');
  });

  it('cite Malphite en anglais, tel quel', () => {
    expect(captionForArt('rock-solid')).toBe('Rock solid.');
  });

  it('rappelle que FitTrack est toujours là sous les DOMS', () => {
    expect(captionForArt('doms-door')).toBe(
      'Ça fait mal. FitTrack est toujours là. Tu lâches pas.',
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/milestones/art.test.ts src/features/milestones/artCaption.test.ts`

Expected: FAIL — clés absentes.

- [ ] **Step 3: Mapping**

`src/lib/milestones/art.ts` — append to `MILESTONE_ART_KEYS`:

```ts
  'iceberg',
  'rock-solid',
  'doms-door',
] as const;
```

Append to `ART_BY_MILESTONE`:

```ts
  'sessions-1': 'rock-solid',
  'doms-48': 'doms-door',
```

- [ ] **Step 4: Generate the two JPEGs**

Read `public/milestones/gigachad.jpg` for size (target ~192×192, square, `object-cover`). Generate two **original** illustrations (no Riot splash, no Nintendo, no photo of a real meme). Then place them at:

- `public/milestones/rock-solid.jpg`
- `public/milestones/doms-door.jpg`

Prompt `rock-solid`: square internet-meme illustration, hyper-muscular Giga Chad body, absurdly defined abs, stone-golem head like a granite rock titan (Malphite homage, original, not League splash art), stoic, gym lighting, dark background, readable at 64 px, no text, no watermark, no logo.

Prompt `doms-door`: square internet-meme illustration, stiff sore beginner in gym clothes, both hands on a door handle, back locked, struggling to open a simple indoor door, delayed-onset muscle soreness comedy, readable at 64 px, no text, no watermark.

If the generator returns PNG, convert to JPEG (~192 px, quality ~80) before saving under those names. Workbox already précache `jpg`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/lib/milestones/art.test.ts src/features/milestones/artCaption.test.ts`

Expected: PASS — 58 ids mapped, each new key used once, JPEG present, légendes exactes.

- [ ] **Step 6: Commit**

```bash
git add src/lib/milestones/art.ts src/lib/milestones/art.test.ts src/features/milestones/artCaption.test.ts public/milestones/rock-solid.jpg public/milestones/doms-door.jpg
git commit -m "feat(milestones): jetons rock-solid et porte des DOMS"
```

---

### Task 4: Projection, drapeau, boot

**Files:**
- Modify: `src/data/repositories/milestones.ts`
- Test: `src/data/repositories/milestones.test.ts`

**Interfaces:**
- Consumes: `earnMilestones({ now })`, `FIRST_SESSION_MILESTONE_ID`, `FIRST_DOMS_MILESTONE_ID`, `FIRST_DOMS_HOURS`
- Produces: `MILESTONES_PROJECTION_VERSION = 2` ; `MilestoneSyncOptions.now?: number` ; `getDomsFollowUp(): Promise<{ dueAt: number } | null>` ; `bootMilestones(now?: number): Promise<void>` ; drapeau settings `milestoneDomsFollowUp`

- [ ] **Step 1: Write the failing tests**

Append to `src/data/repositories/milestones.test.ts`, importing the new symbols:

```ts
import {
  FIRST_DOMS_HOURS,
  FIRST_DOMS_MILESTONE_ID,
  FIRST_SESSION_MILESTONE_ID,
} from '@/lib/milestones/catalogue';
import {
  bootMilestones,
  getDomsFollowUp,
  // existing imports stay
} from './milestones';

const HOUR = 3_600_000;
```

New describes (keep using `seedWorkout` / `seedExercise` — a completed workout is a session):

```ts
describe('le drapeau de suivi des DOMS', () => {
  it('pose le drapeau seulement si la première séance est fêtée en direct', async () => {
    const bench = await seedExercise();
    const workout = await seedWorkout({
      performedAt: START,
      exerciseId: bench.id,
      sets: [[20, 5]],
    });

    await syncMilestones({ celebrate: true, now: START + 60_000 });

    const followUp = await getDomsFollowUp();
    expect(followUp?.dueAt).toBe(START + FIRST_DOMS_HOURS * HOUR);
    expect((await listMilestones()).map((row) => row.definitionId)).toContain(
      FIRST_SESSION_MILESTONE_ID,
    );
    expect((await listMilestones()).map((row) => row.definitionId)).not.toContain(
      FIRST_DOMS_MILESTONE_ID,
    );
    expect(workout.id).toBeTruthy();
  });

  it('n’arme pas le drapeau sur un rattrapage silencieux', async () => {
    const bench = await seedExercise();
    await seedWorkout({ performedAt: START, exerciseId: bench.id, sets: [[20, 5]] });

    await syncMilestones({ celebrate: false, now: START + FIRST_DOMS_HOURS * HOUR });

    expect(await getDomsFollowUp()).toBeNull();
    const rows = await listMilestones();
    expect(rows.map((row) => row.definitionId)).toEqual(
      expect.arrayContaining([FIRST_SESSION_MILESTONE_ID, FIRST_DOMS_MILESTONE_ID]),
    );
    expect(rows.every((row) => row.acknowledgedAt !== 0)).toBe(true);
  });

  it('célèbre les DOMS au boot seulement si le drapeau est là', async () => {
    const bench = await seedExercise();
    await seedWorkout({ performedAt: START, exerciseId: bench.id, sets: [[20, 5]] });
    await syncMilestones({ celebrate: true, now: START + 60_000 });
    await acknowledgeMilestones((await listUnacknowledgedMilestones()).map((row) => row.id));

    await bootMilestones(START + FIRST_DOMS_HOURS * HOUR);

    const doms = (await listUnacknowledgedMilestones()).find(
      (row) => row.definitionId === FIRST_DOMS_MILESTONE_ID,
    );
    expect(doms?.acknowledgedAt).toBe(0);
    expect(doms?.achievedAt).toBe(START + FIRST_DOMS_HOURS * HOUR);
    expect(await getDomsFollowUp()).toBeNull();
  });

  it('écrit les DOMS acquittées au boot si le drapeau est absent', async () => {
    const bench = await seedExercise();
    await seedWorkout({ performedAt: START, exerciseId: bench.id, sets: [[20, 5]] });
    await syncMilestones({ celebrate: false, now: START + 60_000 });
    expect(await getDomsFollowUp()).toBeNull();

    await bootMilestones(START + FIRST_DOMS_HOURS * HOUR);

    const doms = (await listMilestones()).find(
      (row) => row.definitionId === FIRST_DOMS_MILESTONE_ID,
    );
    expect(doms?.acknowledgedAt).not.toBe(0);
    expect(await listUnacknowledgedMilestones()).toEqual([]);
  });

  it('efface le drapeau si la première séance disparaît', async () => {
    const bench = await seedExercise();
    const workout = await seedWorkout({
      performedAt: START,
      exerciseId: bench.id,
      sets: [[20, 5]],
    });
    await syncMilestones({ celebrate: true, now: START + 60_000 });
    expect(await getDomsFollowUp()).not.toBeNull();

    await db.workouts.update(workout.id, { deletedAt: Date.now() });
    await syncMilestones({ celebrate: true, now: START + 60_000 });

    expect(await getDomsFollowUp()).toBeNull();
    expect((await listMilestones()).map((row) => row.definitionId)).not.toContain(
      FIRST_SESSION_MILESTONE_ID,
    );
  });
});
```

Bump expectation: `ensureMilestoneProjection` after a old workout will now also write `sessions-1` and `doms-48` once `now` defaults to `Date.now()` (START is 2026-01-01). Existing tests use `arrayContaining` / `length > 0` and stay valid **once `readEarned` passes `now`**.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/data/repositories/milestones.test.ts`

Expected: FAIL — `getDomsFollowUp` / `bootMilestones` / `now` absents.

- [ ] **Step 3: Implement repository**

Imports at top of `milestones.ts`:

```ts
import {
  FIRST_DOMS_HOURS,
  FIRST_DOMS_MILESTONE_ID,
  FIRST_SESSION_MILESTONE_ID,
} from '@/lib/milestones/catalogue';
```

Constants and options:

```ts
export const MILESTONES_PROJECTION_VERSION = 2;
export const DOMS_FOLLOW_UP_KEY = 'milestoneDomsFollowUp';
```

```ts
export interface MilestoneSyncOptions {
  celebrate: boolean;
  now?: number;
}
```

```ts
async function readEarned(now: number): Promise<EarnedMilestone[]> {
  const workouts = await listHistoricalWorkouts({ kind: 'all-history' });
  return earnMilestones({
    sets: workouts.flatMap(milestoneSetsOf),
    sessions: workouts.map((workout) => ({
      workoutId: workout.workoutId,
      startedAt: workout.startedAt,
    })),
    now,
  });
}

function followUpDueAt(firstAchievedAt: number): number {
  return firstAchievedAt + FIRST_DOMS_HOURS * 3_600_000;
}

export async function getDomsFollowUp(): Promise<{ dueAt: number } | null> {
  const stored = await db.settings.get(DOMS_FOLLOW_UP_KEY);
  const value: unknown = stored?.value;
  if (typeof value !== 'object' || value === null) return null;
  const dueAt = (value as { dueAt?: unknown }).dueAt;
  return typeof dueAt === 'number' ? { dueAt } : null;
}

export async function syncMilestones({
  celebrate,
  now = Date.now(),
}: MilestoneSyncOptions): Promise<Milestone[]> {
  const earned = await readEarned(now);

  return db.transaction('rw', db.milestones, db.settings, async () => {
    const existing = alive(await db.milestones.toArray());
    const byDefinition = new Map(existing.map((row) => [row.definitionId, row]));
    const created: Milestone[] = [];

    for (const item of earned) {
      const row = byDefinition.get(item.definitionId);
      byDefinition.delete(item.definitionId);

      if (row === undefined) {
        const fresh = newEntity<Milestone>({
          definitionId: item.definitionId,
          achievedAt: item.achievedAt,
          workoutId: item.workoutId,
          value: item.value,
          acknowledgedAt: celebrate ? 0 : now,
        });
        await db.milestones.add(fresh);
        if (celebrate) created.push(fresh);
        continue;
      }

      if (
        row.achievedAt !== item.achievedAt ||
        row.value !== item.value ||
        row.workoutId !== item.workoutId
      ) {
        await db.milestones.put(
          touch(row, {
            achievedAt: item.achievedAt,
            value: item.value,
            workoutId: item.workoutId,
          }),
        );
      }
    }

    for (const orphan of byDefinition.values()) {
      await softDelete(db.milestones, orphan.id);
    }

    const earnedIds = new Set(earned.map((item) => item.definitionId));
    const firstCreated = created.find(
      (row) => row.definitionId === FIRST_SESSION_MILESTONE_ID,
    );
    if (celebrate && firstCreated !== undefined) {
      await db.settings.put({
        key: DOMS_FOLLOW_UP_KEY,
        value: { dueAt: followUpDueAt(firstCreated.achievedAt) },
        updatedAt: now,
      });
    }
    if (
      !earnedIds.has(FIRST_SESSION_MILESTONE_ID) ||
      earnedIds.has(FIRST_DOMS_MILESTONE_ID)
    ) {
      await db.settings.delete(DOMS_FOLLOW_UP_KEY);
    }
    return created;
  });
}

export async function bootMilestones(now = Date.now()): Promise<void> {
  await ensureMilestoneProjection();
  if ((await getDomsFollowUp()) !== null) {
    await syncMilestones({ celebrate: true, now });
    return;
  }
  const rows = alive(await db.milestones.toArray());
  const hasFirst = rows.some((row) => row.definitionId === FIRST_SESSION_MILESTONE_ID);
  const hasDoms = rows.some((row) => row.definitionId === FIRST_DOMS_MILESTONE_ID);
  if (hasFirst && !hasDoms) {
    await syncMilestones({ celebrate: false, now });
  }
}
```

Keep `ensureMilestoneProjection` as the silent version bump (it already calls `syncMilestones({ celebrate: false })`). After bumping `MILESTONES_PROJECTION_VERSION` to 2, the next launch writes both paliers acquitted for existing histories.

Pass `now` into that inner `syncMilestones` too:

```ts
export async function ensureMilestoneProjection(now = Date.now()): Promise<void> {
  const stored = await db.settings.get(PROJECTION_KEY);
  if (stored?.value === MILESTONES_PROJECTION_VERSION) return;
  await syncMilestones({ celebrate: false, now });
  await db.settings.put({
    key: PROJECTION_KEY,
    value: MILESTONES_PROJECTION_VERSION,
    updatedAt: now,
  });
}
```

`bootMilestones` must call `ensureMilestoneProjection(now)` so tests that freeze time stay coherent.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/data/repositories/milestones.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/repositories/milestones.ts src/data/repositories/milestones.test.ts
git commit -m "feat(milestones): drapeau live et boot des DOMS"
```

---

### Task 5: Notification APK

**Files:**
- Modify: `src/platform/nativeNotifications.ts`
- Test: `src/platform/nativeNotifications.test.ts`

**Interfaces:**
- Consumes: i18n `androidNotification.domsTitle` / `domsBody` / `domsChannel*`
- Produces: `DOMS_NOTIFICATION_ID = 41004` ; `DOMS_CHANNEL_ID = 'fittrack-doms'` ; `reconcileDoms(dueAt: number | null, now?: number): Promise<void>` ; `clearAll` n'annule **pas** 41004

- [ ] **Step 1: Write the failing tests**

In `src/platform/nativeNotifications.test.ts`, import the new constants and add:

```ts
  it('creates the DOMS channel with reminder-level importance', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());
    await gateway.reconcileWorkout('Lower A');
    expect(plugin.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        id: DOMS_CHANNEL_ID,
        importance: 4,
        visibility: 1,
        vibration: true,
      }),
    );
  });

  it('schedules the DOMS notification only when dueAt is in the future', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());
    const dueAt = Date.now() + 3_600_000;

    await gateway.reconcileDoms(dueAt);

    expect(plugin.schedule).toHaveBeenCalledWith({
      notifications: [
        expect.objectContaining({
          id: DOMS_NOTIFICATION_ID,
          title: t('androidNotification.domsTitle'),
          body: t('androidNotification.domsBody'),
          channelId: DOMS_CHANNEL_ID,
          autoCancel: true,
          schedule: expect.objectContaining({ allowWhileIdle: true }),
        }),
      ],
    });
  });

  it('does not schedule a late DOMS notification, it cancels instead', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());
    await gateway.reconcileDoms(Date.now() - 1_000);
    expect(plugin.schedule).not.toHaveBeenCalled();
    expect(plugin.cancel).toHaveBeenCalledWith({ notifications: [{ id: DOMS_NOTIFICATION_ID }] });
  });

  it('does not schedule DOMS outside Android', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => false, vi.fn());
    await gateway.reconcileDoms(Date.now() + 3_600_000);
    expect(plugin.schedule).not.toHaveBeenCalled();
  });

  it('does not cancel the DOMS notification when a workout ends', async () => {
    const plugin = createPlugin();
    const gateway = createNativeNotificationGateway(plugin, () => true, vi.fn());
    await gateway.clearAll();
    expect(plugin.cancel).toHaveBeenCalledWith({
      notifications: [{ id: WORKOUT_NOTIFICATION_ID }, { id: REST_NOTIFICATION_ID }],
    });
  });
```

Update the existing test « Les quatre canaux de RF-53 » :

```ts
    expect(plugin.createChannel).toHaveBeenCalledTimes(5);
```

`plugin.cancel` reçoit `{ notifications: ids.map((id) => ({ id })) }` — déjà le contrat des tests repos/séance.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/platform/nativeNotifications.test.ts`

Expected: FAIL — `reconcileDoms` / constants absents.

- [ ] **Step 3: Implement gateway**

```ts
export const DOMS_NOTIFICATION_ID = 41004;
export const DOMS_CHANNEL_ID = 'fittrack-doms';
```

Add to `NativeNotificationGateway`:

```ts
  reconcileDoms: (dueAt: number | null, now?: number) => Promise<void>;
```

In `initialize()`, create the channel (importance 4, vibration true, visibility 1), same pattern as reminders.

```ts
    reconcileDoms(dueAt, now = Date.now()) {
      return enqueue(async () => {
        if (!isAndroid()) return;
        if (dueAt === null || dueAt <= now) {
          await cancel([DOMS_NOTIFICATION_ID]);
          return;
        }
        if (!(await ensureReady())) return;
        await plugin.schedule({
          notifications: [
            {
              id: DOMS_NOTIFICATION_ID,
              title: t('androidNotification.domsTitle'),
              body: t('androidNotification.domsBody'),
              channelId: DOMS_CHANNEL_ID,
              schedule: { at: new Date(dueAt), allowWhileIdle: true },
              autoCancel: true,
            },
          ],
        });
      });
    },
```

Leave `clearAll` cancelling only `WORKOUT_NOTIFICATION_ID` and `REST_NOTIFICATION_ID`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/platform/nativeNotifications.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/platform/nativeNotifications.ts src/platform/nativeNotifications.test.ts
git commit -m "feat(android): notif DOMS 48h hors clearAll de séance"
```

---

### Task 6: Brancher boot, fin de séance, reprise Android

**Files:**
- Modify: `src/data/initialize.ts`
- Modify: `src/platform/NativeRuntimeBridge.tsx`
- Modify: `src/platform/NativeRuntimeBridge.test.tsx`
- Modify: `src/features/workout/WorkoutFinishScreen.tsx`
- Modify: `src/features/milestones/MilestonesScreen.tsx` (commentaire 56 → 58)

**Interfaces:**
- Consumes: `bootMilestones`, `getDomsFollowUp`, `syncMilestones`, `nativeNotifications.reconcileDoms`
- Produces: cold start + `appStateChange` actif + post-`finishWorkout` réconcilient drapeau et notif ; échec avalé

- [ ] **Step 1: Write the failing tests (bridge)**

In `src/platform/NativeRuntimeBridge.test.tsx` hoisted state, add:

```ts
  bootMilestones: vi.fn().mockResolvedValue(undefined),
  getDomsFollowUp: vi.fn().mockResolvedValue(null),
  reconcileDoms: vi.fn().mockResolvedValue(undefined),
```

Mock the repository:

```ts
vi.mock('@/data/repositories/milestones', () => ({
  bootMilestones: state.bootMilestones,
  getDomsFollowUp: state.getDomsFollowUp,
}));
```

Extend the `nativeNotifications` mock with `reconcileDoms: state.reconcileDoms`.

Add:

```ts
  it('boots paliers and the DOMS notification on mount', async () => {
    state.getDomsFollowUp.mockResolvedValue({ dueAt: 1_700_000_000_000 });
    render(<NativeRuntimeBridge />);

    await waitFor(() => {
      expect(state.bootMilestones).toHaveBeenCalled();
      expect(state.reconcileDoms).toHaveBeenCalledWith(1_700_000_000_000);
    });
  });

  it('resyncs time-based paliers and the DOMS notification when Android resumes', async () => {
    state.getDomsFollowUp.mockResolvedValue({ dueAt: 1_700_000_000_000 });
    render(<NativeRuntimeBridge />);
    await waitFor(() => expect(state.appStateListener).toBeTypeOf('function'));
    vi.clearAllMocks();
    state.getDomsFollowUp.mockResolvedValue({ dueAt: 1_700_000_000_000 });

    act(() => state.appStateListener?.({ isActive: true }));

    await waitFor(() => {
      expect(state.bootMilestones).toHaveBeenCalled();
      expect(state.reconcileDoms).toHaveBeenCalledWith(1_700_000_000_000);
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/platform/NativeRuntimeBridge.test.tsx`

Expected: FAIL — `bootMilestones` never called on resume.

- [ ] **Step 3: Wire the three callers**

`src/data/initialize.ts` — replace `ensureMilestoneProjection` with `bootMilestones`, then reconcile (never a gate):

```ts
import { bootMilestones, getDomsFollowUp } from '@/data/repositories/milestones';
import { nativeNotifications } from '@/platform/nativeNotifications';

  try {
    await bootMilestones();
    const followUp = await getDomsFollowUp();
    await nativeNotifications.reconcileDoms(followUp?.dueAt ?? null);
  } catch (error) {
    console.error('Les paliers n’ont pas pu être calculés', error);
  }
```

`src/platform/NativeRuntimeBridge.tsx` — extract the same sequence and call it on mount **and** on `appStateChange` actif (un cold start Android ne rejoue pas `appStateChange`) :

```ts
function syncTimeBasedPaliers(): Promise<void> {
  return bootMilestones()
    .then(async () => {
      const followUp = await getDomsFollowUp();
      await nativeNotifications.reconcileDoms(followUp?.dueAt ?? null);
    })
    .catch(() => undefined);
}
```

`useEffect(() => { void syncTimeBasedPaliers(); }, []);` plus l'appel dans le listener `isActive`.

Import `bootMilestones` and `getDomsFollowUp` from `@/data/repositories/milestones`.

`initializePersistentData` appelle aussi cette réconciliation : hors Android `reconcileDoms` no-op (`isNativeAndroid() === false` en jsdom), donc `initialize.test.ts` n'a pas besoin d'un mock Capacitor.

`src/features/workout/WorkoutFinishScreen.tsx` — after `syncMilestones({ celebrate: true })`, same reconcile, still non-blocking:

```ts
      .then(() => syncMilestones({ celebrate: true }).catch(() => undefined))
      .then(async () => {
        try {
          const followUp = await getDomsFollowUp();
          await nativeNotifications.reconcileDoms(followUp?.dueAt ?? null);
        } catch {
          /* la notif n'est jamais une barrière */
        }
      })
      .then(() => navigate('/', { replace: true }))
```

`src/features/milestones/MilestonesScreen.tsx` — comment `56 jetons` → `58 jetons`.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/platform/NativeRuntimeBridge.test.tsx src/data/initialize.test.ts src/features/workout/WorkoutFinishScreen.test.tsx src/lib/milestones src/data/repositories/milestones.test.ts src/platform/nativeNotifications.test.ts`

Expected: PASS. `initialize.test.ts` still mounts : `bootMilestones` on an empty DB is a no-op after silent bump.

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`

Expected: PASS. `titleOf` / `firstCrossing` exhaustive.

- [ ] **Step 6: Commit**

```bash
git add src/data/initialize.ts src/platform/NativeRuntimeBridge.tsx src/platform/NativeRuntimeBridge.test.tsx src/features/workout/WorkoutFinishScreen.tsx src/features/milestones/MilestonesScreen.tsx
git commit -m "feat(milestones): brancher DOMS au boot, à la reprise et en fin de séance"
```

---

## Self-review vs spec

| Spec § | Task |
|---|---|
| 1 Objectif (deux paliers, PWA badge, APK notif, rattrapage muet) | 1, 4, 5, 6 |
| 3 Catalogue ids / titres / datation | 1, 2 |
| 4 Moteur `now?`, frontière 48 h | 1 |
| 5 Projection v2, drapeau, boot, pas de pop-up fin de séance | 4, 6 |
| 6 Notif 41004, canal dédié, pas dans `clearAll`, pas de 4ᵉ switch | 5 |
| 7 Surfaces existantes, demo 58 | 3, 6 |
| 8 Visuels + copies exactes | 2, 3 |
| 9 Bords (2ᵉ séance, delete, horloge, late notif) | 1, 4, 5 |
| 10 Tests listés | répartis 1–5 |
| 12 Hors périmètre | aucun interrupteur, pas d'image dans la notif, pas de `endedAt` |

Pas de TBD. Signatures stables : `getDomsFollowUp(): Promise<{ dueAt: number } \| null>`, `reconcileDoms(dueAt: number \| null, now?: number)`, `bootMilestones(now?: number)`.
