# Lot 07C — Import CSV Hevy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importer hors ligne un `workout_data.csv` Hevy après validation, aperçu, association explicite des exercices, déduplication et écriture atomique.

**Architecture:** Un parseur pur, découpé entre lecture RFC 4180, conversion métier et rapprochement des noms, produit un graphe d’import indépendant de React et Dexie. Un repository prépare les doublons puis transforme ce graphe en entités FitTrack dans une transaction couvrant exercices personnalisés, séances, blocs, séries et associations mémorisées. Un assistant plein écran garde le fichier et les choix en mémoire locale jusqu’à la validation finale.

**Tech Stack:** React 19, TypeScript strict, Dexie 4, `dexie-react-hooks`, Tailwind CSS v4, Vitest, `fake-indexeddb`, APIs navigateur `File` et `<input type="file">`.

## Global Constraints

- Toute la fonctionnalité marche hors ligne, sans compte, backend ni réseau.
- Seul `workout_data.csv` est accepté ; `measurement_data.csv` reste hors périmètre.
- Le parseur valide les 14 colonnes avant toute écriture et respecte les guillemets, virgules, `""` et retours à la ligne RFC 4180.
- Les dates Hevy sans fuseau sont interprétées dans le fuseau local puis stockées en epoch millisecondes.
- Les nombres acceptent le point ou la virgule décimale ; les kilogrammes restent en kilogrammes et les kilomètres deviennent des mètres à la frontière d’import.
- Un type de série, une date, une cellule numérique ou une combinaison de mesures invalide produit une erreur portant le numéro de ligne.
- Une association sauvegardée est réutilisée seulement si l’exercice cible existe encore ; une simple suggestion ne vaut jamais confirmation.
- Aucun exercice personnalisé, réglage ou workout n’est écrit avant l’action finale.
- La validation finale utilise une transaction Dexie unique ; tout échec laisse la base dans son état antérieur.
- Une réimportation ignore les workouts dont `importKey` existe déjà et annonce séparément importés et ignorés.
- Tous les textes d’interface vivent dans `src/i18n/fr.ts`.
- Aucun composant n’importe `db` directement.
- Les cibles tactiles font au moins 48 px et le parcours reste utilisable en 375 × 812 px.
- Aucun quota n’est posé sur les lignes, séances, exercices ou séries importés.
- Préserver la modification de formatage déjà présente dans `src/data/repositories/history.ts` ; 07C n’a pas besoin de modifier ce fichier.

---

### Task 1: Lecteur RFC 4180 et parseur métier Hevy

**Files:**
- Create: `src/lib/hevyCsvRows.ts`
- Create: `src/lib/hevyCsv.ts`
- Create: `src/lib/hevyCsv.test.ts`

**Interfaces:**
- Consumes: texte UTF-8 lu par `File.text()`.
- Produces:

```ts
export type HevyCsvIssueCode =
  | 'empty_file'
  | 'malformed_csv'
  | 'missing_header'
  | 'unexpected_header'
  | 'required_value'
  | 'invalid_date'
  | 'invalid_number'
  | 'invalid_set_type'
  | 'invalid_measurement'
  | 'invalid_workout_range'
  | 'duplicate_set_index';

export interface HevyCsvIssue {
  line: number;
  code: HevyCsvIssueCode;
  field?: string;
  value?: string;
}

export interface HevyParsedSet {
  sourceLine: number;
  order: number;
  setType: SetType;
  weight?: number;
  reps?: number;
  distanceMeters?: number;
  durationSeconds?: number;
  rpe?: number;
}

export interface HevyParsedExercise {
  sourceTitle: string;
  order: number;
  sourceSupersetId?: string;
  supersetGroup: number;
  notes?: string;
  sets: HevyParsedSet[];
}

export interface HevyParsedWorkout {
  title: string;
  startedAt: number;
  endedAt: number;
  durationSeconds: number;
  notes?: string;
  importKey: string;
  exercises: HevyParsedExercise[];
}

export interface HevySourceExercise {
  sourceTitle: string;
  measurementType: MeasurementType;
  equipment: Equipment;
}

export interface HevyImportData {
  workouts: HevyParsedWorkout[];
  sourceExercises: HevySourceExercise[];
  workoutCount: number;
  exerciseCount: number;
  setCount: number;
}

export type HevyCsvResult =
  | { ok: true; data: HevyImportData }
  | { ok: false; issues: HevyCsvIssue[] };

export function parseHevyCsv(text: string): HevyCsvResult;
export function makeHevyImportKey(
  title: string,
  startedAt: number,
  endedAt: number,
): string;
```

- [ ] **Step 1: Écrire les tests rouges du lecteur et de la validation d’en-tête**

```ts
import { describe, expect, it } from 'vitest';
import { parseHevyCsv } from './hevyCsv';

const HEADER =
  'title,start_time,end_time,description,exercise_title,superset_id,' +
  'exercise_notes,set_index,set_type,weight_kg,reps,distance_km,' +
  'duration_seconds,rpe';

const row = (overrides: Partial<Record<string, string>> = {}) => {
  const value = {
    title: 'Séance A',
    start_time: '24 juil. 2026, 15:05',
    end_time: '24 juil. 2026, 16:05',
    description: '',
    exercise_title: 'Développé couché (barre)',
    superset_id: '',
    exercise_notes: '',
    set_index: '0',
    set_type: 'normal',
    weight_kg: '80',
    reps: '8',
    distance_km: '',
    duration_seconds: '',
    rpe: '',
    ...overrides,
  };
  return [
    value.title,
    value.start_time,
    value.end_time,
    value.description,
    value.exercise_title,
    value.superset_id,
    value.exercise_notes,
    value.set_index,
    value.set_type,
    value.weight_kg,
    value.reps,
    value.distance_km,
    value.duration_seconds,
    value.rpe,
  ].map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',');
};

it('préserve virgules, guillemets et retour à la ligne dans les notes', () => {
  const csv = `${HEADER}\r\n${row({
    description: 'Lourd, mais propre',
    exercise_notes: 'Banc "4"\nPrise moyenne',
  })}`;
  const result = parseHevyCsv(csv);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.data.workouts[0].notes).toBe('Lourd, mais propre');
  expect(result.data.workouts[0].exercises[0].notes).toBe('Banc "4"\nPrise moyenne');
});

it('refuse une colonne obligatoire absente avant de lire les lignes', () => {
  const result = parseHevyCsv(HEADER.replace(',rpe', ''));
  expect(result).toEqual({
    ok: false,
    issues: [{ line: 1, code: 'missing_header', field: 'rpe' }],
  });
});

it('refuse une colonne inconnue pour ne pas interpréter le mauvais export', () => {
  const result = parseHevyCsv(`${HEADER},body_weight`);
  expect(result).toEqual({
    ok: false,
    issues: [{ line: 1, code: 'unexpected_header', field: 'body_weight' }],
  });
});

it('retourne la ligne physique où un champ entre guillemets reste ouvert', () => {
  const result = parseHevyCsv(`${HEADER}\n"séance`);
  expect(result).toEqual({
    ok: false,
    issues: [{ line: 2, code: 'malformed_csv' }],
  });
});
```

- [ ] **Step 2: Lancer les tests et vérifier l’échec attendu**

Run: `npm run test:run -- src/lib/hevyCsv.test.ts`

Expected: FAIL car `src/lib/hevyCsv.ts` n’existe pas.

- [ ] **Step 3: Implémenter le lecteur de cellules sans dépendance**

Dans `hevyCsvRows.ts`, implémenter un automate caractère par caractère avec les états
`quoted`, `afterQuote`, `cell`, `row` et `physicalLine`. Un `""` dans un champ cité ajoute un seul
guillemet ; `\r\n`, `\n` et `\r` hors guillemets terminent une ligne ; les mêmes caractères dans
un champ cité sont conservés et incrémentent `physicalLine`. Retirer un éventuel BOM uniquement
du premier en-tête.

```ts
export interface CsvRow {
  line: number;
  cells: string[];
}

export type CsvRowsResult =
  | { ok: true; rows: CsvRow[] }
  | { ok: false; line: number };

export function readCsvRows(text: string): CsvRowsResult;
```

Le lecteur refuse un guillemet au milieu d’un champ non cité et tout caractère autre qu’un
séparateur ou une fin de ligne après la fermeture d’un champ cité.

- [ ] **Step 4: Écrire les tests rouges des conversions et du regroupement**

```ts
it('accepte point et virgule décimale puis convertit les kilomètres', () => {
  const csv = [
    HEADER,
    row({
      exercise_title: 'Rameur',
      weight_kg: '',
      reps: '',
      distance_km: '1,25',
      duration_seconds: '300',
      rpe: '7,5',
    }),
  ].join('\n');
  const result = parseHevyCsv(csv);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.data.workouts[0].exercises[0].sets[0]).toMatchObject({
    distanceMeters: 1250,
    durationSeconds: 300,
    rpe: 7.5,
  });
});

it.each([
  ['normal', 'normal'],
  ['warmup', 'warmup'],
  ['dropset', 'dropset'],
  ['drop', 'dropset'],
  ['failure', 'failure'],
] as const)('traduit le type Hevy %s en %s', (source, expected) => {
  const result = parseHevyCsv(`${HEADER}\n${row({ set_type: source })}`);
  expect(result.ok && result.data.workouts[0].exercises[0].sets[0].setType).toBe(expected);
});

it('refuse un type inconnu avec sa ligne', () => {
  const result = parseHevyCsv(`${HEADER}\n${row({ set_type: 'myo' })}`);
  expect(result).toEqual({
    ok: false,
    issues: [{ line: 2, code: 'invalid_set_type', field: 'set_type', value: 'myo' }],
  });
});

it('regroupe par titre et horaires, puis garde le premier ordre des exercices', () => {
  const csv = [
    HEADER,
    row({ exercise_title: 'Curl', set_index: '1', weight_kg: '12' }),
    row({ exercise_title: 'Squat', set_index: '0', weight_kg: '100' }),
    row({ exercise_title: 'Curl', set_index: '0', weight_kg: '10' }),
  ].join('\n');
  const result = parseHevyCsv(csv);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.data.workouts).toHaveLength(1);
  expect(result.data.workouts[0].exercises.map((exercise) => exercise.sourceTitle)).toEqual([
    'Curl',
    'Squat',
  ]);
  expect(result.data.workouts[0].exercises[0].sets.map((set) => set.weight)).toEqual([10, 12]);
});

it('remappe les supersets distincts en groupes consécutifs par séance', () => {
  const csv = [
    HEADER,
    row({ exercise_title: 'Curl', superset_id: '42' }),
    row({ exercise_title: 'Extension', superset_id: '42' }),
    row({ exercise_title: 'Rowing', superset_id: '99' }),
  ].join('\n');
  const result = parseHevyCsv(csv);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.data.workouts[0].exercises.map((exercise) => exercise.supersetGroup)).toEqual([
    1,
    1,
    2,
  ]);
});

it('génère une clé stable à partir du titre et des deux horaires', () => {
  const first = parseHevyCsv(`${HEADER}\n${row()}`);
  const second = parseHevyCsv(`${HEADER}\n${row()}`);
  expect(first.ok && second.ok && first.data.workouts[0].importKey)
    .toBe(second.ok && second.data.workouts[0].importKey);
});
```

```ts
it.each([
  ['', { line: 1, code: 'empty_file' }],
  [`${HEADER}\n${row({ title: '' })}`, {
    line: 2, code: 'required_value', field: 'title', value: '',
  }],
  [`${HEADER}\n${row({ exercise_title: '' })}`, {
    line: 2, code: 'required_value', field: 'exercise_title', value: '',
  }],
  [`${HEADER}\n${row({ start_time: '31 févr. 2026, 10:00' })}`, {
    line: 2, code: 'invalid_date', field: 'start_time', value: '31 févr. 2026, 10:00',
  }],
  [`${HEADER}\n${row({ end_time: '24 juil. 2026, 14:05' })}`, {
    line: 2, code: 'invalid_workout_range', field: 'end_time',
    value: '24 juil. 2026, 14:05',
  }],
  [`${HEADER}\n${row({ set_index: '-1' })}`, {
    line: 2, code: 'invalid_number', field: 'set_index', value: '-1',
  }],
  [`${HEADER}\n${row({ reps: '8,5' })}`, {
    line: 2, code: 'invalid_number', field: 'reps', value: '8,5',
  }],
  [`${HEADER}\n${row({ rpe: '5,5' })}`, {
    line: 2, code: 'invalid_number', field: 'rpe', value: '5,5',
  }],
  [`${HEADER}\n${row({ rpe: '7,2' })}`, {
    line: 2, code: 'invalid_number', field: 'rpe', value: '7,2',
  }],
  [`${HEADER}\n${row({
    weight_kg: '', reps: '', distance_km: '1', duration_seconds: '',
  })}`, {
    line: 2, code: 'invalid_measurement', field: 'distance_km', value: '1',
  }],
] as const)('refuse une cellule invalide avec sa ligne', (csv, issue) => {
  expect(parseHevyCsv(csv)).toEqual({ ok: false, issues: [issue] });
});

it('refuse deux fois le même set_index dans un exercice', () => {
  const result = parseHevyCsv([HEADER, row(), row()].join('\n'));
  expect(result).toEqual({
    ok: false,
    issues: [{ line: 3, code: 'duplicate_set_index', field: 'set_index', value: '0' }],
  });
});
```

- [ ] **Step 5: Implémenter la conversion métier minimale**

Le parseur :

1. compare exactement l’en-tête à la liste des 14 colonnes ;
2. construit un objet par ligne sans accéder aux colonnes par position ailleurs ;
3. convertit les mois `janv.`, `févr.`, `mars`, `avr.`, `mai`, `juin`, `juil.`, `août`,
   `sept.`, `oct.`, `nov.`, `déc.` avec `new Date(year, month, day, hour, minute)` ;
4. rejette une date normalisée par JavaScript vers un autre jour ;
5. accumule toutes les erreurs de lignes avant de retourner `{ ok: false }` ;
6. groupe par `title + startedAt + endedAt`, puis par premier `exercise_title` ;
7. trie les séries par `set_index` ;
8. calcule `durationSeconds = Math.floor((endedAt - startedAt) / 1000)` ;
9. construit `importKey` sous la forme
   `hevy_csv:${startedAt}:${endedAt}:${normalizeKey(title)}`.

- [ ] **Step 6: Vérifier et commit**

Run: `npm run test:run -- src/lib/hevyCsv.test.ts`

Expected: PASS.

```bash
git add src/lib/hevyCsvRows.ts src/lib/hevyCsv.ts src/lib/hevyCsv.test.ts
git commit -m "feat(lot-07): parse les exports CSV Hevy"
```

### Task 2: Inférence et suggestions d’association

**Files:**
- Create: `src/lib/hevyExerciseMatch.ts`
- Create: `src/lib/hevyExerciseMatch.test.ts`
- Modify: `src/lib/hevyCsv.ts`
- Modify: `src/lib/hevyCsv.test.ts`

**Interfaces:**
- Consumes: titres Hevy, séries parsées et catalogue `Exercise[]`.
- Produces:

```ts
export function normalizeHevyExerciseTitle(title: string): string;
export function inferHevyMeasurementType(
  sets: readonly HevyParsedSet[],
): MeasurementType | undefined;
export function inferHevyEquipment(title: string): Equipment;
export function rankHevyExerciseCandidates(
  sourceTitle: string,
  exercises: readonly Exercise[],
): Exercise[];
```

- [ ] **Step 1: Écrire les tests rouges des cinq mesures**

```ts
it.each([
  [{ weight: 20, reps: 8 }, 'weight_reps'],
  [{ reps: 12 }, 'reps_only'],
  [{ durationSeconds: 60 }, 'time_only'],
  [{ distanceMeters: 1000, durationSeconds: 300 }, 'distance_time'],
  [{ weight: 20, durationSeconds: 60 }, 'weight_time'],
] as const)('infère la forme de mesure %j', (set, expected) => {
  expect(inferHevyMeasurementType([{ ...BASE_SET, ...set }])).toBe(expected);
});

it('refuse des formes incompatibles pour le même nom source', () => {
  expect(inferHevyMeasurementType([
    { ...BASE_SET, weight: 20, reps: 8 },
    { ...BASE_SET, durationSeconds: 60 },
  ])).toBeUndefined();
});
```

`BASE_SET` est un `HevyParsedSet` complet avec `sourceLine: 2`, `order: 0`,
`setType: 'normal'`.

- [ ] **Step 2: Vérifier l’échec**

Run: `npm run test:run -- src/lib/hevyExerciseMatch.test.ts`

Expected: FAIL car le module n’existe pas.

- [ ] **Step 3: Écrire les tests rouges de normalisation, matériel et classement**

```ts
it('neutralise accents, pluriel, casse et mentions de matériel', () => {
  expect(normalizeHevyExerciseTitle('Développés couchés (Haltères)'))
    .toBe('developpe couche');
});

it.each([
  ['Squat (barre)', 'barbell'],
  ['Curl avec haltères', 'dumbbell'],
  ['Développé machine Smith', 'smith'],
  ['Tirage à la poulie', 'cable'],
  ['Swing kettlebell', 'kettlebell'],
  ['Pompes au poids du corps', 'bodyweight'],
  ['Extension de jambes', 'other'],
] as const)('infère le matériel de %s', (title, expected) => {
  expect(inferHevyEquipment(title)).toBe(expected);
});

it('classe le mouvement normalisé avant un candidat qui partage un seul mot', () => {
  const exercises = [
    exercise('Développé couché à la barre', 'barbell'),
    exercise('Développé militaire à la barre', 'barbell'),
    exercise('Écarté couché avec haltères', 'dumbbell'),
  ];
  expect(rankHevyExerciseCandidates('Développés couchés (barre)', exercises)[0].name)
    .toBe('Développé couché à la barre');
});
```

Le helper `exercise(name, equipment)` crée un objet `Exercise` complet avec des timestamps fixes,
`measurementType: 'weight_reps'`, `primaryMuscle: 'other'`, tableaux vides et flags à `0`.

- [ ] **Step 4: Implémenter un classement déterministe**

La normalisation applique NFD, retire les marques combinantes, remplace la ponctuation par des
espaces, singularise seulement les tokens français de plus de trois lettres terminés par `s` ou
`x`, puis retire les tokens de matériel reconnus. Le score est :

```ts
score = exactNormalizedMatch * 1000
  + diceCoefficient(sourceTokens, candidateTokens) * 100
  + matchingEquipment * 10
  - Math.abs(sourceTokens.size - candidateTokens.size);
```

Les égalités sont départagées par `name.localeCompare(..., 'fr')`. Retourner tout le catalogue
trié : la feuille pourra afficher la meilleure proposition puis rester recherchable sans réseau.

- [ ] **Step 5: Faire produire les 24 sources distinctes par le parseur**

Après le regroupement des workouts, réunir toutes les séries par `sourceTitle`. Pour chaque source,
appeler les deux inférences et produire `HevySourceExercise`. Si la mesure est incohérente,
ajouter une issue `invalid_measurement` sur la première ligne de cette source et ne produire aucune
donnée importable.

- [ ] **Step 6: Vérifier et commit**

Run: `npm run test:run -- src/lib/hevyCsv.test.ts src/lib/hevyExerciseMatch.test.ts`

Expected: PASS.

```bash
git add src/lib/hevyCsv.ts src/lib/hevyCsv.test.ts src/lib/hevyExerciseMatch.ts src/lib/hevyExerciseMatch.test.ts
git commit -m "feat(lot-07): suggère les associations Hevy"
```

### Task 3: Métadonnées de provenance et associations mémorisées

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/data/repositories/settings.ts`
- Modify: `src/data/repositories/settings.test.ts`

**Interfaces:**
- Consumes: clé canonique `normalizeHevyExerciseTitle(sourceTitle)`.
- Produces:

```ts
export interface Workout extends Syncable {
  // champs existants…
  importSource?: 'hevy_csv';
  importKey?: string;
}

export type HevyExerciseMappings = Record<string, string>;

export function getHevyExerciseMappings(): Promise<HevyExerciseMappings>;
export function setHevyExerciseMappings(
  mappings: Readonly<HevyExerciseMappings>,
): Promise<HevyExerciseMappings>;
```

- [ ] **Step 1: Écrire les tests rouges du réglage**

```ts
it('rend un objet vide avant le premier import Hevy', async () => {
  expect(await getHevyExerciseMappings()).toEqual({});
});

it('normalise les clés et conserve les identifiants choisis', async () => {
  await setHevyExerciseMappings({
    'Développés couchés (barre)': 'bench-id',
  });
  expect(await getHevyExerciseMappings()).toEqual({
    'developpe couche': 'bench-id',
  });
});

it('écarte les entrées corrompues sans perdre les entrées valides', async () => {
  await db.settings.put({
    key: 'hevyExerciseMappings',
    value: { squat: 'squat-id', bad: 12, empty: '' },
    updatedAt: 1,
  });
  expect(await getHevyExerciseMappings()).toEqual({ squat: 'squat-id' });
});
```

- [ ] **Step 2: Vérifier l’échec**

Run: `npm run test:run -- src/data/repositories/settings.test.ts`

Expected: FAIL car les exports n’existent pas.

- [ ] **Step 3: Ajouter les deux champs non indexés**

Ajouter `importSource?` et `importKey?` à `Workout`. Ne pas modifier `src/data/db.ts` : ces champs
ne sont pas indexés et Dexie persiste les propriétés supplémentaires sans migration.

- [ ] **Step 4: Implémenter la clé `hevyExerciseMappings`**

La lecture accepte seulement un objet simple, des clés non vides et des valeurs `string` non
vides. L’écriture normalise chaque clé avec `normalizeHevyExerciseTitle`, élimine les entrées
vides et pose `updatedAt: Date.now()`. Elle ne vérifie pas l’existence des exercices : le
repository d’import le fera dans la même lecture transactionnelle que l’import.

- [ ] **Step 5: Vérifier et commit**

Run: `npm run test:run -- src/data/repositories/settings.test.ts`

Expected: PASS.

```bash
git add src/data/types.ts src/data/repositories/settings.ts src/data/repositories/settings.test.ts
git commit -m "feat(lot-07): mémorise les associations Hevy"
```

### Task 4: Repository d’import atomique et idempotent

**Files:**
- Create: `src/data/repositories/hevyImport.ts`
- Create: `src/data/repositories/hevyImport.test.ts`

**Interfaces:**
- Consumes: `HevyImportData` et un choix explicite pour chaque source encore importable.
- Produces:

```ts
export type HevyExerciseResolution =
  | { kind: 'existing'; exerciseId: string }
  | {
      kind: 'custom';
      exercise: {
        name: string;
        primaryMuscle: 'other';
        secondaryMuscles: [];
        equipment: Equipment;
        measurementType: MeasurementType;
        isUnilateral: 0;
      };
    };

export type HevyExerciseResolutions = Record<string, HevyExerciseResolution>;

export interface HevyImportPreparation {
  exercises: Exercise[];
  existingImportKeys: string[];
  savedMappings: HevyExerciseMappings;
}

export interface HevyImportResult {
  importedWorkouts: number;
  skippedWorkouts: number;
  createdExercises: number;
  importedExercises: number;
  importedSets: number;
}

export function prepareHevyImport(
  data: HevyImportData,
): Promise<HevyImportPreparation>;

export function importHevyWorkouts(
  data: HevyImportData,
  resolutions: Readonly<HevyExerciseResolutions>,
): Promise<HevyImportResult>;
```

- [ ] **Step 1: Écrire un builder de test à partir du parseur réel**

Dans `hevyImport.test.ts`, construire le CSV via le même en-tête que Task 1 et deux workouts :
un bloc normal poids/répétitions, un superset, une série chronométrée et des notes. Parser le texte
avec `parseHevyCsv`, puis faire échouer le test si `ok` vaut `false`.

```ts
const HEADER =
  'title,start_time,end_time,description,exercise_title,superset_id,' +
  'exercise_notes,set_index,set_type,weight_kg,reps,distance_km,' +
  'duration_seconds,rpe';

function csvRow(overrides: Partial<Record<string, string>> = {}): string {
  const value = {
    title: 'Séance A',
    start_time: '24 juil. 2026, 15:05',
    end_time: '24 juil. 2026, 16:05',
    description: 'Note de séance',
    exercise_title: 'Développé couché (barre)',
    superset_id: '',
    exercise_notes: 'Note exercice',
    set_index: '0',
    set_type: 'normal',
    weight_kg: '80',
    reps: '8',
    distance_km: '',
    duration_seconds: '',
    rpe: '7,5',
    ...overrides,
  };
  return [
    value.title,
    value.start_time,
    value.end_time,
    value.description,
    value.exercise_title,
    value.superset_id,
    value.exercise_notes,
    value.set_index,
    value.set_type,
    value.weight_kg,
    value.reps,
    value.distance_km,
    value.duration_seconds,
    value.rpe,
  ].map((cell) => `"${cell.replaceAll('"', '""')}"`).join(',');
}

function parsed(csv: string): HevyImportData {
  const result = parseHevyCsv(csv);
  if (!result.ok) throw new Error(JSON.stringify(result.issues));
  return result.data;
}

const CSV = [
  HEADER,
  csvRow({ exercise_title: 'Développé couché (barre)', superset_id: '7' }),
  csvRow({
    exercise_title: 'Curl avec haltères',
    superset_id: '7',
    weight_kg: '12',
    reps: '10',
  }),
  csvRow({
    exercise_title: 'Planche',
    weight_kg: '',
    reps: '',
    duration_seconds: '60',
    rpe: '',
  }),
  csvRow({
    exercise_title: 'Rameur',
    weight_kg: '',
    reps: '',
    distance_km: '1',
    duration_seconds: '300',
    rpe: '',
  }),
  csvRow({
    title: 'Séance B',
    start_time: '26 juil. 2026, 10:00',
    end_time: '26 juil. 2026, 11:00',
  }),
].join('\n');

const data = parsed(CSV);

const assistedData = parsed([
  HEADER,
  csvRow({
    title: 'Séance assistée',
    exercise_title: 'Tractions assistées',
    weight_kg: '30',
    reps: '8',
  }),
].join('\n'));

function customExercise(name: string): NewExercise {
  return {
    name,
    primaryMuscle: 'other',
    secondaryMuscles: [],
    equipment: 'other',
    measurementType: 'weight_reps',
    isUnilateral: 0,
  };
}

function customResolutions(input: HevyImportData): HevyExerciseResolutions {
  return Object.fromEntries(input.sourceExercises.map((source) => [
    normalizeHevyExerciseTitle(source.sourceTitle),
    {
      kind: 'custom',
      exercise: {
        name: source.sourceTitle,
        primaryMuscle: 'other',
        secondaryMuscles: [],
        equipment: source.equipment,
        measurementType: source.measurementType,
        isUnilateral: 0,
      },
    },
  ]));
}

async function counts() {
  return {
    exercises: await db.exercises.count(),
    workouts: await db.workouts.count(),
    workoutExercises: await db.workoutExercises.count(),
    workoutSets: await db.workoutSets.count(),
    settings: await db.settings.count(),
  };
}
```

- [ ] **Step 2: Écrire les tests rouges de préparation et d’import**

```ts
it('prépare les exercices vivants, mappings et doublons existants', async () => {
  const bench = await createCustomExercise(customExercise('Développé couché'));
  const data = parsed(CSV);
  await setHevyExerciseMappings({ 'Développé couché (barre)': bench.id });
  await db.workouts.add(newEntity<Workout>({
    routineId: '',
    name: 'Déjà importée',
    status: 'completed',
    startedAt: 1,
    endedAt: 2,
    durationSeconds: 1,
    importSource: 'hevy_csv',
    importKey: data.workouts[0].importKey,
  }));

  const result = await prepareHevyImport(data);

  expect(result.exercises.map((exercise) => exercise.id)).toContain(bench.id);
  expect(result.existingImportKeys).toEqual([data.workouts[0].importKey]);
  expect(result.savedMappings).toEqual({ 'developpe couche': bench.id });
});

it('écrit séance, blocs et séries avec les identifiants cohérents', async () => {
  const bench = await createCustomExercise(customExercise('Développé couché'));
  const resolutions = customResolutions(data);
  resolutions['developpe couche'] = {
    kind: 'existing',
    exerciseId: bench.id,
  };
  const result = await importHevyWorkouts(data, {
    ...resolutions,
  });

  expect(result).toMatchObject({ importedWorkouts: 2, skippedWorkouts: 0 });
  const workouts = await db.workouts.toArray();
  const rows = await db.workoutExercises.toArray();
  const sets = await db.workoutSets.toArray();
  expect(workouts.every((workout) =>
    workout.status === 'completed' && workout.importSource === 'hevy_csv'
  )).toBe(true);
  expect(sets.every((set) => {
    const row = rows.find((candidate) => candidate.id === set.workoutExerciseId);
    return row?.workoutId === set.workoutId && row.exerciseId === set.exerciseId;
  })).toBe(true);
});
```

- [ ] **Step 3: Écrire les tests rouges des garanties fortes**

```ts
it('ignore une réimportation sans créer de lignes supplémentaires', async () => {
  const resolutions = customResolutions(data);
  await importHevyWorkouts(data, resolutions);
  const before = await counts();
  const second = await importHevyWorkouts(data, resolutions);
  expect(second).toMatchObject({
    importedWorkouts: 0,
    skippedWorkouts: data.workoutCount,
  });
  expect(await counts()).toEqual(before);
});

it('refuse une association absente avant toute écriture', async () => {
  await expect(importHevyWorkouts(data, {})).rejects.toThrow(
    'Missing Hevy exercise resolution',
  );
  expect(await counts()).toEqual({
    exercises: 0,
    workouts: 0,
    workoutExercises: 0,
    workoutSets: 0,
    settings: 0,
  });
});

it('annule aussi exercices et réglage si la dernière écriture échoue', async () => {
  const resolutions = customResolutions(data);
  vi.spyOn(db.workoutSets, 'bulkAdd').mockRejectedValueOnce(new Error('disk full'));
  await expect(importHevyWorkouts(data, resolutions)).rejects.toThrow('disk full');
  expect(await counts()).toEqual({
    exercises: 0,
    workouts: 0,
    workoutExercises: 0,
    workoutSets: 0,
    settings: 0,
  });
});
```

```ts
it('refuse une cible soft-deleted', async () => {
  const bench = await createCustomExercise(customExercise('Développé couché'));
  await db.exercises.update(bench.id, { deletedAt: Date.now() });
  await expect(importHevyWorkouts(data, {
    'developpe couche': { kind: 'existing', exerciseId: bench.id },
  })).rejects.toThrow('Hevy exercise target is unavailable');
  expect(await db.workouts.count()).toBe(0);
});

it('crée un exercice personnalisé une fois et conserve toutes les valeurs', async () => {
  const resolutions = customResolutions(data);
  await importHevyWorkouts(data, resolutions);
  const customRows = await db.exercises.where('isCustom').equals(1).toArray();
  expect(customRows.filter((exercise) => exercise.name === 'Planche')).toHaveLength(1);

  const workouts = await db.workouts.orderBy('startedAt').toArray();
  const rows = await db.workoutExercises.orderBy('[workoutId+order]').toArray();
  const sets = await db.workoutSets.toArray();
  expect(workouts[0].notes).toBe('Note de séance');
  expect(rows[0].notes).toBe('Note exercice');
  expect(rows[0].restSeconds).toBe(120);
  expect(rows.slice(0, 4).map((entry) => entry.supersetGroup)).toEqual([1, 1, 0, 0]);
  expect(sets[0]).toMatchObject({
    weight: 80,
    reps: 8,
    rpe: 7.5,
    isCompleted: 1,
    side: 'both',
    order: 0,
  });
  expect(sets.find((set) => set.distanceMeters !== undefined)).toMatchObject({
    distanceMeters: 1000,
    durationSeconds: 300,
  });
  const performed = sets
    .filter((set) => set.workoutId === workouts[0].id)
    .map((set) => set.performedAt)
    .sort((left, right) => left - right);
  expect(performed.every((value, index) =>
    value > workouts[0].startedAt &&
    value < workouts[0].endedAt &&
    (index === 0 || value > performed[index - 1])
  )).toBe(true);
});

it('conserve le type assisté de la cible existante et alimente les lectures dérivées', async () => {
  const assisted = await createCustomExercise({
    ...customExercise('Tractions assistées'),
    measurementType: 'assisted_weight_reps',
  });
  await importHevyWorkouts(assistedData, {
    'traction assistee': { kind: 'existing', exerciseId: assisted.id },
  });
  expect((await db.exercises.get(assisted.id))?.measurementType)
    .toBe('assisted_weight_reps');
  expect(await getLastPerformance(assisted.id)).toHaveLength(1);
  expect((await listRecordSets([assisted.id])).get(assisted.id)).toHaveLength(1);
  expect(await db.personalRecords.count()).toBe(0);
});
```

- [ ] **Step 4: Implémenter la préparation**

`prepareHevyImport` lit en parallèle les exercices vivants, le réglage et les workouts
`importSource === 'hevy_csv'` ayant une `importKey` demandée. Le champ n’étant pas indexé, partir
de `db.workouts.where('status').equals('completed')`, puis filtrer en mémoire.

- [ ] **Step 5: Implémenter la transaction finale**

La transaction porte sur :

```ts
db.exercises,
db.workouts,
db.workoutExercises,
db.workoutSets,
db.settings
```

À l’intérieur, relire les doublons, valider toutes les résolutions des workouts non doublons,
créer les exercices personnalisés avec `newEntity`, fusionner les mappings, puis préparer les
trois tableaux d’entités. Pour un workout de `N` séries, attribuer :

```ts
performedAt = startedAt + Math.floor(
  ((endedAt - startedAt) * (globalSetIndex + 1)) / (N + 1),
);
```

Le parseur a déjà refusé un intervalle incapable de contenir `N` timestamps distincts. Utiliser
`bulkAdd` pour chaque table et `db.settings.put` pour le mapping dans la même transaction.

- [ ] **Step 6: Vérifier et commit**

Run: `npm run test:run -- src/data/repositories/hevyImport.test.ts`

Expected: PASS.

```bash
git add src/data/repositories/hevyImport.ts src/data/repositories/hevyImport.test.ts
git commit -m "feat(lot-07): importe les séances Hevy atomiquement"
```

### Task 5: Brouillon pur de l’assistant d’association

**Files:**
- Create: `src/features/history/hevyImportDraft.ts`
- Create: `src/features/history/hevyImportDraft.test.ts`

**Interfaces:**
- Consumes: données parsées, préparation repository, candidats classés.
- Produces:

```ts
export interface HevyMappingDraftRow {
  source: HevySourceExercise;
  suggestion?: Exercise;
  resolution?: HevyExerciseResolution;
}

export interface HevyImportDraft {
  importableWorkouts: number;
  skippedWorkouts: number;
  rows: HevyMappingDraftRow[];
}

export function createHevyImportDraft(
  data: HevyImportData,
  preparation: HevyImportPreparation,
): HevyImportDraft;

export function setHevyImportResolution(
  draft: HevyImportDraft,
  sourceTitle: string,
  resolution: HevyExerciseResolution,
): HevyImportDraft;

export function unresolvedHevySources(draft: HevyImportDraft): HevySourceExercise[];
export function resolutionsFromHevyDraft(
  draft: HevyImportDraft,
): HevyExerciseResolutions;
```

- [ ] **Step 1: Écrire les tests rouges de reprise et de confirmation**

```ts
const source: HevySourceExercise = {
  sourceTitle: 'Développé couché (barre)',
  measurementType: 'weight_reps',
  equipment: 'barbell',
};

const data: HevyImportData = {
  workouts: [{
    title: 'Séance A',
    startedAt: 1000,
    endedAt: 5000,
    durationSeconds: 4,
    importKey: 'hevy_csv:1000:5000:seance a',
    exercises: [{
      sourceTitle: source.sourceTitle,
      order: 0,
      supersetGroup: 0,
      sets: [{
        sourceLine: 2,
        order: 0,
        setType: 'normal',
        weight: 80,
        reps: 8,
      }],
    }],
  }],
  sourceExercises: [source],
  workoutCount: 1,
  exerciseCount: 1,
  setCount: 1,
};

const bench: Exercise = {
  id: 'bench',
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 0,
  name: 'Développé couché à la barre',
  primaryMuscle: 'chest',
  secondaryMuscles: [],
  equipment: 'barbell',
  measurementType: 'weight_reps',
  isCustom: 0,
  isUnilateral: 0,
};

it('réutilise un mapping sauvegardé vers un exercice vivant', () => {
  const draft = createHevyImportDraft(data, {
    exercises: [bench],
    existingImportKeys: [],
    savedMappings: { 'developpe couche': bench.id },
  });
  expect(draft.rows[0].resolution).toEqual({
    kind: 'existing',
    exerciseId: bench.id,
  });
});

it('ignore un mapping sauvegardé dont la cible a disparu', () => {
  const draft = createHevyImportDraft(data, {
    exercises: [],
    existingImportKeys: [],
    savedMappings: { 'developpe couche': 'missing' },
  });
  expect(draft.rows[0].resolution).toBeUndefined();
});

it('garde la suggestion séparée de la résolution explicite', () => {
  const draft = createHevyImportDraft(data, {
    exercises: [bench],
    existingImportKeys: [],
    savedMappings: {},
  });
  expect(draft.rows[0].suggestion?.id).toBe(bench.id);
  expect(unresolvedHevySources(draft)).toHaveLength(1);
});

it('retire les sources qui appartiennent seulement à des doublons', () => {
  const draft = createHevyImportDraft(data, {
    exercises: [bench],
    existingImportKeys: [data.workouts[0].importKey],
    savedMappings: {},
  });
  expect(draft.rows.map((row) => row.source.sourceTitle)).not.toContain(
    data.workouts[0].exercises[0].sourceTitle,
  );
});
```

- [ ] **Step 2: Vérifier l’échec**

Run: `npm run test:run -- src/features/history/hevyImportDraft.test.ts`

Expected: FAIL car le module n’existe pas.

- [ ] **Step 3: Implémenter les transformations immuables**

`createHevyImportDraft` retire d’abord les workouts doublons, calcule l’ensemble exact de leurs
sources, puis applique un mapping sauvegardé valide. Pour les autres lignes, il appelle
`rankHevyExerciseCandidates` mais ne pose aucune résolution. `setHevyImportResolution` remplace
une seule ligne par clé normalisée. `resolutionsFromHevyDraft` lève une erreur si une ligne reste
sans résolution.

- [ ] **Step 4: Tester la création personnalisée préremplie**

```ts
it('crée un choix personnalisé sans inventer de muscle', () => {
  const source = draft.rows[0].source;
  const custom = customResolutionFor(source);
  expect(custom).toEqual({
    kind: 'custom',
    exercise: {
      name: source.sourceTitle,
      primaryMuscle: 'other',
      secondaryMuscles: [],
      equipment: source.equipment,
      measurementType: source.measurementType,
      isUnilateral: 0,
    },
  });
});
```

Exporter `customResolutionFor(source: HevySourceExercise): HevyExerciseResolution`.

- [ ] **Step 5: Vérifier et commit**

Run: `npm run test:run -- src/features/history/hevyImportDraft.test.ts`

Expected: PASS.

```bash
git add src/features/history/hevyImportDraft.ts src/features/history/hevyImportDraft.test.ts
git commit -m "feat(lot-07): prépare les choix de mapping Hevy"
```

### Task 6: Assistant d’import mobile

**Files:**
- Create: `src/features/history/HevyImportScreen.tsx`
- Create: `src/features/history/HevyImportFileStep.tsx`
- Create: `src/features/history/HevyImportMappingStep.tsx`
- Create: `src/features/history/HevyExerciseMappingSheet.tsx`
- Create: `src/features/history/HevyImportReview.tsx`
- Modify: `src/features/history/HistoryScreen.tsx`
- Modify: `src/router.tsx`
- Modify: `src/i18n/fr.ts`
- Modify: `src/ui/icons.tsx`

**Interfaces:**
- Consumes: `parseHevyCsv`, `prepareHevyImport`, brouillon pur et `importHevyWorkouts`.
- Produces: route hash `/history/import` et action d’en-tête sur `/history`.

- [ ] **Step 1: Ajouter les textes français complets**

Ajouter sous `history` des clés couvrant :

```ts
importAction: 'Importer depuis Hevy',
importTitle: 'Importer Hevy',
importChooseTitle: 'Choisir l’export',
importChooseBody: 'Sélectionne workout_data.csv. Le fichier reste sur cet appareil.',
importChooseFile: 'Choisir le CSV',
importWrongFile: 'Choisis le fichier workout_data.csv.',
importReadError: 'Le fichier n’a pas pu être lu.',
importErrorsTitle: 'Import impossible',
importErrorLine: 'Ligne {line}',
importDetectedTitle: 'Export détecté',
importWorkoutCount: '{count} séances',
importExerciseCount: '{count} exercices',
importSetCount: '{count} séries',
importContinue: 'Continuer',
importMappingTitle: 'Associer les exercices',
importMappingBody: 'Confirme chaque proposition ou choisis un autre exercice.',
importSuggested: 'Proposition',
importSaved: 'Association mémorisée',
importChooseExercise: 'Choisir un exercice FitTrack',
importUseSuggestion: 'Utiliser cette proposition',
importCreateCustom: 'Créer « {name} »',
importUnresolved: '{count} associations restantes',
importReviewTitle: 'Vérifier l’import',
importWillImport: '{count} séances seront importées.',
importWillSkip: '{count} séances déjà présentes seront ignorées.',
importSubmit: 'Importer',
importWorking: 'Import en cours…',
importSuccessTitle: 'Import terminé',
importSuccessBody: '{imported} séances importées, {skipped} ignorées.',
importBackToHistory: 'Voir l’historique',
importFailed: 'Aucune donnée n’a été écrite. Réessaie.',
importedNotice: 'Les séances Hevy importées sont maintenant dans ton historique.',
```

Déclarer une table exhaustive afin que le composant transforme chaque issue en phrase française
sans afficher une clé technique :

```ts
const hevyIssueKey: Record<HevyCsvIssueCode, TranslationKey> = {
  empty_file: 'history.importErrorEmptyFile',
  malformed_csv: 'history.importErrorMalformedCsv',
  missing_header: 'history.importErrorMissingHeader',
  unexpected_header: 'history.importErrorUnexpectedHeader',
  required_value: 'history.importErrorRequiredValue',
  invalid_date: 'history.importErrorInvalidDate',
  invalid_number: 'history.importErrorInvalidNumber',
  invalid_set_type: 'history.importErrorInvalidSetType',
  invalid_measurement: 'history.importErrorInvalidMeasurement',
  invalid_workout_range: 'history.importErrorWorkoutRange',
  duplicate_set_index: 'history.importErrorDuplicateSet',
};
```

Les onze clés françaises nomment `field` et `value` lorsqu’ils existent ; elles ne reprennent
jamais le code anglais à l’écran.

- [ ] **Step 2: Ajouter l’icône et la route**

Créer `ImportIcon` dans `src/ui/icons.tsx` avec un trait `currentColor`, `aria-hidden="true"` et le
même viewBox 24 × 24 que les autres icônes. Dans `HistoryScreen`, passer à `Screen.action` :

```tsx
<HeaderAction
  label={t('history.importAction')}
  onClick={() => void navigate('/history/import')}
>
  <ImportIcon />
</HeaderAction>
```

Ajouter la route statique avant `history/:workoutId` :

```tsx
{ path: 'history/import', element: <HevyImportScreen /> },
```

- [ ] **Step 3: Implémenter le choix de fichier et les erreurs**

`HevyImportFileStep` contient un vrai `<input type="file" accept=".csv,text/csv">` associé à une
cible visuelle de 56 px. Le handler refuse un nom différent de `workout_data.csv`, appelle
`await file.text()`, puis `parseHevyCsv`. Afficher toutes les issues dans une `Card`, chacune avec
son numéro de ligne. Aucun appel repository n’a lieu si le parseur retourne `ok: false`.

- [ ] **Step 4: Implémenter l’orchestrateur**

`HevyImportScreen` possède les états discriminés :

```ts
type ImportScreenState =
  | { step: 'file' }
  | { step: 'errors'; issues: HevyCsvIssue[] }
  | { step: 'preparing'; data: HevyImportData }
  | { step: 'mapping'; data: HevyImportData; draft: HevyImportDraft }
  | { step: 'review'; data: HevyImportData; draft: HevyImportDraft }
  | { step: 'importing'; data: HevyImportData; draft: HevyImportDraft }
  | { step: 'done'; result: HevyImportResult }
  | { step: 'failed'; data: HevyImportData; draft: HevyImportDraft };
```

Après parsing valide, appeler `prepareHevyImport`, puis `createHevyImportDraft`. Le bouton vers la
revue est désactivé tant que `unresolvedHevySources(draft).length > 0`. La flèche retour revient à
l’étape précédente tant qu’aucune écriture n’a eu lieu ; depuis `done`, elle retourne à
`/history`.

- [ ] **Step 5: Implémenter la feuille de mapping**

La liste affiche le nom Hevy, le choix actuel ou la meilleure suggestion. Un appui ouvre
`HevyExerciseMappingSheet` :

- champ de recherche utilisant `normalizeSearch` ;
- meilleure suggestion en première ligne avec action explicite ;
- catalogue complet filtré, sans quota ;
- action de création personnalisée utilisant `customResolutionFor(source)`.

Une suggestion reste visuellement marquée « Proposition » jusqu’à l’appui sur
« Utiliser cette proposition ». Une association sauvegardée est marquée « Association mémorisée »
et compte comme résolue. Chaque ligne et chaque action fait au moins 48 px.

- [ ] **Step 6: Implémenter revue, import et résultat**

`HevyImportReview` affiche les trois compteurs détectés, les séances réellement importables,
les doublons ignorés et le nombre d’exercices personnalisés à créer. L’`ActionBand` finale appelle :

```ts
await importHevyWorkouts(
  state.data,
  resolutionsFromHevyDraft(state.draft),
);
```

Désactiver l’action pendant `importing`. En cas de rejet, afficher `importFailed` et revenir à la
revue sans perdre les choix. Après succès, le bouton « Voir l’historique » navigue avec
`replace: true` et un state `{ historyNotice: 'imported' }`.

Étendre `HistoryNotice` et `readHistoryNotice` dans `HistoryScreen` avec `imported`, puis afficher
un message de succès dont les compteurs sont déjà visibles sur l’écran final ; le journal et le
calendrier se mettent à jour via leurs `useLiveQuery`.

- [ ] **Step 7: Vérifier le typage et le rendu**

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS avec seulement le warning Vite historique sur le chunk principal.

- [ ] **Step 8: Commit**

```bash
git add src/features/history/HevyImportScreen.tsx src/features/history/HevyImportFileStep.tsx src/features/history/HevyImportMappingStep.tsx src/features/history/HevyExerciseMappingSheet.tsx src/features/history/HevyImportReview.tsx src/features/history/HistoryScreen.tsx src/router.tsx src/i18n/fr.ts src/ui/icons.tsx
git commit -m "feat(lot-07): ajoute l'assistant d'import Hevy"
```

### Task 7: Fixture anonymisée, portes finales et mémoire de reprise

**Files:**
- Create: `src/test/fixtures/hevy-workout-data.csv`
- Modify: `src/lib/hevyCsv.test.ts`
- Modify: `src/data/repositories/hevyImport.test.ts`
- Modify: `PROGRESS.md`

**Interfaces:**
- Consumes: le format du fichier réel `C:\Users\e6\Downloads\workout_data.csv`.
- Produces: fixture non personnelle couvrant 4 séances, plusieurs exercices, notes multilignes,
  supersets et les cinq formes de mesure.

- [ ] **Step 1: Créer une fixture strictement anonymisée**

Ne copier aucun titre, note, charge, horaire ou nom d’exercice personnel. Construire quatre
séances fictives aux dates de janvier 2025 avec les noms `Séance Alpha` à `Séance Delta`. Inclure :

- une note citée avec virgule et retour à la ligne ;
- `normal`, `warmup`, `dropset` et `failure` ;
- un superset partagé par deux exercices ;
- point et virgule décimale ;
- poids + reps, reps seules, durée seule, distance + durée, poids + durée.

- [ ] **Step 2: Faire passer la fixture par le parseur et le repository**

```ts
import fixture from '@/test/fixtures/hevy-workout-data.csv?raw';

it('parse la fixture anonymisée complète', () => {
  const result = parseHevyCsv(fixture);
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.data).toMatchObject({
    workoutCount: 4,
  });
  expect(new Set(result.data.sourceExercises.map((source) => source.measurementType))).toEqual(
    new Set(['weight_reps', 'reps_only', 'time_only', 'distance_time', 'weight_time']),
  );
});
```

Dans le test repository, résoudre chaque source vers un exercice custom, importer la fixture et
vérifier les comptes exacts contre `data.workoutCount`, `data.exerciseCount` et `data.setCount`.

- [ ] **Step 3: Lancer les quatre portes**

Run: `npm run lint`

Expected: PASS.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run test:run`

Expected: PASS avec au moins les 401 tests existants plus les tests 07C.

Run: `npm run build`

Expected: PASS avec seulement le warning Vite historique sur le chunk principal.

- [ ] **Step 4: Vérifier le vrai fichier en 375 × 812 px**

Avec le serveur local et le navigateur :

1. ouvrir Historique puis l’action d’import ;
2. choisir `C:\Users\e6\Downloads\workout_data.csv` ;
3. constater 4 séances, 24 exercices et 90 séries ;
4. vérifier qu’aucune donnée n’apparaît dans le journal avant la validation finale ;
5. confirmer une suggestion, chercher un autre exercice et préparer un exercice personnalisé ;
6. vérifier les 24 associations, le récapitulatif puis importer ;
7. constater 4 séances importées et 0 ignorée ;
8. recharger, réimporter le même fichier et constater 0 importée, 4 ignorées ;
9. ouvrir une séance importée, contrôler notes, ordre, séries et totaux ;
10. vérifier l’absence de débordement horizontal, les cibles de 48 px et une console vide.

- [ ] **Step 5: Mettre à jour `PROGRESS.md`**

Consigner :

- jalon 07C implémenté ;
- nombre final de tests et résultat des quatre portes ;
- résultat du vrai import et de la réimportation ;
- avertissement Vite historique s’il reste seul ;
- checkpoint téléphone restant : choisir le CSV depuis Android, vérifier les associations, importer,
  recharger hors ligne, puis ouvrir et corriger une séance importée.

- [ ] **Step 6: Commit final**

```bash
git add src/test/fixtures/hevy-workout-data.csv src/lib/hevyCsv.test.ts src/data/repositories/hevyImport.test.ts PROGRESS.md
git commit -m "test(lot-07): valide l'import Hevy de bout en bout"
```

## Checkpoint téléphone

Depuis le téléphone réel :

1. ouvrir Historique → Importer depuis Hevy ;
2. choisir `workout_data.csv` dans le sélecteur Android ;
3. vérifier les compteurs et plusieurs associations proposées ;
4. terminer l’import, recharger en mode avion et retrouver les quatre séances ;
5. corriger une charge sur une séance importée, enregistrer et vérifier le total ;
6. relancer le même import et confirmer que les quatre séances sont ignorées sans doublon.
