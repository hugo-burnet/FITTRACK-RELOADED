import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAppNavigate } from '@/app/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import { createCustomExercise, getExercise, updateExercise } from '@/data/repositories/exercises';
import { EQUIPMENT, MEASUREMENT_TYPES, MOVEMENT_PATTERNS, MUSCLE_GROUPS } from '@/data/types';
import type { Equipment, MeasurementType, MovementPattern, MuscleGroup } from '@/data/types';
import { useTutorialControls } from '@/features/tutorial/tutorialContext';
import { t } from '@/i18n/fr';
import {
  equipmentLabel,
  measurementHint,
  measurementLabel,
  movementPatternLabel,
  muscleLabel,
} from '@/i18n/labels';
import {
  defaultBodyweightLoadFactor,
  factorToPercent,
  isValidBodyweightFactorPercent,
  percentToFactor,
  supportsBodyweightLoad,
} from '@/lib/bodyweightLoad';
import { Button, Card, Input, ListRow, MultiOptionSheet, NumberInput, OptionSheet } from '@/ui';
import type { Option } from '@/ui';
import { ChevronDownIcon } from '@/ui/icons';

type Draft = {
  name: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  measurementType: MeasurementType;
  isUnilateral: 0 | 1;
  bodyweightLoadFactor?: number;
  /** Facultative : l'absence est une réponse, pas un champ à remplir. */
  movementPattern?: MovementPattern;
};

/** Bench press. The four fields after the name are adjustments, not questions. */
const BLANK: Draft = {
  name: '',
  primaryMuscle: 'chest',
  secondaryMuscles: [],
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

// Le vocabulaire est fermé : il n'y a rien à taper, seulement à choisir dans
// une liste que le contrat KB gèle. « Aucune » ouvre la liste parce que ne pas
// classer un mouvement est une décision comme une autre.
const MOVEMENT_OPTIONS: Option<MovementPattern>[] = MOVEMENT_PATTERNS.map((pattern) => ({
  value: pattern,
  label: movementPatternLabel(pattern),
}));

type Field = 'muscle' | 'secondaryMuscles' | 'equipment' | 'measurement' | 'movement';

/**
 * « Biceps · Haut du dos », « 3 muscles », « Aucun ».
 *
 * Two names are read faster than "2 muscles"; past three the list stops fitting
 * on the row and a count is the only honest reading left.
 */
function secondaryMusclesReading(muscles: readonly MuscleGroup[]): string {
  if (muscles.length === 0) return t('exerciseForm.secondaryMusclesNone');
  if (muscles.length > 2) return t('exerciseForm.secondaryMusclesCount', { count: muscles.length });
  return muscles.map(muscleLabel).join(' · ');
}

function PickerRow({
  label,
  value,
  onOpen,
  tutorialId,
}: {
  label: string;
  value: string;
  onOpen: () => void;
  tutorialId?: string;
}) {
  return (
    <ListRow
      title={label}
      tutorialId={tutorialId}
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
  const tutorial = useTutorialControls();
  const { id } = useParams();
  const navigate = useAppNavigate();
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
      // Copied, never referenced: the stored array must not be handed to a form
      // that mutates its draft, or editing would rewrite the row behind its back.
      secondaryMuscles: [...existing.secondaryMuscles],
      equipment: existing.equipment,
      measurementType: existing.measurementType,
      isUnilateral: existing.isUnilateral,
      bodyweightLoadFactor: existing.bodyweightLoadFactor,
      movementPattern: existing.movementPattern,
    });
  }

  const name = draft.name.trim();
  const supportsBodyweightFactor = supportsBodyweightLoad(draft.measurementType);
  const factorPercent =
    draft.bodyweightLoadFactor === undefined
      ? undefined
      : factorToPercent(draft.bodyweightLoadFactor);
  const factorInvalid = factorPercent !== undefined && !isValidBodyweightFactorPercent(factorPercent);

  /**
   * The primary muscle is never also a secondary one. Filtered here rather than
   * forbidden in the sheet: the primary can be changed *after* the secondaries
   * are picked, and a list that quietly contradicts the row above it is what
   * `ExerciseMusclesCard` was already filtering out at display time.
   */
  const secondaryMuscles = draft.secondaryMuscles.filter(
    (muscle) => muscle !== draft.primaryMuscle,
  );

  /**
   * Re-defaults the coefficient when the movement's nature changes — and only
   * while nobody has said otherwise.
   *
   * The test is "is it still on the default for what this exercise *was*". A
   * figure the lifter typed survives every later change of matériel; a default
   * they never looked at follows the movement, so switching "répétitions seules"
   * from a pull-up bar to an élastique empties it instead of leaving 100 % of a
   * body hanging off a rubber band.
   */
  const withBodyweightDefault = (next: Draft): Draft => ({
    ...next,
    bodyweightLoadFactor:
      draft.bodyweightLoadFactor ===
      defaultBodyweightLoadFactor(draft.measurementType, draft.equipment)
        ? defaultBodyweightLoadFactor(next.measurementType, next.equipment)
        : draft.bodyweightLoadFactor,
  });

  const submit = () => {
    if (name === '' || factorInvalid) return;

    const base = {
      name,
      primaryMuscle: draft.primaryMuscle,
      secondaryMuscles,
      equipment: draft.equipment,
      measurementType: draft.measurementType,
      isUnilateral: draft.isUnilateral,
      // Transmis même absent : à l'édition, `undefined` doit effacer la famille
      // au lieu de laisser l'ancienne valeur en place.
      movementPattern: draft.movementPattern,
    };
    const withFactor =
      supportsBodyweightFactor && draft.bodyweightLoadFactor !== undefined
        ? { ...base, bodyweightLoadFactor: draft.bodyweightLoadFactor }
        : base;

    if (editing && existing != null) {
      void updateExercise(existing.id, {
        ...withFactor,
        ...(supportsBodyweightFactor ? {} : { bodyweightLoadFactor: undefined }),
        // A coefficient the lifter typed is theirs; the catalogue stops
        // realigning it at the next launch (cf. `seedDatabase`).
        bodyweightLoadFactorIsCustom: 1,
      }).then(() => navigate(-1));
      return;
    }

    void createCustomExercise({ ...withFactor, bodyweightLoadFactorIsCustom: 1 }).then(
      (created) => {
        // Après la résolution, jamais avant : annoncer l'intention ferait
        // terminer une mission de création sur un exercice que Dexie aurait pu
        // refuser d'écrire.
        tutorial?.report({ type: 'exercise-created', exerciseId: created.id });
        // `replace`: going back from the new exercise returns to the library, not
        // to a form that would create a second copy.
        void navigate(`/exercises/${created.id}`, { replace: true });
      },
    );
  };

  return (
    <Screen
      title={editing ? t('exerciseForm.editTitle') : t('exerciseForm.createTitle')}
      onBack={() => void navigate(-1)}
    >
      <div className="flex flex-col gap-6">
        <Card padded>
          <Input
            label={t('exerciseForm.nameLabel')}
            tutorialId="exercise-name"
            placeholder={t('exerciseForm.namePlaceholder')}
            value={draft.name}
            autoFocus={!editing}
            enterKeyHint="done"
            onChange={(event) => {
              setDraft({ ...draft, name: event.target.value });
              tutorial?.report({ type: 'exercise-named', name: event.target.value });
            }}
          />
        </Card>

        {supportsBodyweightFactor && (
          <Card padded>
            <p className="mb-2 text-base font-medium text-[var(--text-1)]">
              {t('exerciseForm.bodyweightFactorLabel')}
            </p>
            <NumberInput
              aria-label={t('exerciseForm.bodyweightFactorLabel')}
              value={factorPercent}
              onChange={(value) =>
                setDraft({
                  ...draft,
                  bodyweightLoadFactor: value === undefined ? undefined : percentToFactor(value),
                })
              }
              step={5}
              min={0.1}
              max={100}
              suffix={t('units.percent')}
              placeholder={
                draft.measurementType === 'assisted_weight_reps'
                  ? t('exerciseForm.bodyweightFactorDefault')
                  : undefined
              }
            />
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
              {t('exerciseForm.bodyweightFactorHint')}
            </p>
            {factorInvalid && (
              <p role="alert" className="mt-1 text-sm text-[var(--danger-ink)]">
                {t('exerciseForm.bodyweightFactorError')}
              </p>
            )}
          </Card>
        )}

        <Card>
          <PickerRow
            label={t('exerciseForm.muscleLabel')}
            value={muscleLabel(draft.primaryMuscle)}
            onOpen={() => setPicker('muscle')}
          />
          {/* La seule ligne qui porte plusieurs réponses : sa lecture descend en
              sous-titre au lieu de disputer la ligne au libellé. « Muscles
              secondaires · Biceps · Haut du dos » sur 375 px tronquait le
              libellé lui-même — mesuré. */}
          <ListRow
            title={t('exerciseForm.secondaryMusclesLabel')}
            subtitle={secondaryMusclesReading(secondaryMuscles)}
            onClick={() => setPicker('secondaryMuscles')}
            trailing={<ChevronDownIcon className="text-[var(--text-2)]" />}
          />
          <PickerRow
            label={t('exerciseForm.equipmentLabel')}
            value={equipmentLabel(draft.equipment)}
            onOpen={() => setPicker('equipment')}
          />
          <PickerRow
            label={t('exerciseForm.measurementLabel')}
            tutorialId="exercise-measurement"
            value={measurementLabel(draft.measurementType)}
            onOpen={() => setPicker('measurement')}
          />
          {/* La famille de mouvement ne change rien à la séance : elle décide
              quels articles du wiki s'affichent sur la fiche. La laisser vide
              n'enlève ni les muscles ni les records, seulement l'explication
              d'une coopération que le corpus ne pourrait pas justifier. */}
          <PickerRow
            label={t('exerciseForm.movementPatternLabel')}
            value={
              draft.movementPattern === undefined
                ? t('exerciseForm.movementPatternNone')
                : movementPatternLabel(draft.movementPattern)
            }
            onOpen={() => setPicker('movement')}
          />
        </Card>

        <Card padded>
          <div
            role="radiogroup"
            aria-label={t('exerciseForm.unilateralLabel')}
            data-tutorial-id="exercise-unilateral"
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
                  onClick={() => {
                    setDraft({ ...draft, isUnilateral: value });
                    tutorial?.report({ type: 'exercise-unilateral-set', isUnilateral: value });
                  }}
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
        <Button
          variant="primary"
          size="lg"
          fullWidth
          tutorialId="exercise-save"
          disabled={name === '' || factorInvalid}
          onClick={submit}
        >
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

      <MultiOptionSheet<MuscleGroup>
        open={picker === 'secondaryMuscles'}
        onClose={() => setPicker(null)}
        title={t('exerciseForm.secondaryMusclesLabel')}
        hint={t('exerciseForm.secondaryMusclesHint')}
        // The primary muscle is not on offer: it is already answered one row up,
        // and a movement that "also works" what it mainly works says nothing.
        options={MUSCLE_OPTIONS.filter((option) => option.value !== draft.primaryMuscle)}
        values={secondaryMuscles}
        doneLabel={t('common.done')}
        onToggle={(muscle) =>
          setDraft({
            ...draft,
            secondaryMuscles: secondaryMuscles.includes(muscle)
              ? secondaryMuscles.filter((value) => value !== muscle)
              : [...secondaryMuscles, muscle],
          })
        }
      />

      <OptionSheet<Equipment>
        open={picker === 'equipment'}
        onClose={() => setPicker(null)}
        title={t('exerciseForm.equipmentLabel')}
        options={EQUIPMENT_OPTIONS}
        value={draft.equipment}
        onSelect={(equipment) => setDraft(withBodyweightDefault({ ...draft, equipment }))}
      />

      <OptionSheet<MovementPattern | ''>
        open={picker === 'movement'}
        onClose={() => setPicker(null)}
        title={t('exerciseForm.movementPatternLabel')}
        options={[
          { value: '', label: t('exerciseForm.movementPatternNone') },
          ...MOVEMENT_OPTIONS,
        ]}
        value={draft.movementPattern ?? ''}
        onSelect={(value) =>
          setDraft({ ...draft, movementPattern: value === '' ? undefined : value })
        }
      />

      <OptionSheet<MeasurementType>
        open={picker === 'measurement'}
        onClose={() => setPicker(null)}
        title={t('exerciseForm.measurementLabel')}
        options={MEASUREMENT_OPTIONS}
        value={draft.measurementType}
        /**
         * A default, not a blank. An exercise measured against the body with no
         * coefficient weighs **zero** in the tonnage — which is exactly how a
         * self-made pull-up came to count fourteen repetitions of nothing.
         * `lib/bodyweightLoad` decides the figure; the field above shows it, and
         * one tap changes it.
         */
        onSelect={(measurementType) => {
          setDraft(withBodyweightDefault({ ...draft, measurementType }));
          tutorial?.report({ type: 'exercise-measurement-set', measurementType });
        }}
      />
    </Screen>
  );
}
