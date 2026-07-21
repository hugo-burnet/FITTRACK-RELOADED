import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import { countExercises, listExercises } from '@/data/repositories/exercises';
import { EQUIPMENT, MUSCLE_GROUPS } from '@/data/types';
import type { Equipment, MuscleGroup } from '@/data/types';
import { t } from '@/i18n/fr';
import { equipmentLabel, muscleLabel } from '@/i18n/labels';
import { Button, EmptyState, FilterChip, Input, OptionSheet } from '@/ui';
import type { Option } from '@/ui';
import { PlusIcon } from '@/ui/icons';
import { ExerciseList } from './ExerciseList';

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

/** Reads a URL parameter back into its union, without a cast and without trusting it. */
function pickFrom<T extends string>(values: readonly T[], raw: string | null): T | undefined {
  return values.find((value) => value === raw);
}

export function ExercisesScreen() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [picker, setPicker] = useState<'muscle' | 'equipment' | null>(null);

  // The URL is the source of truth for the search and the two filters: opening
  // an exercise and coming back must land on the list you left, not on 168 rows
  // from the top. `replace` keeps one history entry for the screen, so the back
  // button does not have to walk back through every keystroke.
  const search = params.get('q') ?? '';
  const muscle = pickFrom(MUSCLE_GROUPS, params.get('muscle'));
  const equipment = pickFrom(EQUIPMENT, params.get('equipment'));

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value === '') next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const exercises = useLiveQuery(
    () => listExercises({ search, muscle, equipment }),
    [search, muscle, equipment],
  );
  const total = useLiveQuery(countExercises);

  const filtered = search !== '' || muscle !== undefined || equipment !== undefined;

  return (
    <Screen
      title={t('exercises.title')}
      action={
        <button
          type="button"
          aria-label={t('exercises.create')}
          onClick={() => void navigate('/exercises/new')}
          className="-mr-2 flex size-12 items-center justify-center rounded-xl
            text-[var(--accent-ink)] active:bg-[var(--surface-1)]"
        >
          <PlusIcon />
        </button>
      }
    >
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
            onChange={(event) => setParam('q', event.target.value)}
            className={search === '' ? '' : 'pr-14'}
          />
          {/* Unlike a filter, a search is cleared constantly — and the only
              alternative is holding backspace down. */}
          {search !== '' && (
            <button
              type="button"
              aria-label={t('exercises.clearSearch')}
              onClick={() => setParam('q', '')}
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
            onOpen={(id) => void navigate(`/exercises/${id}`)}
          />
        ) : (
          <EmptyResult
            search={search}
            filtered={muscle !== undefined || equipment !== undefined}
            onCreate={() => void navigate(`/exercises/new?name=${encodeURIComponent(search)}`)}
            onClearFilters={() => setParams(new URLSearchParams(), { replace: true })}
          />
        ))}

      <OptionSheet<MuscleFilter>
        open={picker === 'muscle'}
        onClose={() => setPicker(null)}
        title={t('exercises.filterMuscle')}
        options={MUSCLE_OPTIONS}
        value={muscle ?? ''}
        onSelect={(value) => setParam('muscle', value)}
      />

      <OptionSheet<EquipmentFilter>
        open={picker === 'equipment'}
        onClose={() => setPicker(null)}
        title={t('exercises.filterEquipment')}
        options={EQUIPMENT_OPTIONS}
        value={equipment ?? ''}
        onSelect={(value) => setParam('equipment', value)}
      />
    </Screen>
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
  onClearFilters,
}: {
  search: string;
  filtered: boolean;
  onCreate: () => void;
  onClearFilters: () => void;
}) {
  if (search !== '') {
    return (
      <EmptyState
        title={t('exercises.noMatchTitle')}
        body={t('exercises.noMatchSearch', { search })}
        action={
          // The moment you actually need to create an exercise is the moment you
          // looked for it and it was not there — with the name already typed.
          <Button variant="primary" onClick={onCreate} fullWidth>
            {t('exercises.createNamed', { name: search })}
          </Button>
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
