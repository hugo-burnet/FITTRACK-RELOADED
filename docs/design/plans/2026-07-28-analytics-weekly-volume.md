# Weekly Training Volume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the final analytics screen, “Volume d’entraînement”, with weekly tonnage and complete workout duration behind one metric selector.

**Architecture:** Reuse the bounded `listExportSources` read and G2’s local-week primitives. A new pure `lib/analytics/volume.ts` owns aggregation; three focused React components own screen orchestration, card reading, and SVG drawing. The chart reuses `ChartSurface` and `barLayout`, adds no dependency, and keeps all French copy in `fr.ts`.

**Tech Stack:** React 19, TypeScript strict, Dexie/useLiveQuery, React Router hash mode, hand-written SVG, Vitest, Tailwind CSS v4.

## Global Constraints

- The feature must work fully offline and add no network dependency.
- Add no charting dependency and no new visual token.
- UI copy is French and lives only in `src/i18n/fr.ts`.
- Tonnage comes from `sessionTotals()` with its existing load-role and warm-up rules.
- Duration comes from `Workout.durationSeconds`, never from set durations.
- Weeks before the first recorded history are absent; zero weeks inside known history remain.
- The chart uses no accent colour: a high workload is not an achievement or an alert.
- Touch targets are at least 48 px; the chart is usable at 375 px in both themes.
- Data access stays behind `src/data/repositories/*`; components never import `db`.
- Shared types use no `any`; stored dates remain epoch milliseconds.

---

## File Map

**Create**

- `src/lib/analytics/volume.ts` — pure weekly aggregation and metric summaries.
- `src/lib/analytics/volume.test.ts` — TDD coverage for arithmetic, history bounds, timezone offsets, and zero weeks.
- `src/features/analytics/WeeklyVolumeChart.tsx` — SVG columns and pointer selection only.
- `src/features/analytics/WeeklyVolumeCard.tsx` — selected reading, scale, summary, and chart composition.
- `src/features/analytics/WeeklyVolumeScreen.tsx` — Dexie reads, filters, list, sheets, and empty state.

**Modify**

- `src/i18n/fr.ts` — all G4 labels, explanations, summaries, and empty-state copy.
- `src/i18n/labels.ts` — typed G4 metric labels and value formatting.
- `src/features/analytics/AnalyticsScreen.tsx` — one overview row linking to G4.
- `src/features/analytics/routes.tsx` — lazy G4 route component.
- `src/router.tsx` — `analytics/volume` hash route.
- `PROGRESS.md` — delivered behavior, decisions, verification evidence, and phone checkpoint.

---

### Task 1: Weekly volume aggregation

**Files:**

- Create: `src/lib/analytics/volume.test.ts`
- Create: `src/lib/analytics/volume.ts`

**Interfaces:**

- Consumes: `ExportSource`, `PeriodBounds`, `weekStartOf()`, `addLocalWeeks()`, `resolveExerciseIdentity()`, `measurementShape()`, and `sessionTotals()`.
- Produces:

```ts
export type WeeklyVolumeMetric = 'tonnage' | 'duration';

export interface WeeklyVolumeBucket {
  weekStart: number;
  tonnage: number;
  durationSeconds: number;
}

export function weeklyVolumeBuckets(
  sources: readonly ExportSource[],
  bounds: PeriodBounds,
  hasEarlierHistory?: boolean,
): WeeklyVolumeBucket[];

export function weeklyVolumeValues(
  buckets: readonly WeeklyVolumeBucket[],
  metric: WeeklyVolumeMetric,
): number[];

export function weeklyVolumeTotal(
  buckets: readonly WeeklyVolumeBucket[],
  metric: WeeklyVolumeMetric,
): number;

export function weeklyVolumeAverage(
  buckets: readonly WeeklyVolumeBucket[],
  metric: WeeklyVolumeMetric,
): number;
```

- [ ] **Step 1: Write fixture builders and failing aggregation tests**

Create complete `Workout`, `WorkoutExercise`, `Exercise`, and `WorkoutSet` builders following `muscles.test.ts`, then add these representative tests:

```ts
describe('weeklyVolumeBuckets', () => {
  const bounds = periodBounds('4w', now);

  it('additionne le tonnage et la durée de deux séances de la même semaine', () => {
    const first = source({
      startedAt: new Date(2026, 6, 21, 8).getTime(),
      durationSeconds: 3_600,
      sets: [set({ weight: 80, reps: 8 })],
    });
    const second = source({
      startedAt: new Date(2026, 6, 23, 18).getTime(),
      durationSeconds: 2_700,
      sets: [set({ weight: 60, reps: 10 })],
    });

    const buckets = weeklyVolumeBuckets([first, second], bounds, true);

    expect(buckets.map((bucket) => bucket.tonnage)).toEqual([0, 0, 1_240, 0]);
    expect(buckets.map((bucket) => bucket.durationSeconds)).toEqual([0, 0, 6_300, 0]);
  });

  it('reprend les règles de sessionTotals pour assistance, lest et échauffement', () => {
    const at = new Date(2026, 6, 21, 18).getTime();
    const sources = [
      source({ startedAt: at, measurementType: 'assisted_reps', sets: [set({ weight: 20, reps: 8 })] }),
      source({ startedAt: at, measurementType: 'weighted_reps', sets: [set({ weight: 10, reps: 8 })] }),
      source({
        startedAt: at,
        sets: [
          set({ setType: 'warmup', weight: 100, reps: 10 }),
          set({ weight: 50, reps: 5 }),
        ],
      }),
    ];

    expect(weeklyVolumeBuckets(sources, bounds, true)[2]!.tonnage).toBe(250);
  });

  it('prend la durée de la séance, jamais celle des séries', () => {
    const item = source({
      startedAt: new Date(2026, 6, 21, 18).getTime(),
      durationSeconds: 3_600,
      sets: [set({ durationSeconds: 45 })],
    });

    expect(weeklyVolumeBuckets([item], bounds, true)[2]!.durationSeconds).toBe(3_600);
  });

  it('ne commence pas avant la première séance mais garde les trous internes', () => {
    const early = source({ startedAt: new Date(2026, 6, 7, 18).getTime() });
    const late = source({ startedAt: new Date(2026, 6, 21, 18).getTime() });

    const buckets = weeklyVolumeBuckets([early, late], bounds);

    expect(buckets.map((bucket) => bucket.weekStart)).toEqual([
      week(2026, 6, 6),
      week(2026, 6, 13),
      week(2026, 6, 20),
      week(2026, 6, 27),
    ]);
    expect(buckets[1]).toMatchObject({ tonnage: 0, durationSeconds: 0 });
  });

  it('garde le dimanche soir dans la semaine de son offset historique', () => {
    const parisSunday = Date.UTC(2026, 6, 26, 21, 30);
    const buckets = weeklyVolumeBuckets(
      [source({ startedAt: parisSunday, timezoneOffsetMinutes: 120 })],
      bounds,
      true,
    );

    expect(buckets[2]!.tonnage).toBeGreaterThan(0);
    expect(buckets[3]!.tonnage).toBe(0);
  });

  it('part de la plus ancienne séance pour la période Tout', () => {
    const old = source({ startedAt: new Date(2026, 6, 8, 10).getTime() });
    const buckets = weeklyVolumeBuckets([old], periodBounds('all', now));

    expect(buckets[0]!.weekStart).toBe(week(2026, 6, 6));
    expect(buckets.at(-1)!.weekStart).toBe(week(2026, 6, 27));
  });
});

describe('weekly volume summaries', () => {
  const buckets: WeeklyVolumeBucket[] = [
    { weekStart: 1, tonnage: 1_000, durationSeconds: 3_600 },
    { weekStart: 2, tonnage: 0, durationSeconds: 0 },
    { weekStart: 3, tonnage: 2_000, durationSeconds: 7_200 },
  ];

  it('inclut les semaines à zéro dans la moyenne', () => {
    expect(weeklyVolumeTotal(buckets, 'tonnage')).toBe(3_000);
    expect(weeklyVolumeAverage(buckets, 'tonnage')).toBe(1_000);
    expect(weeklyVolumeAverage(buckets, 'duration')).toBe(3_600);
  });
});
```

The fixture’s `measurementType` must deliberately disagree between row snapshot and library in one additional assertion, proving the snapshot wins.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
npx vitest run src/lib/analytics/volume.test.ts
```

Expected: FAIL because `./volume` does not exist.

- [ ] **Step 3: Implement the pure aggregator**

Create `src/lib/analytics/volume.ts` with this structure:

```ts
import { addLocalWeeks, startOfLocalWeek } from '@/lib/history';
import { resolveExerciseIdentity } from '@/lib/exerciseSnapshot';
import type { ExportSource } from '@/lib/export/types';
import { measurementShape } from '@/lib/measurement';
import { sessionTotals } from '@/lib/volume';
import type { PeriodBounds } from './periods';
import { weekStartOf } from './weeks';

export type WeeklyVolumeMetric = 'tonnage' | 'duration';

export interface WeeklyVolumeBucket {
  weekStart: number;
  tonnage: number;
  durationSeconds: number;
}

function sourceTonnage(source: ExportSource): number {
  return sessionTotals(
    source.exercises.flatMap((entry) => {
      const { measurementType } = resolveExerciseIdentity(entry.row, entry.exercise);
      const weightRole =
        measurementType === undefined ? undefined : measurementShape(measurementType).weightRole;
      return entry.sets.map((set) => ({ set, weightRole }));
    }),
  ).tonnage;
}

export function weeklyVolumeBuckets(
  sources: readonly ExportSource[],
  bounds: PeriodBounds,
  hasEarlierHistory = false,
): WeeklyVolumeBucket[] {
  const totals = new Map<number, { tonnage: number; durationSeconds: number }>();

  for (const source of sources) {
    const { workout } = source;
    if (
      (bounds.from !== undefined && workout.startedAt < bounds.from) ||
      workout.startedAt >= bounds.to
    ) {
      continue;
    }

    const weekStart = weekStartOf(
      workout.startedAt,
      workout.startedTimezoneOffsetMinutes,
    );
    const current = totals.get(weekStart) ?? { tonnage: 0, durationSeconds: 0 };
    current.tonnage += sourceTonnage(source);
    current.durationSeconds += workout.durationSeconds;
    totals.set(weekStart, current);
  }

  const oldest = totals.size === 0 ? undefined : Math.min(...totals.keys());
  const first = bounds.from !== undefined && hasEarlierHistory ? bounds.from : oldest;
  if (first === undefined) return [];

  const buckets: WeeklyVolumeBucket[] = [];
  for (
    let weekStart = startOfLocalWeek(first);
    weekStart < bounds.to;
    weekStart = addLocalWeeks(weekStart, 1)
  ) {
    const value = totals.get(weekStart) ?? { tonnage: 0, durationSeconds: 0 };
    buckets.push({ weekStart, ...value });
  }
  return buckets;
}

export function weeklyVolumeValues(
  buckets: readonly WeeklyVolumeBucket[],
  metric: WeeklyVolumeMetric,
): number[] {
  return buckets.map((bucket) =>
    metric === 'tonnage' ? bucket.tonnage : bucket.durationSeconds,
  );
}

export function weeklyVolumeTotal(
  buckets: readonly WeeklyVolumeBucket[],
  metric: WeeklyVolumeMetric,
): number {
  return weeklyVolumeValues(buckets, metric).reduce((sum, value) => sum + value, 0);
}

export function weeklyVolumeAverage(
  buckets: readonly WeeklyVolumeBucket[],
  metric: WeeklyVolumeMetric,
): number {
  if (buckets.length === 0) return 0;
  return weeklyVolumeTotal(buckets, metric) / buckets.length;
}
```

- [ ] **Step 4: Run focused tests and the adjacent weekly tests**

Run:

```powershell
npx vitest run src/lib/analytics/volume.test.ts src/lib/analytics/weeks.test.ts src/lib/volume.test.ts
```

Expected: all tests PASS; no existing weekly or tonnage rule changes.

- [ ] **Step 5: Commit the pure engine**

```powershell
git add src/lib/analytics/volume.ts src/lib/analytics/volume.test.ts
git commit -m "feat(g4): agréger le volume par semaine"
```

---

### Task 2: Typed French vocabulary and readings

**Files:**

- Modify: `src/i18n/fr.ts`
- Modify: `src/i18n/labels.ts`

**Interfaces:**

- Consumes: `WeeklyVolumeMetric` from Task 1 and existing `formatDuration()`.
- Produces:

```ts
export const weeklyVolumeMetricLabel: (metric: WeeklyVolumeMetric) => string;
export const weeklyVolumeReading: (value: number, metric: WeeklyVolumeMetric) => string;
export const weeklyVolumeScaleReading: (value: number, metric: WeeklyVolumeMetric) => string;
```

- [ ] **Step 1: Add the complete `volume` dictionary**

Add beside `weekly` and `muscles`:

```ts
volume: {
  title: 'Volume d’entraînement',
  link: 'Volume d’entraînement',
  subtitle: 'Tonnage et durée par semaine',
  metricSheetTitle: 'Ce que le graphique mesure',
  metricTonnage: 'Tonnage',
  metricDuration: 'Durée',
  weekOf: 'Semaine du {date}',
  total: 'Total · {value}',
  average: 'Moyenne par semaine · {value}',
  weeksSection: 'Semaines',
  scaleZero: '0',
  emptyPeriod: 'Aucune séance sur cette période.',
  zeroTonnage:
    'Ces séances ne contiennent aucune charge externe comptée dans le tonnage.',
  singleWeek:
    'Une seule semaine sur cette période : une tendance demande plusieurs semaines.',
  tonnageHint:
    'Charges externes soulevées. Assistance, lest, poids du corps et échauffements exclus.',
  durationHint: 'Somme des durées complètes des séances.',
  chartSummary:
    '{metric} sur {count} semaines, du {first} au {last}. Minimum {min}, maximum {max}, moyenne {average}.',
  chartSummaryOne: '{metric} de la semaine du {first} : {current}.',
},
```

- [ ] **Step 2: Add typed formatting helpers**

Add the `WeeklyVolumeMetric` type import and these helpers to `labels.ts`:

```ts
export const weeklyVolumeMetricLabel = (metric: WeeklyVolumeMetric): string =>
  t(metric === 'tonnage' ? 'volume.metricTonnage' : 'volume.metricDuration');

export function weeklyVolumeReading(value: number, metric: WeeklyVolumeMetric): string {
  if (metric === 'duration') return formatDuration(Math.round(value / 60) * 60);
  const rounded = Math.round(value * 10) / 10;
  return `${rounded.toLocaleString('fr-FR')} ${unitLabel('kg')}`;
}

export function weeklyVolumeScaleReading(value: number, metric: WeeklyVolumeMetric): string {
  if (metric === 'duration') return formatDuration(Math.round(value / 60) * 60);
  return new Intl.NumberFormat('fr-FR', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}
```

- [ ] **Step 3: Verify dictionary keys and formatting types**

Run:

```powershell
npm run typecheck
```

Expected: PASS; the typed `t()` key union accepts every `volume.*` key.

- [ ] **Step 4: Commit the vocabulary**

```powershell
git add src/i18n/fr.ts src/i18n/labels.ts
git commit -m "feat(g4): nommer le volume hebdomadaire"
```

---

### Task 3: Weekly volume chart and card

**Files:**

- Create: `src/features/analytics/WeeklyVolumeChart.tsx`
- Create: `src/features/analytics/WeeklyVolumeCard.tsx`

**Interfaces:**

- Consumes: `WeeklyVolumeBucket`, `WeeklyVolumeMetric`, summary helpers, `barLayout()`, `ChartSurface`, and `Card`.
- Produces:

```ts
export function WeeklyVolumeChart(props: {
  values: readonly number[];
  ceiling: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  summary: string;
}): React.ReactNode;

export function WeeklyVolumeCard(props: {
  buckets: readonly WeeklyVolumeBucket[];
  metric: WeeklyVolumeMetric;
  selectedIndex: number;
  onSelect: (index: number) => void;
  stale?: boolean;
}): React.ReactNode;
```

- [ ] **Step 1: Implement the SVG with G2’s proven interaction**

Create `WeeklyVolumeChart.tsx`. Keep `BOX = { width: 300, height: 120 }`,
`PAD = 6`, `ZERO_STUB = 4`, and `SINGLE_BAR_WIDTH = 18`. Call
`barLayout(values, BOX, ceiling)`. For one value, narrow the returned slot
around its existing `centerX`; this prevents a single week from becoming a
186 px slab while leaving shared geometry untouched:

```ts
const bars = barLayout(values, BOX, ceiling).map((slot) =>
  values.length === 1
    ? { ...slot, x: slot.centerX - SINGLE_BAR_WIDTH / 2, width: SINGLE_BAR_WIDTH }
    : slot,
);
```

Pass the bar centers to `ChartSurface`, draw the selected `--surface-2` slot
first, draw every positive bar in `--text-2`, every zero stub in `--border`,
then the baseline.

The bar branch must be exactly colour-neutral:

```tsx
{bars.map((slot, index) =>
  slot.height > 0 ? (
    <rect
      key={index}
      x={slot.x}
      y={slot.y}
      width={slot.width}
      height={slot.height}
      rx={Math.min(2, slot.width / 2)}
      fill="var(--text-2)"
    />
  ) : (
    <rect
      key={index}
      x={slot.x}
      y={BOX.height - ZERO_STUB}
      width={slot.width}
      height={ZERO_STUB}
      rx={1}
      fill="var(--border)"
    />
  ),
)}
```

Do not add a `reached`, `record`, or selected-colour branch.

- [ ] **Step 2: Implement the card reading**

Create `WeeklyVolumeCard.tsx` from `WeeklyCard`’s structure, with these calculations:

```ts
const values = weeklyVolumeValues(buckets, metric);
const ceiling = Math.max(...values, 1);
const selected = buckets[selectedIndex] ?? last;
const selectedValue =
  metric === 'tonnage' ? selected.tonnage : selected.durationSeconds;
const total = weeklyVolumeTotal(buckets, metric);
const average = weeklyVolumeAverage(buckets, metric);
```

The card must render, in order:

1. selected week and `weeklyVolumeReading(selectedValue, metric)`;
2. engraved ceiling and zero beside `WeeklyVolumeChart`;
3. first and last dates;
4. single-week explanation when applicable;
5. total and average;
6. metric-specific hint;
7. zero-tonnage explanation only when `metric === 'tonnage' && total === 0`.

Build the accessible summary with `volume.chartSummary` or
`volume.chartSummaryOne`; all numeric substitutions use `weeklyVolumeReading`.

- [ ] **Step 3: Verify compilation and existing chart non-regression**

Run:

```powershell
npm run typecheck
npx vitest run src/lib/analytics/plot.test.ts
```

Expected: both PASS; `plot.ts`, `ChartSurface.tsx`, `WeeklyChart.tsx`, and `ProgressChart.tsx` remain unchanged.

- [ ] **Step 4: Commit the chart**

```powershell
git add src/features/analytics/WeeklyVolumeChart.tsx src/features/analytics/WeeklyVolumeCard.tsx
git commit -m "feat(g4): dessiner le volume hebdomadaire"
```

---

### Task 4: Screen, accessible list, and filters

**Files:**

- Create: `src/features/analytics/WeeklyVolumeScreen.tsx`

**Interfaces:**

- Consumes: `listExportSources()`, `listCompletedWorkoutTimestamps()`, `periodBounds()`, `weeklyVolumeBuckets()`, `WeeklyVolumeCard`, `FilterChip`, `OptionSheet`, `Card`, `ListRow`, and `SectionTitle`.
- Produces: `export function WeeklyVolumeScreen(): React.ReactNode`.

- [ ] **Step 1: Implement the two-filter screen**

Mirror `WeeklySessionsScreen`’s read policy:

```ts
const [period, setPeriod] = useState<PeriodKey>('12w');
const [metric, setMetric] = useState<WeeklyVolumeMetric>('tonnage');
const [periodOpen, setPeriodOpen] = useState(false);
const [metricOpen, setMetricOpen] = useState(false);
const [selectedIndex, setSelectedIndex] = useState<number>();
const [openedAt] = useState(() => Date.now());

const { from, to } = periodBounds(period, openedAt);
const sources = useLiveQuery(
  () =>
    listExportSources(
      from === undefined ? { kind: 'all-history' } : { kind: 'period', from, to },
    ),
  [from, to],
);
const allStarts = useLiveQuery(() => listCompletedWorkoutTimestamps(), []);
const hasEarlierHistory =
  from !== undefined && (allStarts ?? []).some((startedAt) => startedAt < from);
const buckets = weeklyVolumeBuckets(sources ?? [], { from, to }, hasEarlierHistory);
const selected = Math.min(selectedIndex ?? buckets.length - 1, buckets.length - 1);
```

Render period and metric `FilterChip`s in the same horizontal row. Changing the
period resets `selectedIndex`; changing the metric keeps it.

- [ ] **Step 2: Add empty state and exhaustive week list**

For `buckets.length === 0`, use the same period-empty `Card` and “Voir tout
l’historique” action as G1–G3.

For a non-empty result, render `WeeklyVolumeCard`, then reverse the buckets into
a `SectionTitle` + `Card` list. Each `ListRow` selects its original index and
shows:

```tsx
weeklyVolumeReading(
  metric === 'tonnage' ? bucket.tonnage : bucket.durationSeconds,
  metric,
)
```

The list is the accessible exhaustive reading; zero weeks must remain present.

- [ ] **Step 3: Add both option sheets**

The metric sheet has exactly two values:

```tsx
options={[
  { value: 'tonnage', label: weeklyVolumeMetricLabel('tonnage') },
  { value: 'duration', label: weeklyVolumeMetricLabel('duration') },
]}
```

The period sheet reuses every `PERIOD_KEYS` value and `periodLabel()`.

- [ ] **Step 4: Verify the focused screen**

Run:

```powershell
npm run typecheck
npm run lint
```

Expected: both PASS; no hard-coded French string and no React hook error.

- [ ] **Step 5: Commit the screen**

```powershell
git add src/features/analytics/WeeklyVolumeScreen.tsx
git commit -m "feat(g4): lire le volume par semaine"
```

---

### Task 5: Navigation and lazy route

**Files:**

- Modify: `src/features/analytics/AnalyticsScreen.tsx`
- Modify: `src/features/analytics/routes.tsx`
- Modify: `src/router.tsx`

**Interfaces:**

- Consumes: `WeeklyVolumeScreen` from Task 4.
- Produces: `WeeklyVolumeRoute` and hash route `#/analytics/volume`.

- [ ] **Step 1: Add the overview command**

Place the new row after “Séances par semaine” and before “Séries par muscle”:

```tsx
<ListRow
  title={t('volume.link')}
  subtitle={t('volume.subtitle')}
  onClick={() => void navigate('/analytics/volume')}
/>
```

It remains inside `hasHistory`, so an empty installation cannot open a graph
whose timeline has no start.

- [ ] **Step 2: Add the lazy route wrapper**

In `routes.tsx`:

```tsx
const WeeklyVolumeScreen = lazy(() =>
  import('./WeeklyVolumeScreen').then((module) => ({
    default: module.WeeklyVolumeScreen,
  })),
);

export function WeeklyVolumeRoute() {
  return (
    <Suspense fallback={<span />}>
      <WeeklyVolumeScreen />
    </Suspense>
  );
}
```

- [ ] **Step 3: Register the hash route**

Import `WeeklyVolumeRoute` in `src/router.tsx`, then add:

```tsx
{ path: 'analytics/volume', element: <WeeklyVolumeRoute /> },
```

beside the other analytics routes.

- [ ] **Step 4: Verify route compilation and production chunking**

Run:

```powershell
npm run typecheck
npm run build
```

Expected: PASS; build output includes a separate `WeeklyVolumeScreen-*.js`
chunk and no new dependency warning.

- [ ] **Step 5: Commit navigation**

```powershell
git add src/features/analytics/AnalyticsScreen.tsx src/features/analytics/routes.tsx src/router.tsx
git commit -m "feat(g4): ouvrir le volume depuis les analyses"
```

---

### Task 6: Browser verification, full gates, and project memory

**Files:**

- Modify: `PROGRESS.md`

**Interfaces:**

- Consumes: completed G4 implementation.
- Produces: reproducible verification evidence and the phone checkpoint.

- [ ] **Step 1: Run the full automated gates**

Run:

```powershell
npm run lint
npm run typecheck
npm run test:run
npm run build
```

Expected: all four commands PASS and the test count increases by the new
`volume.test.ts` cases.

- [ ] **Step 2: Pilot the real mobile UI**

Start the app at its configured base path and verify at 375 × 812 px with a
fixture containing:

- at least eight completed sessions over four weeks;
- two sessions in one week;
- one internal week without a session;
- a load exercise, an assisted exercise, a weighted bodyweight exercise, and a
  warm-up;
- distinct workout durations;
- one Sunday-night workout carrying its own offset.

Check:

- Analytics shows exactly one new “Volume d’entraînement” row.
- Tonnage values match a manual `sessionTotals()` count.
- Duration values match sums of `Workout.durationSeconds`.
- Switching metric keeps the same selected week.
- Switching period selects the latest week.
- The empty internal week is present and tappable at zero.
- Every bar remains `--text-2`; no SVG mark uses `--accent-ink`.
- The week list repeats every chart value.
- SVG is outside tab order and has a complete French accessible name.
- Minimum target is 48 px.
- `scrollWidth === innerWidth === 375`.
- No console error.
- Dark and light theme non-text contrast is at least 3:1 for bar, zero stub,
  selection slot, and baseline against the card surface.

- [ ] **Step 3: Update `PROGRESS.md`**

Prepend a dated G4 entry containing:

- the delivered route and its two metrics;
- the decision to exclude tonnage/duration by muscle;
- the fact that no new query, dependency, token, or accent use was added;
- aggregation edge cases and exact automated test count;
- measured bundle chunk size;
- the browser fixture and measurements above;
- any real issue found and corrected during piloting.

End with this phone checkpoint:

> Ouvre **Historique → Analyses → Volume d’entraînement**. Sur « Tonnage », vérifie à la main une semaine avec une séance de charge et une séance au poids du corps : seuls les kilos externes réellement soulevés doivent compter. Passe à « Durée » : la semaine sélectionnée ne doit pas changer et le total doit être la somme des durées complètes de tes séances. Tape une semaine sans entraînement au milieu de ton historique : elle doit rester visible et lire zéro. Change enfin de période et vérifie que les semaines antérieures à ta première séance ne sont jamais inventées.

- [ ] **Step 4: Re-run the project ritual after documentation**

Run:

```powershell
npm run typecheck
npm run test:run
npm run build
git status --short
```

Expected: all three gates PASS; only `PROGRESS.md` is uncommitted.

- [ ] **Step 5: Commit project memory**

```powershell
git add PROGRESS.md
git commit -m "docs: consigner le graphique de volume"
```
