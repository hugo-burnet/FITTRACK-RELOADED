# Hevy Exercise Matching and Routine Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve Hevy exercise associations and atomically create dated FitTrack routine folders from the most complete recent imported workouts.

**Architecture:** Keep matching and routine selection as pure modules. The Hevy repository resolves exercises once, builds workout and routine entities from the same mapping, then writes every affected table in one Dexie transaction. React only presents the prepared matches and routine preview.

**Tech Stack:** TypeScript strict, Vitest, Dexie.js, React, existing FitTrack repositories and i18n.

## Global Constraints

- Everything works offline without an account, backend, network access or new dependency.
- Exact canonical aliases may be preconfirmed; approximate matches always require confirmation.
- Existing saved mappings keep priority when their target is alive and measurement-compatible.
- Routine references come from at most the five most recent importable workouts of each normalized title.
- Choose the workout with the most distinct exercises, breaking ties with the most recent workout.
- Imported routines preserve exercise order, set count and set types, but every `supersetGroup` is `0`.
- Copy performed reps, duration and distance as targets; never copy weight or RPE as routine targets.
- Create routines only when at least one workout is importable and never modify existing routines.
- All import writes occur in one Dexie transaction.
- UI text remains in `src/i18n/fr.ts`.
- Code and comments remain in English.

---

### Task 1: Canonical Hevy aliases and safer ranking

**Files:**
- Create: `src/lib/hevyExerciseAliases.ts`
- Modify: `src/lib/hevyExerciseMatch.ts`
- Modify: `src/lib/hevyExerciseMatch.test.ts`

**Interfaces:**
- Consumes: a Hevy title and the alive, measurement-compatible `Exercise[]`.
- Produces:

```ts
export const HEVY_EXERCISE_SLUG_BY_KEY: Readonly<Record<string, string>>;

export function findCanonicalHevyExercise(
  sourceTitle: string,
  exercises: readonly Exercise[],
): Exercise | undefined;

export function rankHevyExerciseCandidates(
  sourceTitle: string,
  exercises: readonly Exercise[],
): Exercise[];
```

- [ ] **Step 1: Write failing canonical-alias tests**

Add table-driven tests to `src/lib/hevyExerciseMatch.test.ts`:

```ts
it.each([
  ['Abduction Hanche', 'hip-abduction-machine'],
  ['Adduction Hanche', 'hip-adduction-machine'],
  ['Chest Press (Machine)', 'machine-chest-press'],
  ['Curl Biceps (Haltère)', 'dumbbell-curl'],
  ['Curl Marteau (Haltère)', 'hammer-curl'],
  ['Dead Hang', 'dead-hang'],
  ['Développé Couché (Haltère)', 'dumbbell-bench-press'],
  ['Développé Couché Incliné (Haltère)', 'dumbbell-incline-bench-press'],
  ['Élévation Latérale (Poulie)', 'cable-lateral-raise'],
  ['Extension Dos (Hyperextension Lestée)', 'weighted-back-extension'],
  ['Extension Jambes', 'leg-extension'],
  ['Extension Triceps Corde', 'cable-triceps-pushdown-rope'],
  ['Kickbacks Poulie', 'cable-glute-kickback'],
  ['Leg Curl Assis', 'seated-leg-curl'],
  ['Planche', 'plank'],
  ['Planche Latérale', 'side-plank'],
  ['Presse à Cuisses Horizontal', 'leg-press'],
  ['Presse Épaules Assis (Machine)', 'machine-shoulder-press'],
  ['Tirage Poitrine (Poulie)', 'lat-pulldown'],
  ['Tirage vers Visage', 'face-pull'],
])('maps %s to the catalogue slug %s', (title, slug) => {
  const candidate = catalogueExercise(slug);
  expect(findCanonicalHevyExercise(title, [candidate])?.slug).toBe(slug);
});

it.each([
  'Développé Debout Poulie Centrée',
  'Hip Thrust (Dumbbell)',
  'Rotation Externe Poulie',
  'Tirage bas iso-latéral',
])('does not invent a canonical target for %s', (title) => {
  expect(findCanonicalHevyExercise(title, catalogue)).toBeUndefined();
});

it('rejects an alias target with an incompatible measurement', () => {
  const deadHang = catalogueExercise('dead-hang');
  expect(
    findCanonicalHevyExercise('Dead Hang', [
      { ...deadHang, measurementType: 'weight_reps' },
    ]),
  ).toBeUndefined();
});

it('uses bilingual movement synonyms for non-canonical titles', () => {
  const candidates = [
    exercise('Développé épaules (haltères)', 'dumbbell'),
    exercise('Curl haltères', 'dumbbell'),
  ];
  expect(
    rankHevyExerciseCandidates(
      'Seated Dumbbell Shoulder Press',
      candidates,
    )[0]?.name,
  ).toBe('Développé épaules (haltères)');
});

it('uses ordered movement tokens to break an otherwise close match', () => {
  const candidates = [
    exercise('Tirage horizontal (poulie basse)', 'cable'),
    exercise('Tirage vertical (poulie haute)', 'cable'),
  ];
  expect(
    rankHevyExerciseCandidates('Low Cable Horizontal Row', candidates)[0]
      ?.name,
  ).toBe('Tirage horizontal (poulie basse)');
});
```

`catalogueExercise(slug)` loads or constructs an `Exercise` with that exact `slug`; `catalogue`
contains the relevant catalogue rows as complete `Exercise` objects.

- [ ] **Step 2: Run the tests and verify the expected failure**

Run:

```bash
npm run test:run -- src/lib/hevyExerciseMatch.test.ts
```

Expected: FAIL because `findCanonicalHevyExercise` and the alias module do not exist.

- [ ] **Step 3: Implement the normalized alias table**

In `src/lib/hevyExerciseAliases.ts`, export a frozen mapping whose keys combine the output of
`normalizeHevyExerciseTitle` and `inferHevyEquipment` as `<name>|<equipment>`. Keeping equipment
in the key prevents barbell, dumbbell and Smith variants from collapsing onto one alias. Include
exactly the twenty safe aliases from Step 1:

```ts
export const HEVY_EXERCISE_SLUG_BY_KEY: Readonly<
  Record<string, string>
> = Object.freeze({
  'abduction hanche|other': 'hip-abduction-machine',
  'adduction hanche|other': 'hip-adduction-machine',
  'chest pres|machine': 'machine-chest-press',
  'curl bicep|dumbbell': 'dumbbell-curl',
  'curl marteau|dumbbell': 'hammer-curl',
  'dead hang|other': 'dead-hang',
  'developpe couche|dumbbell': 'dumbbell-bench-press',
  'developpe couche incline|dumbbell': 'dumbbell-incline-bench-press',
  'elevation laterale|cable': 'cable-lateral-raise',
  'extension dos hyperextension lestee|other': 'weighted-back-extension',
  'extension jambe|other': 'leg-extension',
  'extension tricep corde|other': 'cable-triceps-pushdown-rope',
  'kickback|cable': 'cable-glute-kickback',
  'leg curl assi|other': 'seated-leg-curl',
  'planche|other': 'plank',
  'planche laterale|other': 'side-plank',
  'presse cuisse horizontal|other': 'leg-press',
  'presse epaule assi|machine': 'machine-shoulder-press',
  'tirage poitrine|cable': 'lat-pulldown',
  'tirage ver visage|other': 'face-pull',
});
```

Because equipment words are removed by normalization, canonical resolution must also require the
target equipment to equal `inferHevyEquipment(sourceTitle)` whenever the inferred value is not
`other`. This prevents `Développé Couché (Haltère)` and similarly normalized equipment variants
from sharing a wrong alias.

- [ ] **Step 4: Implement canonical lookup and strengthen fallback ranking**

Add `findCanonicalHevyExercise` to `src/lib/hevyExerciseMatch.ts`. It:

1. normalizes the title and infers its equipment;
2. builds `${normalizedTitle}|${sourceEquipment}`;
3. reads the target slug;
4. finds an exercise with that slug;
5. requires an explicit inferred equipment match unless inference returns `other`;
6. returns `undefined` otherwise.

Change the fallback score to make explicit equipment meaningful:

```ts
const equipmentScore =
  sourceEquipment === 'other'
    ? 0
    : exercise.equipment === sourceEquipment
      ? 120
      : -120;
const synonymDice =
  diceCoefficient(sourceMatchTokens, candidateMatchTokens) * 100;
const orderedScore =
  orderedTokenSimilarity(sourceMatchTokensList, candidateMatchTokensList) *
  40;

return (
  (candidateName === sourceName ? 1_000 : 0) +
  synonymDice +
  orderedScore +
  equipmentScore -
  Math.abs(sourceTokens.size - candidateTokens.size)
);
```

Build match-only tokens without changing `normalizeHevyExerciseTitle`, because that stable
normalization is already used as the saved-mapping key. Map these bilingual variants to shared
canonical tokens:

```ts
const MATCH_TOKEN = new Map<string, string>([
  ['back', 'dos'],
  ['chest', 'poitrine'],
  ['dumbbell', 'haltere'],
  ['face', 'visage'],
  ['hang', 'suspension'],
  ['leg', 'jambe'],
  ['low', 'bas'],
  ['plank', 'gainage'],
  ['pres', 'developpe'],
  ['press', 'developpe'],
  ['raise', 'elevation'],
  ['row', 'tirage'],
  ['shoulder', 'epaule'],
]);
```

`orderedTokenSimilarity` is the longest common subsequence length divided by the larger token-list
length, returning `0` when both lists are empty. Apply singularization before synonym mapping.
Keep deterministic French collation as the final tie-breaker.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm run test:run -- src/lib/hevyExerciseMatch.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/hevyExerciseAliases.ts src/lib/hevyExerciseMatch.ts src/lib/hevyExerciseMatch.test.ts
git commit -m "feat(lot-07): fiabilise les associations Hevy"
```

---

### Task 2: Auto-resolve only canonical matches

**Files:**
- Modify: `src/features/history/hevyImportDraft.ts`
- Modify: `src/features/history/hevyImportDraft.test.ts`
- Modify: `src/features/history/HevyImportMappingStep.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Consumes: `findCanonicalHevyExercise`, saved mappings and compatible exercises.
- Produces:

```ts
export interface HevyMappingDraftRow {
  source: HevySourceExercise;
  suggestion?: Exercise;
  resolution?: HevyExerciseResolution;
  resolutionSource?: 'saved' | 'canonical' | 'user';
}
```

- [ ] **Step 1: Write failing draft tests**

Add to `src/features/history/hevyImportDraft.test.ts`:

```ts
it('preconfirms an alive compatible canonical alias', () => {
  const deadHangSource = sourceFor('Dead Hang', 'time_only', 'other');
  const deadHang = exerciseFor('dead-hang', 'time_only', 'bodyweight');
  const draft = createHevyImportDraft(dataFor(deadHangSource), {
    exercises: [deadHang],
    existingImportKeys: [],
    savedMappings: {},
  });

  expect(draft.rows[0]).toMatchObject({
    resolution: { kind: 'existing', exerciseId: deadHang.id },
    resolutionSource: 'canonical',
  });
});

it('keeps an approximate match unresolved', () => {
  const unknown = sourceFor(
    'Rotation Externe Poulie',
    'weight_reps',
    'cable',
  );
  const draft = createHevyImportDraft(dataFor(unknown), {
    exercises: [bench],
    existingImportKeys: [],
    savedMappings: {},
  });

  expect(draft.rows[0]?.suggestion).toBeDefined();
  expect(draft.rows[0]?.resolution).toBeUndefined();
});

it('keeps a saved mapping ahead of a canonical alias', () => {
  const draft = createHevyImportDraft(data, {
    exercises: [bench, alternateBench],
    existingImportKeys: [],
    savedMappings: { 'developpe couche': alternateBench.id },
  });

  expect(draft.rows[0]).toMatchObject({
    resolution: {
      kind: 'existing',
      exerciseId: alternateBench.id,
    },
    resolutionSource: 'saved',
  });
});
```

Define `sourceFor`, `exerciseFor`, `dataFor` and `alternateBench` as complete typed fixtures in the
test file.

- [ ] **Step 2: Run and verify failure**

Run:

```bash
npm run test:run -- src/features/history/hevyImportDraft.test.ts
```

Expected: FAIL because canonical matches are not used by the draft.

- [ ] **Step 3: Implement canonical resolution priority**

In `createHevyImportDraft`, after validating the saved mapping:

```ts
const canonical = findCanonicalHevyExercise(
  source.sourceTitle,
  compatibleExercises,
);
const suggestion =
  canonical ??
  rankHevyExerciseCandidates(
    source.sourceTitle,
    compatibleExercises,
  )[0];
const automatic = saved ?? canonical;
const resolutionSource =
  saved !== undefined
    ? 'saved'
    : canonical !== undefined
      ? 'canonical'
      : undefined;
```

Return an existing-exercise resolution only when `automatic` exists. Preserve `suggestion` for
display and keep `setHevyImportResolution` assigning `resolutionSource: 'user'`.

- [ ] **Step 4: Add canonical UI copy**

Add to `src/i18n/fr.ts`:

```ts
importCanonical: 'Détection sûre',
```

In `HevyImportMappingStep.mappingReading`, map `resolutionSource === 'canonical'` to that key.
Saved and user-selected labels remain unchanged.

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```bash
npm run test:run -- src/features/history/hevyImportDraft.test.ts src/lib/hevyExerciseMatch.test.ts
npm run typecheck
```

Expected: both commands PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/history/hevyImportDraft.ts src/features/history/hevyImportDraft.test.ts src/features/history/HevyImportMappingStep.tsx src/i18n/fr.ts
git commit -m "feat(lot-07): préconfirme les détections Hevy sûres"
```

---

### Task 3: Select representative routine workouts

**Files:**
- Create: `src/lib/hevyRoutineSelection.ts`
- Create: `src/lib/hevyRoutineSelection.test.ts`

**Interfaces:**
- Consumes: the importable `HevyParsedWorkout[]`.
- Produces:

```ts
export interface HevyRoutineSource {
  name: string;
  workout: HevyParsedWorkout;
}

export function normalizeHevyRoutineName(name: string): string;

export function selectHevyRoutineSources(
  workouts: readonly HevyParsedWorkout[],
): HevyRoutineSource[];
```

- [ ] **Step 1: Write failing selection tests**

Create `src/lib/hevyRoutineSelection.test.ts` with typed workout builders and these cases:

```ts
it('groups titles without regard to case or repeated spaces', () => {
  const result = selectHevyRoutineSources([
    workout('UPPER A', 100, ['bench']),
    workout(' upper   a ', 200, ['bench', 'row']),
  ]);

  expect(result).toHaveLength(1);
  expect(result[0]?.workout.startedAt).toBe(200);
});

it('chooses the most complete of the five latest workouts', () => {
  const result = selectHevyRoutineSources([
    workout('Upper A', 100, ['old', 'exercise', 'list', 'ignored']),
    workout('Upper A', 200, ['bench', 'row']),
    workout('Upper A', 300, ['bench', 'row', 'curl']),
    workout('Upper A', 400, ['bench']),
    workout('Upper A', 500, ['bench', 'row']),
    workout('Upper A', 600, ['bench', 'row']),
  ]);

  expect(result[0]?.workout.startedAt).toBe(300);
});

it('breaks equal exercise counts with the newest workout', () => {
  const result = selectHevyRoutineSources([
    workout('Upper B', 100, ['incline', 'row']),
    workout('Upper B', 200, ['incline', 'pulldown']),
  ]);

  expect(result[0]?.workout.startedAt).toBe(200);
  expect(result[0]?.name).toBe('Upper B');
});

it('counts distinct exercise sources instead of repeated rows', () => {
  const duplicated = workout('Lower A', 100, ['press', 'press']);
  const varied = workout('Lower A', 200, ['press', 'curl']);
  expect(
    selectHevyRoutineSources([duplicated, varied])[0]?.workout.startedAt,
  ).toBe(200);
});
```

The builder creates complete `HevyParsedWorkout` and `HevyParsedExercise` objects; repeated names
must remain separate exercise rows so the selector itself performs distinct counting.

- [ ] **Step 2: Run and verify failure**

Run:

```bash
npm run test:run -- src/lib/hevyRoutineSelection.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the selector**

Implement:

```ts
export function normalizeHevyRoutineName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr');
}
```

Group by normalized title. For each group:

1. sort descending by `startedAt`;
2. take the first five;
3. sort those by descending count of distinct normalized exercise titles, then descending
   `startedAt`;
4. return the winner with `name: winner.title.trim().replace(/\s+/g, ' ')`.

Sort the returned routine sources by their selected workout `startedAt` so folder order is stable
and chronological.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm run test:run -- src/lib/hevyRoutineSelection.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/hevyRoutineSelection.ts src/lib/hevyRoutineSelection.test.ts
git commit -m "feat(lot-07): sélectionne les routines Hevy représentatives"
```

---

### Task 4: Build and atomically persist routine entities

**Files:**
- Create: `src/data/repositories/hevyRoutineImport.ts`
- Create: `src/data/repositories/hevyRoutineImport.test.ts`
- Modify: `src/data/repositories/hevyImport.ts`
- Modify: `src/data/repositories/hevyImport.test.ts`

**Interfaces:**
- Consumes: selected routine sources and the resolved exercise map used by workout import.
- Produces:

```ts
export interface HevyRoutineEntities {
  folder: RoutineFolder;
  routines: Routine[];
  rows: RoutineExercise[];
  sets: RoutineSet[];
}

export function hevyImportFolderBaseName(importedAt: number): string;

export function nextHevyImportFolderName(
  importedAt: number,
  aliveFolderNames: readonly string[],
): string;

export function buildHevyRoutineEntities(
  sources: readonly HevyRoutineSource[],
  exercisesBySourceKey: ReadonlyMap<string, Exercise>,
  folderName: string,
  folderOrder: number,
  firstRoutineOrder: number,
): HevyRoutineEntities;
```

Extend:

```ts
export interface HevyImportResult {
  importedWorkouts: number;
  skippedWorkouts: number;
  createdExercises: number;
  importedExercises: number;
  importedSets: number;
  createdRoutines: number;
  routineFolderName?: string;
}

export async function importHevyWorkouts(
  data: HevyImportData,
  resolutions: Readonly<HevyExerciseResolutions>,
  importedAt?: number,
): Promise<HevyImportResult>;
```

- [ ] **Step 1: Write failing entity-builder tests**

Create `src/data/repositories/hevyRoutineImport.test.ts` covering:

```ts
it('builds ordered routines without supersets, weights or RPE targets', () => {
  const entities = buildHevyRoutineEntities(
    selectHevyRoutineSources([upperA]),
    resolvedExercises,
    'Import Hevy — 27/07/2026',
    2,
    4,
  );

  expect(entities.folder).toMatchObject({
    name: 'Import Hevy — 27/07/2026',
    order: 2,
  });
  expect(entities.routines[0]).toMatchObject({
    name: 'UPPER A',
    folderId: entities.folder.id,
    order: 4,
    version: 1,
  });
  expect(entities.rows.map((row) => ({
    order: row.order,
    supersetGroup: row.supersetGroup,
    restSeconds: row.restSeconds,
  }))).toEqual([
    { order: 0, supersetGroup: 0, restSeconds: 0 },
    { order: 1, supersetGroup: 0, restSeconds: 0 },
  ]);
  expect(entities.sets[0]).toMatchObject({
    order: 0,
    setType: 'normal',
    targetReps: 8,
  });
  expect(entities.sets[0]).not.toHaveProperty('targetWeight');
  expect(entities.sets[0]).not.toHaveProperty('targetRpe');
});

it('copies duration and distance targets', () => {
  const entities = buildHevyRoutineEntities(
    selectHevyRoutineSources([cardio]),
    resolvedExercises,
    'Import Hevy — 27/07/2026',
    0,
    0,
  );

  expect(entities.sets[0]).toMatchObject({
    targetDurationSeconds: 300,
    targetDistanceMeters: 1_000,
  });
});

it.each([
  [[], 'Import Hevy — 27/07/2026'],
  [['Import Hevy — 27/07/2026'], 'Import Hevy — 27/07/2026 (2)'],
  [
    ['Import Hevy — 27/07/2026', 'Import Hevy — 27/07/2026 (2)'],
    'Import Hevy — 27/07/2026 (3)',
  ],
])('chooses the first available folder name', (names, expected) => {
  expect(nextHevyImportFolderName(importedAt, names)).toBe(expected);
});
```

Use `new Date(2026, 6, 27, 12).getTime()` for `importedAt` so local date formatting is stable.

- [ ] **Step 2: Run and verify failure**

Run:

```bash
npm run test:run -- src/data/repositories/hevyRoutineImport.test.ts
```

Expected: FAIL because the entity builder does not exist.

- [ ] **Step 3: Implement routine entity construction**

Use `newEntity` for every folder, routine, row and set. For each parsed set, copy only:

```ts
{
  routineExerciseId: row.id,
  order: parsedSet.order,
  setType: parsedSet.setType,
  ...(parsedSet.reps === undefined
    ? {}
    : { targetReps: parsedSet.reps }),
  ...(parsedSet.durationSeconds === undefined
    ? {}
    : { targetDurationSeconds: parsedSet.durationSeconds }),
  ...(parsedSet.distanceMeters === undefined
    ? {}
    : { targetDistanceMeters: parsedSet.distanceMeters }),
}
```

Resolve exercise IDs with `normalizeHevyExerciseTitle(sourceTitle)`. Throw
`Missing resolved Hevy routine exercise: ${sourceKey}` before returning entities if any source is
missing.

Format the folder date with `Intl.DateTimeFormat('fr-FR', {
day: '2-digit',
month: '2-digit',
year: 'numeric',
}).format(importedAt)`.

- [ ] **Step 4: Write failing repository transaction tests**

Extend `src/data/repositories/hevyImport.test.ts`:

```ts
it('creates one dated folder and representative routines atomically', async () => {
  const importedAt = new Date(2026, 6, 27, 12).getTime();
  const result = await importHevyWorkouts(
    multiRoutineData,
    multiRoutineResolutions,
    importedAt,
  );

  expect(result).toMatchObject({
    importedWorkouts: multiRoutineData.workoutCount,
    createdRoutines: 2,
    routineFolderName: 'Import Hevy — 27/07/2026',
  });
  expect(await db.routineFolders.count()).toBe(1);
  expect((await db.routines.toArray()).map((row) => row.name)).toEqual([
    'UPPER A',
    'LOWER A',
  ]);
});

it('creates no folder or routines when every workout is a duplicate', async () => {
  await importHevyWorkouts(data, resolutions(bench.id), importedAt);
  const before = {
    folders: await db.routineFolders.count(),
    routines: await db.routines.count(),
  };

  const result = await importHevyWorkouts(
    data,
    resolutions(bench.id),
    importedAt,
  );

  expect(result.createdRoutines).toBe(0);
  expect(result.routineFolderName).toBeUndefined();
  expect(await db.routineFolders.count()).toBe(before.folders);
  expect(await db.routines.count()).toBe(before.routines);
});

it('rolls back routines and workouts together', async () => {
  const fail = vi
    .spyOn(db.routineSets, 'bulkAdd')
    .mockRejectedValueOnce(new Error('disk full'));

  try {
    await expect(
      importHevyWorkouts(data, resolutions(bench.id), importedAt),
    ).rejects.toThrow('disk full');
  } finally {
    fail.mockRestore();
  }

  expect(await db.workouts.count()).toBe(0);
  expect(await db.routineFolders.count()).toBe(0);
  expect(await db.routines.count()).toBe(0);
});
```

Define `multiRoutineData`, `multiRoutineResolutions`, `bench` and `importedAt` as complete fixtures.

- [ ] **Step 5: Extend the import transaction**

Inside `importHevyWorkouts`:

1. default `importedAt` to `Date.now()`;
2. add all four routine tables to the Dexie transaction;
3. return `createdRoutines: 0` with no folder name when `importable.length === 0`;
4. select routine sources from `importable`;
5. read alive folder names, alive folder count and alive routine count inside the transaction;
6. build routine entities with the first available dated name;
7. bulk-add folder, routines, routine rows and routine sets;
8. return the routine count and folder name.

The write order is exercises, workouts, workout rows, workout sets, folder, routines, routine
rows, routine sets, settings. Dexie guarantees rollback across the full list of tables.

Update every existing exact `HevyImportResult` assertion: successful imports now include
`createdRoutines` and `routineFolderName`; fully duplicated imports include `createdRoutines: 0`
and omit `routineFolderName`. Extend the local `counts()` test helper with all four routine-table
counts so the existing no-write and rollback assertions also protect the new entities.

- [ ] **Step 6: Run repository tests**

Run:

```bash
npm run test:run -- src/data/repositories/hevyRoutineImport.test.ts src/data/repositories/hevyImport.test.ts
npm run typecheck
```

Expected: both commands PASS.

- [ ] **Step 7: Commit**

```bash
git add src/data/repositories/hevyRoutineImport.ts src/data/repositories/hevyRoutineImport.test.ts src/data/repositories/hevyImport.ts src/data/repositories/hevyImport.test.ts
git commit -m "feat(lot-07): crée les routines pendant l'import Hevy"
```

---

### Task 5: Preview and report imported routines

**Files:**
- Modify: `src/data/repositories/hevyImport.ts`
- Modify: `src/data/repositories/hevyImport.test.ts`
- Modify: `src/features/history/hevyImportDraft.ts`
- Modify: `src/features/history/hevyImportDraft.test.ts`
- Modify: `src/features/history/HevyImportScreen.tsx`
- Modify: `src/features/history/HevyImportReview.tsx`
- Modify: `src/i18n/fr.ts`

**Interfaces:**
- Consumes: selected routine sources, `draft.importedAt`, and the extended repository result.
- Produces:

```ts
export interface HevyImportDraft {
  importableWorkouts: number;
  skippedWorkouts: number;
  importedAt: number;
  routineFolderName?: string;
  routineNames: string[];
  rows: HevyMappingDraftRow[];
}

export interface HevyImportPreparation {
  exercises: Exercise[];
  existingImportKeys: string[];
  savedMappings: HevyExerciseMappings;
  aliveRoutineFolderNames: string[];
}

export function createHevyImportDraft(
  data: HevyImportData,
  preparation: HevyImportPreparation,
  importedAt?: number,
): HevyImportDraft;
```

- [ ] **Step 1: Write failing preview tests**

Add to `src/features/history/hevyImportDraft.test.ts`:

```ts
it('previews one representative routine per importable title', () => {
  const draft = createHevyImportDraft(multiRoutineData, preparation, 123);
  expect(draft.importedAt).toBe(123);
  expect(draft.routineFolderName).toBe(
    hevyImportFolderBaseName(123),
  );
  expect(draft.routineNames).toEqual(['UPPER A', 'LOWER A']);
});

it('previews the same collision suffix used by persistence', () => {
  const importedAt = new Date(2026, 6, 27, 12).getTime();
  const draft = createHevyImportDraft(
    multiRoutineData,
    {
      ...preparation,
      aliveRoutineFolderNames: ['Import Hevy — 27/07/2026'],
    },
    importedAt,
  );
  expect(draft.routineFolderName).toBe(
    'Import Hevy — 27/07/2026 (2)',
  );
});

it('previews no routines when all workouts are duplicates', () => {
  const draft = createHevyImportDraft(data, {
    ...preparation,
    existingImportKeys: data.workouts.map((workout) => workout.importKey),
  });
  expect(draft.routineNames).toEqual([]);
  expect(draft.routineFolderName).toBeUndefined();
});
```

- [ ] **Step 2: Run and verify failure**

Run:

```bash
npm run test:run -- src/features/history/hevyImportDraft.test.ts
```

Expected: FAIL because routine preview fields do not exist.

- [ ] **Step 3: Add preview data and pass one timestamp to the repository**

Extend `prepareHevyImport` to read alive routine-folder names with
`db.routineFolders.where('deletedAt').equals(0).toArray()` and return them as
`aliveRoutineFolderNames`. Update its repository test to assert this field.

Default `importedAt` once in `createHevyImportDraft`, calculate `routineNames` from the same
`importable` array already used to filter mapping rows, and calculate `routineFolderName` with
`nextHevyImportFolderName`. Leave both routine fields empty when no workout is importable.

Change the final call in `HevyImportScreen` to:

```ts
const result = await importHevyWorkouts(
  ready.data,
  resolutionsFromHevyDraft(ready.draft),
  ready.draft.importedAt,
);
```

This keeps the reviewed date equal to the persisted folder date.

- [ ] **Step 4: Add review and success copy**

Add i18n keys:

```ts
importRoutineFolder:
  'Le dossier « {folder} » sera créé avec : {names}.',
importRoutineCount:
  '{count} routines créées dans « {folder} ».',
importRoutineCountOne:
  '1 routine créée dans « {folder} ».',
```

In `HevyImportReview`, render `importRoutineFolder` only when `draft.routineNames.length > 0` and
`draft.routineFolderName` exists, passing the folder name and joining routine names with `, `.

On the completed screen, render the routine count only when `createdRoutines > 0` and
`routineFolderName` exists. Preserve the existing workout success text.

- [ ] **Step 5: Run focused tests, typecheck and build**

Run:

```bash
npm run test:run -- src/features/history/hevyImportDraft.test.ts
npm run typecheck
npm run build
```

Expected: all commands PASS; build may retain only the historical Vite chunk-size warning.

- [ ] **Step 6: Commit**

```bash
git add src/data/repositories/hevyImport.ts src/data/repositories/hevyImport.test.ts src/features/history/hevyImportDraft.ts src/features/history/hevyImportDraft.test.ts src/features/history/HevyImportScreen.tsx src/features/history/HevyImportReview.tsx src/i18n/fr.ts
git commit -m "feat(lot-07): prévisualise les routines Hevy importées"
```

---

### Task 6: Full verification, progress memory and phone checkpoint

**Files:**
- Modify: `PROGRESS.md`
- Modify if coverage requires it: `src/lib/hevyExerciseMatch.test.ts`
- Modify if coverage requires it: `src/data/repositories/hevyImport.test.ts`

**Interfaces:**
- Consumes: the completed matching, selection, repository and UI work.
- Produces: verified Lot 07C follow-up and an exact manual checkpoint.

- [ ] **Step 1: Run the full quality gates**

Run:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Expected: all four commands PASS; only the existing Vite chunk-size warning may remain.

- [ ] **Step 2: Verify the real export without importing personal values into fixtures**

In the app at `375 × 812`:

1. choose `C:\Users\e6\Downloads\workout_data.csv`;
2. verify safe checks for known titles such as `Dead Hang`, `Extension Jambes`,
   `Planche Latérale` and `Tirage vers Visage`;
3. verify unknown variants remain manually confirmable;
4. confirm the review lists `LOWER A`, `LOWER B`, `UPPER A`, `UPPER B`;
5. import and verify the dated folder contains four routines;
6. inspect one routine for exercise order, set count, no supersets and no target weights;
7. reimport the same file and verify no second folder is created;
8. reload offline and verify workouts and routines remain present.

- [ ] **Step 3: Update project memory**

At the top of `PROGRESS.md`, record:

- improved canonical and fallback Hevy matching;
- count of safe auto-resolutions on the 24-title validation export;
- representative routine rule: five latest, maximum distinct exercises, newest tie-break;
- dated folder behavior and duplicate behavior;
- no reconstructed supersets, target weights or target RPE;
- final test count and four gate results;
- the remaining real-phone checkpoint if it has not yet been performed.

- [ ] **Step 4: Re-run documentation-sensitive checks**

Run:

```bash
git diff --check
npm run typecheck
npm run test:run
npm run build
```

Expected: all commands PASS with no whitespace errors and only the historical Vite warning.

- [ ] **Step 5: Commit**

```bash
git add PROGRESS.md src/lib/hevyExerciseMatch.test.ts src/data/repositories/hevyImport.test.ts
git commit -m "test(lot-07): valide les routines importées depuis Hevy"
```

Only stage the two test files if Step 1 or Step 2 required coverage additions.
