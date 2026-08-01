# Coach Export Working-Set Authority Design

## Goal

Remove the duplicated warm-up exclusion rule from the coach export so exported
set content and `workingSetCount` depend on the same `isWorkingSet` authority.

## Decision

In `projectCoachExport`, preserve the existing `includeWarmups` branch:

- `true`: export every set unchanged;
- `false`: filter sets with the existing `isWorkingSet` predicate from
  `src/lib/records.ts`.

Do not introduce a new helper, adapter, type, option, or export format.

## Preserved Behavior

- Warm-ups remain excluded when `includeWarmups` is false.
- Normal, dropset, and failure sets remain included.
- `includeWarmups` true continues to include every set.
- Set order, numbering, values, IDs, notes, totals, schema version, and Markdown
  serialization remain unchanged.
- `workingSetCount` keeps its current implementation and value.

## Evidence

The existing `projectCoachExport` tests already cover all four set types and
both values of `includeWarmups`. Add one focused assertion that the projected
set count agrees with `workingSetCount` when warm-ups are excluded. Because the
current duplicate predicate is behaviorally equivalent, demonstrate
sensitivity with a temporary mutant that restores the local predicate while
changing `isWorkingSet`; the coherence assertion must then fail. Restore both
files exactly before the final gates.

## Scope

Modify only:

- `src/lib/export/projectCoachExport.ts`
- `src/lib/export/projectCoachExport.test.ts`

Do not modify `warmupContext`, records behavior, export types, serializers,
translations, repositories, schema, migrations, routes, or dependencies.
