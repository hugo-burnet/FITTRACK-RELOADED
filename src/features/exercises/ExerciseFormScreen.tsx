import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import { createCustomExercise, getExercise, updateExercise } from '@/data/repositories/exercises';
import { EQUIPMENT, MEASUREMENT_TYPES, MUSCLE_GROUPS } from '@/data/types';
import type { Equipment, MeasurementType, MuscleGroup } from '@/data/types';
import { t } from '@/i18n/fr';
import { equipmentLabel, measurementHint, measurementLabel, muscleLabel } from '@/i18n/labels';
import { Button, Card, Input, ListRow, OptionSheet } from '@/ui';
import type { Option } from '@/ui';
import { ChevronDownIcon } from '@/ui/icons';

type Draft = {
  name: string;
  primaryMuscle: MuscleGroup;
  equipment: Equipment;
  measurementType: MeasurementType;
  isUnilateral: 0 | 1;
};

/** Bench press. The four fields after the name are adjustments, not questions. */
const BLANK: Draft = {
  name: '',
  primaryMuscle: 'chest',
  equipment: 'barbell',
  measurementType: 'weight_reps',
  isUnilateral: 0,
};

const MUSCLE_OPTIONS: Option<MuscleGroup>[] = MUSCLE_GROUPS.map((muscle) => ({
  value: muscle,
  label: muscleLabel(muscle),
}));

const EQUIPMENT_OPTIONS: Option<Equipment>[] = EQUIPMENT.map((equipment) => ({
  value: equipment,
  label: equipmentLabel(equipment),
}));

// The only picker carrying hints: "Poids et durée" is unguessable on its own.
const MEASUREMENT_OPTIONS: Option<MeasurementType>[] = MEASUREMENT_TYPES.map((measurement) => ({
  value: measurement,
  label: measurementLabel(measurement),
  hint: measurementHint(measurement),
}));

type Field = 'muscle' | 'equipment' | 'measurement';

function PickerRow({ label, value, onOpen }: { label: string; value: string; onOpen: () => void }) {
  return (
    <ListRow
      title={label}
      onClick={onOpen}
      trailing={
        <span className="flex items-center gap-1 text-base text-[var(--text-1)]">
          {value}
          <ChevronDownIcon className="text-[var(--text-2)]" />
        </span>
      }
    />
  );
}

export function ExerciseFormScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [picker, setPicker] = useState<Field | null>(null);

  const editing = id !== undefined;
  const existing = useLiveQuery(
    async () => (editing ? ((await getExercise(id)) ?? null) : null),
    [id, editing],
  );

  // Pre-filled from the search that came up empty: you looked for it, it was not
  // there, the name is already typed.
  const [draft, setDraft] = useState<Draft>(() => ({
    ...BLANK,
    name: params.get('name') ?? '',
  }));
  const [loadedId, setLoadedId] = useState<string | null>(null);

  if (existing != null && loadedId !== existing.id) {
    setLoadedId(existing.id);
    setDraft({
      name: existing.name,
      primaryMuscle: existing.primaryMuscle,
      equipment: existing.equipment,
      measurementType: existing.measurementType,
      isUnilateral: existing.isUnilateral,
    });
  }

  const name = draft.name.trim();

  const submit = () => {
    if (name === '') return;

    if (editing && existing != null) {
      void updateExercise(existing.id, { ...draft, name }).then(() => navigate(-1));
      return;
    }

    void createCustomExercise({ ...draft, name, secondaryMuscles: [] }).then((created) =>
      // `replace`: going back from the new exercise returns to the library, not
      // to a form that would create a second copy.
      navigate(`/exercises/${created.id}`, { replace: true }),
    );
  };

  return (
    <Screen
      title={editing ? t('exerciseForm.editTitle') : t('exerciseForm.createTitle')}
      action={
        <button
          type="button"
          onClick={() => void navigate(-1)}
          className="-mr-2 flex min-h-12 items-center px-2 text-base font-semibold text-[var(--text-2)]"
        >
          {t('exerciseForm.back')}
        </button>
      }
    >
      <div className="flex flex-col gap-6">
        <Card padded>
          <Input
            label={t('exerciseForm.nameLabel')}
            placeholder={t('exerciseForm.namePlaceholder')}
            value={draft.name}
            autoFocus={!editing}
            enterKeyHint="done"
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
        </Card>

        <Card>
          <PickerRow
            label={t('exerciseForm.muscleLabel')}
            value={muscleLabel(draft.primaryMuscle)}
            onOpen={() => setPicker('muscle')}
          />
          <PickerRow
            label={t('exerciseForm.equipmentLabel')}
            value={equipmentLabel(draft.equipment)}
            onOpen={() => setPicker('equipment')}
          />
          <PickerRow
            label={t('exerciseForm.measurementLabel')}
            value={measurementLabel(draft.measurementType)}
            onOpen={() => setPicker('measurement')}
          />
        </Card>

        <Card padded>
          <div
            role="radiogroup"
            aria-label={t('exerciseForm.unilateralLabel')}
            className="flex items-center gap-4"
          >
            <span className="flex-1 text-base text-[var(--text-1)]">
              {t('exerciseForm.unilateralLabel')}
            </span>
            <span className="flex gap-1 rounded-xl bg-[var(--surface-2)] p-1">
              {([0, 1] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={draft.isUnilateral === value}
                  onClick={() => setDraft({ ...draft, isUnilateral: value })}
                  className={`min-h-12 w-16 rounded-lg text-base font-semibold
                    transition-colors duration-[var(--dur-1)] ease-[var(--ease-mech)]
                    ${
                      draft.isUnilateral === value
                        ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                        : 'text-[var(--text-2)]'
                    }`}
                >
                  {value === 1 ? t('common.yes') : t('common.no')}
                </button>
              ))}
            </span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-[var(--text-2)]">
            {t('exerciseForm.unilateralHint')}
          </p>
        </Card>

        {/* Thumb zone: the primary action sits at the bottom of the screen. */}
        <Button variant="primary" size="lg" fullWidth disabled={name === ''} onClick={submit}>
          {editing ? t('exerciseForm.submitSave') : t('exerciseForm.submitCreate')}
        </Button>
      </div>

      <OptionSheet<MuscleGroup>
        open={picker === 'muscle'}
        onClose={() => setPicker(null)}
        title={t('exerciseForm.muscleLabel')}
        options={MUSCLE_OPTIONS}
        value={draft.primaryMuscle}
        onSelect={(primaryMuscle) => setDraft({ ...draft, primaryMuscle })}
      />

      <OptionSheet<Equipment>
        open={picker === 'equipment'}
        onClose={() => setPicker(null)}
        title={t('exerciseForm.equipmentLabel')}
        options={EQUIPMENT_OPTIONS}
        value={draft.equipment}
        onSelect={(equipment) => setDraft({ ...draft, equipment })}
      />

      <OptionSheet<MeasurementType>
        open={picker === 'measurement'}
        onClose={() => setPicker(null)}
        title={t('exerciseForm.measurementLabel')}
        options={MEASUREMENT_OPTIONS}
        value={draft.measurementType}
        onSelect={(measurementType) => setDraft({ ...draft, measurementType })}
      />
    </Screen>
  );
}
