import { useId, useState } from 'react';
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
import { Card, ChoiceChip, NumberInput, OptionSheet, SectionTitle } from '@/ui';
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
          <PlateLoadingRow
            loading={loading}
            separated={supportsFactor}
            onOpen={() => setPicker(true)}
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
 * « Chargement en disques », posé comme les autres réglages de la carte.
 *
 * **C'était une `ListRow`, et la ligne ne tenait pas.** Le titre et la valeur se
 * disputaient la même largeur : sur un téléphone de 375 px, « Chargement en
 * disques » se coupait en « Chargement en d… » pendant que « Deux côtés, sans
 * barre » poussait la phrase d'aide dans une colonne de trois lignes. Deux
 * textes longs de part et d'autre d'une même ligne ne rentrent pas, et aucun
 * réglage de troncature ne rend ça lisible.
 *
 * Alors le réglage prend la forme des deux autres blocs de la carte : le nom en
 * intitulé au-dessus, la valeur dans un champ pleine largeur, l'explication
 * dessous. Rien n'est tronqué, la phrase d'aide retrouve toute la largeur, et la
 * carte se lit d'un seul mouvement de haut en bas.
 *
 * Le champ ressemble à celui de `NumberInput` — même fond, même rayon, même
 * hauteur — parce qu'il fait la même chose : il porte une valeur qu'on change.
 */
function PlateLoadingRow({
  loading,
  separated,
  onOpen,
}: {
  loading: PlateLoading;
  /** Un liseré seulement s'il y a un bloc au-dessus dont il faut se détacher. */
  separated: boolean;
  onOpen: () => void;
}) {
  const labelId = useId();
  const valueId = useId();

  return (
    <div className={`p-4 ${separated ? 'border-t border-[var(--border)]' : ''}`}>
      <p id={labelId} className="label-xs mb-2 font-semibold text-[var(--text-2)]">
        {t('exercise.plateLoadingLabel')}
      </p>

      {/* Nommé par ses deux textes, dans l'ordre où l'œil les lit : « Chargement
          en disques, Deux côtés, sans barre ». L'intitulé au-dessus est déjà
          référencé ici, donc il n'est pas lu deux fois. */}
      <button
        type="button"
        onClick={onOpen}
        aria-labelledby={`${labelId} ${valueId}`}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg
          bg-[var(--surface-2)] px-4 py-2 text-left transition-colors duration-[var(--dur-1)]
          active:bg-[var(--surface-1)]"
      >
        <span id={valueId} className="min-w-0 text-base text-[var(--text-1)]">
          {plateLoadingLabel(loading)}
        </span>
        <ChevronDownIcon className="shrink-0 text-[var(--text-2)]" />
      </button>

      <p className="mt-3 text-sm leading-relaxed text-[var(--text-2)]">
        {t('exercise.plateLoadingHint')}
      </p>
    </div>
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

      {/* La valeur d'abord, et elle se tape : les préréglages sont des raccourcis
          vers ce champ, pas l'inverse. Le repos range ses commandes dans cet
          ordre-là — le réglage, ses raccourcis, le mode, puis la phrase qui
          explique — et la charge disait la même chose à l’envers. */}
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

      {/* Une grille, pas une rangée qui passe à la ligne : à largeur de contenu
          les quatre chips ne font pas la même taille et « 100 % » pèse plus que
          « 50 % » sans rien vouloir dire de plus. Même raison que la grille du
          repos, qui porte déjà cette leçon en commentaire. */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        {BODYWEIGHT_FACTOR_PRESETS.map((preset) => (
          <ChoiceChip
            key={preset}
            numeric
            fill
            label={t('exercise.bodyweightFactorPreset', { percent: preset })}
            active={percent === preset}
            onClick={() => onChange(percentToFactor(preset))}
          />
        ))}
      </div>

      {/* Sur sa propre ligne et en accent doux : « Non comptée » est un mode, pas
          un cinquième pourcentage. Rangé parmi les valeurs et en aplat plein, il
          criait plus fort qu'elles en disant exactement l'inverse. */}
      <div className="mt-2">
        <ChoiceChip
          label={t('exercise.bodyweightFactorNone')}
          active={percent === undefined}
          fill
          quietActive
          onClick={() => onChange(undefined)}
        />
      </div>

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
