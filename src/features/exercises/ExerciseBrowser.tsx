import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { countExercises, listExercises } from '@/data/repositories/exercises';
import { EQUIPMENT, MUSCLE_GROUPS } from '@/data/types';
import type { Equipment, Exercise, MuscleGroup } from '@/data/types';
import { t } from '@/i18n/fr';
import { equipmentLabel, muscleLabel } from '@/i18n/labels';
import { Button, EmptyState, FilterChip, Input, OptionSheet } from '@/ui';
import type { Option } from '@/ui';
import { ExerciseList } from './ExerciseList';

export type BrowserQuery = {
  search: string;
  muscle?: MuscleGroup;
  equipment?: Equipment;
};

type Props = {
  /**
   * Controlled from outside, because the two callers hold it differently: the
   * library keeps it in the URL so a round trip to an exercise comes back to the
   * list you left, while the picker keeps it in local state — a modal sheet has
   * no business writing to the address bar.
   */
  query: BrowserQuery;
  onQueryChange: (query: BrowserQuery) => void;
  onPick: (exercise: Exercise) => void;
  /** Present = multi-select: rows toggle instead of opening. */
  selectedIds?: ReadonlySet<string>;
  /**
   * Present = a fruitless search offers to create the missing exercise. The
   * picker leaves it out: creating one would abandon the routine being written
   * for a form, and coming back could not restore the selection. Its way out is
   * to clear the search, which does not leave the gesture in progress.
   */
  onCreate?: (name: string) => void;
};

/** `''` is "no filter" — a picker's value is never null, so the sentinel is a row like any other. */
type MuscleFilter = MuscleGroup | '';
type EquipmentFilter = Equipment | '';

/**
 * Both lists stay in schema order rather than alphabetical: MUSCLE_GROUPS runs
 * anatomically (push, pull, shoulders, arms, legs, core) and EQUIPMENT roughly
 * by how often you touch it. Sorting them by French label would file quads and
 * hamstrings on opposite sides of the sheet.
 */
const MUSCLE_OPTIONS: Option<MuscleFilter>[] = [
  { value: '', label: t('exercises.allMuscles') },
  ...MUSCLE_GROUPS.map((muscle) => ({ value: muscle, label: muscleLabel(muscle) })),
];

const EQUIPMENT_OPTIONS: Option<EquipmentFilter>[] = [
  { value: '', label: t('exercises.allEquipment') },
  ...EQUIPMENT.map((equipment) => ({ value: equipment, label: equipmentLabel(equipment) })),
];

/**
 * The library's search, filters, readout and list — everything except what to do
 * with a row.
 *
 * Extracted before writing a second copy for the routine picker, as PROGRESS.md
 * required: two lists that must find "developpe" without an accent are one list
 * with two callers.
 */
export function ExerciseBrowser({
  query,
  onQueryChange,
  onPick,
  selectedIds,
  onCreate,
}: Props) {
  const [picker, setPicker] = useState<'muscle' | 'equipment' | null>(null);

  const { search, muscle, equipment } = query;

  const exercises = useLiveQuery(
    () => listExercises({ search, muscle, equipment }),
    [search, muscle, equipment],
  );
  const total = useLiveQuery(countExercises);

  const filtered = search !== '' || muscle !== undefined || equipment !== undefined;

  return (
    <>
      <div className="flex flex-col gap-3 pb-5">
        {/* The sr-only label is out of flow, so the clear button lines up with
            the field itself rather than with the pair. */}
        <div className="relative">
          <Input
            label={t('exercises.searchLabel')}
            labelHidden
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            placeholder={t('exercises.searchPlaceholder')}
            value={search}
            onChange={(event) => onQueryChange({ ...query, search: event.target.value })}
            className={search === '' ? '' : 'pr-14'}
          />
          {/* Unlike a filter, a search is cleared constantly — and the only
              alternative is holding backspace down. */}
          {search !== '' && (
            <button
              type="button"
              aria-label={t('exercises.clearSearch')}
              onClick={() => onQueryChange({ ...query, search: '' })}
              className="absolute top-0 right-0 flex size-12 items-center justify-center
                text-2xl text-[var(--text-2)]"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <FilterChip
            label={muscle === undefined ? t('exercises.filterMuscle') : muscleLabel(muscle)}
            active={muscle !== undefined}
            onClick={() => setPicker('muscle')}
          />
          <FilterChip
            label={
              equipment === undefined ? t('exercises.filterEquipment') : equipmentLabel(equipment)
            }
            active={equipment !== undefined}
            onClick={() => setPicker('equipment')}
          />

          {/* The readout. Counts down live as you type — it tells you a filter is
              too tight before you have scrolled anywhere. */}
          <p className="ml-auto shrink-0 text-right">
            <span className="metric text-xl font-semibold text-[var(--text-1)]">
              {(exercises?.length ?? 0).toLocaleString('fr-FR')}
            </span>{' '}
            <span className="label-xs font-semibold text-[var(--text-2)]">
              {filtered
                ? t('exercises.countOf', { total: (total ?? 0).toLocaleString('fr-FR') })
                : t('exercises.countUnit')}
            </span>
          </p>
        </div>
      </div>

      {/* `undefined` is "the query has not answered yet". Rendering the empty
          state then would flash "rien ne correspond" on every keystroke. */}
      {exercises !== undefined &&
        (exercises.length > 0 ? (
          <ExerciseList
            exercises={exercises}
            grouped={search === ''}
            onOpen={onPick}
            selectedIds={selectedIds}
          />
        ) : (
          <EmptyResult
            search={search}
            filtered={muscle !== undefined || equipment !== undefined}
            onCreate={onCreate}
            onClearSearch={() => onQueryChange({ ...query, search: '' })}
            onClearFilters={() => onQueryChange({ search: query.search })}
          />
        ))}

      <OptionSheet<MuscleFilter>
        open={picker === 'muscle'}
        onClose={() => setPicker(null)}
        title={t('exercises.filterMuscle')}
        options={MUSCLE_OPTIONS}
        value={muscle ?? ''}
        onSelect={(value) => onQueryChange({ ...query, muscle: value === '' ? undefined : value })}
      />

      <OptionSheet<EquipmentFilter>
        open={picker === 'equipment'}
        onClose={() => setPicker(null)}
        title={t('exercises.filterEquipment')}
        options={EQUIPMENT_OPTIONS}
        value={equipment ?? ''}
        onSelect={(value) =>
          onQueryChange({ ...query, equipment: value === '' ? undefined : value })
        }
      />
    </>
  );
}

/**
 * Three different dead ends, three different ways out. All use the `title`
 * variant: the readout above is already the gauge, and a 72px `0` under it
 * would say the same thing twice.
 */
function EmptyResult({
  search,
  filtered,
  onCreate,
  onClearSearch,
  onClearFilters,
}: {
  search: string;
  filtered: boolean;
  onCreate?: (name: string) => void;
  onClearSearch: () => void;
  onClearFilters: () => void;
}) {
  if (search !== '') {
    return (
      <EmptyState
        title={t('exercises.noMatchTitle')}
        body={t('exercises.noMatchSearch', { search })}
        action={
          onCreate === undefined ? (
            <Button onClick={onClearSearch} fullWidth>
              {t('picker.clearSearch')}
            </Button>
          ) : (
            // The moment you actually need to create an exercise is the moment
            // you looked for it and it was not there — with the name typed.
            <Button variant="primary" onClick={() => onCreate(search)} fullWidth>
              {t('exercises.createNamed', { name: search })}
            </Button>
          )
        }
      />
    );
  }

  if (filtered) {
    return (
      <EmptyState
        title={t('exercises.noMatchFiltersTitle')}
        body={t('exercises.noMatchFilters')}
        action={
          <Button onClick={onClearFilters} fullWidth>
            {t('exercises.clearFilters')}
          </Button>
        }
      />
    );
  }

  return <EmptyState title={t('exercises.emptyTitle')} body={t('exercises.emptyBody')} />;
}
