import { useState } from 'react';
import { EQUIPMENT, MUSCLE_GROUPS } from '@/data/types';
import type { Equipment, Exercise, MuscleGroup } from '@/data/types';
import type { HevyExerciseResolution } from '@/data/repositories/hevyImport';
import { t } from '@/i18n/fr';
import { equipmentLabel, muscleLabel } from '@/i18n/labels';
import { Button, FilterChip, Input, OptionSheet, Sheet } from '@/ui';
import type { Option } from '@/ui';
import { customResolutionFor, type HevyMappingDraftRow } from './hevyImportDraft';
import { filterHevyMappingExercises } from './hevyExerciseMappingFilters';

type MuscleFilter = MuscleGroup | '';
type EquipmentFilter = Equipment | '';

const MUSCLE_OPTIONS: Option<MuscleFilter>[] = [
  { value: '', label: t('exercises.allMuscles') },
  ...MUSCLE_GROUPS.map((muscle) => ({ value: muscle, label: muscleLabel(muscle) })),
];

const EQUIPMENT_OPTIONS: Option<EquipmentFilter>[] = [
  { value: '', label: t('exercises.allEquipment') },
  ...EQUIPMENT.map((equipment) => ({ value: equipment, label: equipmentLabel(equipment) })),
];

export function HevyExerciseMappingSheet({
  row,
  exercises,
  onClose,
  onSelect,
}: {
  row: HevyMappingDraftRow | null;
  exercises: readonly Exercise[];
  onClose: () => void;
  onSelect: (resolution: HevyExerciseResolution) => void;
}) {
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup>();
  const [equipment, setEquipment] = useState<Equipment>();
  const [picker, setPicker] = useState<'muscle' | 'equipment' | null>(null);
  const reset = () => {
    setSearch('');
    setMuscle(undefined);
    setEquipment(undefined);
    setPicker(null);
  };
  const close = () => {
    reset();
    onClose();
  };
  const select = (resolution: HevyExerciseResolution) => {
    reset();
    onSelect(resolution);
  };

  const filtered = filterHevyMappingExercises(exercises, row, search, muscle, equipment);

  return (
    <>
      <Sheet
        open={row !== null}
        onClose={close}
        title={row?.source.sourceTitle ?? t('history.importChooseExercise')}
      >
        {row !== null && (
          <div className="space-y-4">
            {row.suggestion !== undefined && (
              <Button
                variant="primary"
                fullWidth
                onClick={() =>
                  select({
                    kind: 'existing',
                    exerciseId: row.suggestion!.id,
                  })
                }
              >
                {t('history.importUseSuggestion')} · {row.suggestion.name}
              </Button>
            )}

            <Input
              label={t('history.importExerciseSearch')}
              labelHidden
              type="search"
              inputMode="search"
              enterKeyHint="search"
              value={search}
              placeholder={t('history.editExerciseSearchPlaceholder')}
              onChange={(event) => setSearch(event.target.value)}
            />

            <div className="flex flex-wrap gap-2">
              <FilterChip
                label={muscle === undefined ? t('exercises.filterMuscle') : muscleLabel(muscle)}
                active={muscle !== undefined}
                onClick={() => setPicker('muscle')}
              />
              <FilterChip
                label={
                  equipment === undefined
                    ? t('exercises.filterEquipment')
                    : equipmentLabel(equipment)
                }
                active={equipment !== undefined}
                onClick={() => setPicker('equipment')}
              />
            </div>

            <div className="-mx-5 border-y border-[var(--border)]">
              {filtered.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-[var(--text-2)]">
                  {t('history.importNoExercise')}
                </p>
              ) : (
                filtered.map((exercise) => (
                  <button
                    key={exercise.id}
                    type="button"
                    onClick={() =>
                      select({
                        kind: 'existing',
                        exerciseId: exercise.id,
                      })
                    }
                    className="flex min-h-14 w-full items-center border-b border-[var(--border)]
                    px-5 py-3 text-left text-base text-[var(--text-1)]
                    last:border-b-0 active:bg-[var(--surface-2)]"
                  >
                    {exercise.name}
                  </button>
                ))
              )}
            </div>

            <Button
              variant="secondary"
              fullWidth
              onClick={() => select(customResolutionFor(row.source))}
            >
              {t('history.importCreateCustom', {
                name: row.source.sourceTitle,
              })}
            </Button>
          </div>
        )}
      </Sheet>

      <OptionSheet<MuscleFilter>
        open={picker === 'muscle'}
        onClose={() => setPicker(null)}
        title={t('exercises.filterMuscle')}
        options={MUSCLE_OPTIONS}
        value={muscle ?? ''}
        onSelect={(value) => setMuscle(value === '' ? undefined : value)}
      />

      <OptionSheet<EquipmentFilter>
        open={picker === 'equipment'}
        onClose={() => setPicker(null)}
        title={t('exercises.filterEquipment')}
        options={EQUIPMENT_OPTIONS}
        value={equipment ?? ''}
        onSelect={(value) => setEquipment(value === '' ? undefined : value)}
      />
    </>
  );
}
