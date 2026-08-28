import { useState } from 'react';
import { t } from '@/i18n/fr';
import { FilterChip, OptionSheet } from '@/ui';

interface ExerciseOption {
  id: string;
  name: string;
}

interface Props {
  options: readonly ExerciseOption[] | undefined;
  value: string | undefined;
  onChange: (exerciseId: string | undefined) => void;
}

const ALL_EXERCISES = '';

export function HistoryExerciseFilter({
  options,
  value,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = options?.find((option) => option.id === value);

  return (
    <>
      <FilterChip
        tutorialId="history-exercise-filter"
        label={selected?.name ?? t('history.exerciseFilter')}
        active={value !== undefined}
        onClick={() => setOpen(true)}
      />

      <OptionSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t('history.exerciseFilterTitle')}
        value={value ?? ALL_EXERCISES}
        options={[
          {
            value: ALL_EXERCISES,
            label: t('history.allExercises'),
          },
          ...(options ?? []).map((option) => ({
            value: option.id,
            label: option.name,
          })),
        ]}
        onSelect={(exerciseId) =>
          onChange(exerciseId === ALL_EXERCISES ? undefined : exerciseId)
        }
      />
    </>
  );
}
