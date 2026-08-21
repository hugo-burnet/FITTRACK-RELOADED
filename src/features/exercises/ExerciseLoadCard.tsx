import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getLatestBodyWeight } from '@/data/repositories/bodyMeasurements';
import { updateExercise } from '@/data/repositories/exercises';
import { PLATE_LOADINGS } from '@/data/types';
import type { Exercise, PlateLoading } from '@/data/types';
import { t } from '@/i18n/fr';
import { plateLoadingHint, plateLoadingLabel } from '@/i18n/labels';
import {
  BODYWEIGHT_FACTOR_PRESETS,
  factorToPercent,
  isValidBodyweightFactorPercent,
  percentToFactor,
  supportsBodyweightLoad,
} from '@/lib/bodyweightLoad';
import {
  defaultPlateBaseWeightKg,
  plateBaseWeightMatters,
  resolvePlateBaseWeightKg,
  resolvePlateLoading,
} from '@/lib/plateLoading';
import { measurementShape } from '@/lib/measurement';
import { computePlateLoad } from '@/lib/plates';
import { Card, ListRow, NumberInput, OptionSheet, SectionTitle } from '@/ui';
import type { Option } from '@/ui';
import { ChevronDownIcon } from '@/ui/icons';
import { formatNumber } from '@/ui/numberField';

const PLATE_LOADING_OPTIONS: Option<PlateLoading>[] = PLATE_LOADINGS.map((loading) => ({
  value: loading,
  label: plateLoadingLabel(loading),
  hint: plateLoadingHint(loading),
}));

/**
 * « Charge » — the two answers the app was guessing, moved onto the exercise
 * that actually knows them.
 *
 * **The coefficient.** An exercise measured against the body with no coefficient
 * weighs zero kilograms in the tonnage, and until now nothing on any screen said
 * so: an unweighted pull-up recorded fourteen repetitions and no load at all.
 * The figure is a row here, on the sheet of *every* exercise — not only the ones
 * you made yourself, because "Extension lombaire" is a catalogue row and it is
 * exactly the kind that carries nothing.
 *
 * **The loading.** `equipment` says what a movement is done on; it never said how
 * the iron is hung. Guessing from the hardware meant a belt squat, a held disc
 * and a loadable dumbbell all got the same wrong answer, and a great many
 * exercises that do take plates got none at all. Now the exercise says, in one
 * of four words, and the session's "Plaques à charger" follows it.
 *
 * Written straight through to Dexie like the notes and the rest above it: there
 * is nothing to submit on this sheet, only somewhere to go.
 */
export function ExerciseLoadCard({ exercise }: { exercise: Exercise }) {
  const [picker, setPicker] = useState(false);
  const bodyWeight = useLiveQuery(getLatestBodyWeight);

  const supportsFactor = supportsBodyweightLoad(exercise.measurementType);
  /**
   * A plank and a rower have no kilos to break down at all — no weight field,
   * nothing to stack. Asked here rather than in `lib/plateLoading`: the engine
   * answers "how is it loaded", and "is there a load" is the measurement type's
   * question, which `lib/measurement` already owns.
   */
  const takesWeight = measurementShape(exercise.measurementType).weightRole !== undefined;
  const loading = resolvePlateLoading(exercise);
  const baseWeightKg = resolvePlateBaseWeightKg(exercise);
  const baseWeightMatters = loading !== 'none' && plateBaseWeightMatters(loading);

  // Neither question applies: no card at all rather than a heading over nothing.
  if (!supportsFactor && !takesWeight) return null;

  const write = (changes: Partial<Exercise>) => void updateExercise(exercise.id, changes);

  return (
    <section>
      <SectionTitle>{t('exercise.loadSection')}</SectionTitle>
      <Card>
        {supportsFactor && (
          <BodyweightFactorRow
            exercise={exercise}
            bodyWeightKnown={bodyWeight !== undefined}
            onChange={(bodyweightLoadFactor) =>
              // The flag travels with the figure: from here on the catalogue
              // stops realigning this exercise's coefficient at every launch.
              write({ bodyweightLoadFactor, bodyweightLoadFactorIsCustom: 1 })
            }
          />
        )}

        {takesWeight && (
          <ListRow
            title={t('exercise.plateLoadingLabel')}
            subtitle={t('exercise.plateLoadingHint')}
            onClick={() => setPicker(true)}
            trailing={
              <span className="flex items-center gap-1 text-base text-[var(--text-1)]">
                {plateLoadingLabel(loading)}
                <ChevronDownIcon className="text-[var(--text-2)]" />
              </span>
            }
          />
        )}

        {takesWeight && loading !== 'none' && (
          <div className="border-t border-[var(--border)] p-4">
            <p className="label-xs mb-2 font-semibold text-[var(--text-2)]">
              {baseWeightMatters
                ? t('exercise.plateBaseWeightLabel')
                : t('exercise.plateBaseWeightMachineLabel')}
            </p>
            <NumberInput
              aria-label={
                baseWeightMatters
                  ? t('exercise.plateBaseWeightLabel')
                  : t('exercise.plateBaseWeightMachineLabel')
              }
              value={exercise.plateBaseWeightKg}
              onChange={(plateBaseWeightKg) => write({ plateBaseWeightKg })}
              step={2.5}
              min={0}
              max={100}
              suffix={t('units.kg')}
              placeholder={formatNumber(defaultPlateBaseWeightKg(loading))}
            />
            <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
              {baseWeightMatters
                ? t('exercise.plateBaseWeightBarHint')
                : t('exercise.plateBaseWeightMachineHint')}
            </p>
            <PlatePreview loading={loading} baseWeightKg={baseWeightKg} />
          </div>
        )}
      </Card>

      <OptionSheet<PlateLoading>
        open={picker}
        onClose={() => setPicker(false)}
        title={t('exercise.plateLoadingLabel')}
        options={PLATE_LOADING_OPTIONS}
        value={loading}
        onSelect={(plateLoading) => write({ plateLoading })}
      />
    </section>
  );
}

/**
 * The coefficient as four presets and a field, rather than an empty percent box.
 *
 * A box that starts blank is a box that stays blank, and a blank one is what
 * made the repetitions weigh nothing. The presets are the three real answers —
 * a whole body, a squat, a push-up — plus the one that says "leave my body out
 * of this", which has to be as reachable as the others: a crunch is honestly not
 * 100 % of a lifter.
 */
function BodyweightFactorRow({
  exercise,
  bodyWeightKnown,
  onChange,
}: {
  exercise: Exercise;
  bodyWeightKnown: boolean;
  onChange: (factor: number | undefined) => void;
}) {
  const percent =
    exercise.bodyweightLoadFactor === undefined
      ? undefined
      : factorToPercent(exercise.bodyweightLoadFactor);
  const invalid = percent !== undefined && !isValidBodyweightFactorPercent(percent);

  return (
    <div className="p-4">
      <p className="label-xs mb-2 font-semibold text-[var(--text-2)]">
        {t('exercise.bodyweightFactorLabel')}
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        {BODYWEIGHT_FACTOR_PRESETS.map((preset) => (
          <PresetChip
            key={preset}
            label={t('exercise.bodyweightFactorPreset', { percent: preset })}
            selected={percent === preset}
            onClick={() => onChange(percentToFactor(preset))}
          />
        ))}
        <PresetChip
          label={t('exercise.bodyweightFactorNone')}
          selected={percent === undefined}
          onClick={() => onChange(undefined)}
        />
      </div>

      <NumberInput
        aria-label={t('exercise.bodyweightFactorLabel')}
        value={percent}
        onChange={(value) => onChange(value === undefined ? undefined : percentToFactor(value))}
        step={5}
        min={0.1}
        max={100}
        suffix={t('units.percent')}
        placeholder={t('exercise.bodyweightFactorNone')}
      />

      <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
        {t('exercise.bodyweightFactorHint')}
      </p>

      {invalid && (
        <p role="alert" className="mt-1 text-sm text-[var(--danger-ink)]">
          {t('exercise.bodyweightFactorError')}
        </p>
      )}

      {/* A coefficient with no body weight behind it still counts nothing, and
          saying so here is cheaper than letting the totals stay at zero and
          hoping the tonnage card gets read. */}
      {percent !== undefined && !bodyWeightKnown && (
        <p className="mt-3 text-sm leading-relaxed text-[var(--accent-ink)]">
          {t('exercise.bodyweightFactorMissingWeight')}
        </p>
      )}
    </div>
  );
}

function PresetChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`metric min-h-12 rounded-xl border px-4 text-sm
        transition-[background-color,border-color,color,transform] duration-[var(--dur-1)]
        ease-[var(--ease-mech)] active:scale-[0.97]
        ${
          selected
            ? `border-[var(--color-accent)] bg-[var(--color-accent)] font-bold
              text-[var(--color-accent-fg)]`
            : 'border-[var(--border)] bg-[var(--surface-2)] font-medium text-[var(--text-2)]'
        }`}
    >
      {label}
    </button>
  );
}

/** One worked example, so the setting is checked against iron and not against prose. */
function PlatePreview({
  loading,
  baseWeightKg,
}: {
  loading: Exclude<PlateLoading, 'none'>;
  baseWeightKg: number;
}) {
  // A load the example can actually reach on any rack, and always above the base.
  const exampleKg = baseWeightKg + (loading === 'single_sided' ? 20 : 40);
  const load = computePlateLoad(exampleKg, {
    barWeight: baseWeightKg,
    sides: loading === 'single_sided' ? 1 : 2,
  });
  const reading = load.perSide
    .map((plate) =>
      plate.count > 1
        ? t('workout.platesReadingPlate', {
            count: plate.count,
            weight: formatNumber(plate.weight),
          })
        : formatNumber(plate.weight),
    )
    .join(' · ');

  return (
    <p className="mt-3 flex items-baseline justify-between gap-3 rounded-xl bg-[var(--surface-2)] px-3 py-2">
      <span className="label-xs font-semibold text-[var(--text-2)]">
        {t('exercise.plateLoadingPreviewLabel', { weight: formatNumber(exampleKg) })}
      </span>
      <span className="metric text-base text-[var(--text-1)]">
        {reading === ''
          ? t('exercise.plateLoadingPreviewNone', { weight: formatNumber(exampleKg) })
          : `${reading} ${t(loading === 'single_sided' ? 'workout.platesOneSide' : 'workout.platesPerSide').toLowerCase()}`}
      </span>
    </p>
  );
}
