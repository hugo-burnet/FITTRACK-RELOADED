import { useState } from 'react';
import type { PlateLoading } from '@/data/types';
import { t } from '@/i18n/fr';
import { plateLoadingLabel } from '@/i18n/labels';
import { plateBaseWeightMatters } from '@/lib/plateLoading';
import {
  computePlateLoad,
  DEFAULT_PLATES_KG,
  type PlateCount,
  type PlateInventory,
} from '@/lib/plates';
import { NumberInput } from '@/ui';
import { ChevronDownIcon } from '@/ui/icons';
import { formatNumber } from '@/ui/numberField';
import { Sheet } from '@/ui/Sheet';

/** kg → the slab's on-screen height. Heavier reads taller, like the real disc. */
function slabHeight(weightKg: number): number {
  // Square-rooted so the light plates stay visible next to a 25 rather than
  // collapsing to a sliver. Clamped to a legible band.
  const ratio = Math.sqrt(Math.min(weightKg, 25) / 25);
  return Math.round(22 + 46 * ratio);
}

function slabWidth(weightKg: number): number {
  const ratio = Math.sqrt(Math.min(weightKg, 25) / 25);
  return Math.round(9 + 12 * ratio);
}

/** perSide, but one entry per physical plate — heaviest nearest the collar. */
function expand(perSide: PlateCount[]): number[] {
  return perSide.flatMap((plate) => Array<number>(plate.count).fill(plate.weight));
}

/** "2 × 25 · 15 · 1,25" — grouped counts, middot-separated like the rest of the app. */
function readingLine(perSide: PlateCount[]): string {
  return perSide
    .map((plate) =>
      plate.count > 1
        ? t('workout.platesReadingPlate', {
            count: plate.count,
            weight: formatNumber(plate.weight),
          })
        : formatNumber(plate.weight),
    )
    .join(' · ');
}

type Props = {
  open: boolean;
  onClose: () => void;
  /**
   * The exercise's distinct loads, in kg, in the order they appear. One diagram
   * is drawn per load: a heavy set and its back-off set hang different iron on
   * the same bar, so a single figure for the whole exercise would be wrong for
   * every set but one.
   */
  loads: number[];
  barWeight: number;
  sides: number;
  /**
   * How the exercise says it is loaded. Drives every word on this sheet: "de
   * chaque côté" is a lie over a dip belt, and "poids de la barre" is a lie over
   * a sled. The sheet reads the setting, it never decides it — that lives on the
   * exercise's own sheet.
   */
  loading: Exclude<PlateLoading, 'none'>;
  onBarWeightChange: (barWeight: number) => void;
  availablePlateWeightsKg: readonly number[];
  onAvailablePlateWeightsChange: (weights: number[]) => void | Promise<void>;
};

/**
 * The plate calculator's face (RF-28): the one question you ask at the rack with
 * cold hands — what hangs on each side to reach this number.
 *
 * The signature is a **head-on barbell**: a steel sleeve with the plates you load
 * drawn as slabs, heaviest against the collar, their height carrying their
 * weight. It is monochrome ink on purpose — the charter's single accent is spent
 * on records and validated sets, and six colour-coded plates would both break
 * that rule and fail the contrast floor the app holds itself to. The diagram is
 * the glance; the reading under it is the exact answer.
 */
export function PlateLoadSheet({
  open,
  onClose,
  loads,
  barWeight,
  sides,
  loading,
  onBarWeightChange,
  availablePlateWeightsKg,
  onAvailablePlateWeightsChange,
}: Props) {
  const [availablePlatesSaveFailed, setAvailablePlatesSaveFailed] = useState(false);
  const baseWeightLabel = plateBaseWeightMatters(loading)
    ? t('workout.platesBarWeight')
    : t('workout.platesBaseWeight');
  const inventory: PlateInventory = availablePlateWeightsKg.map((weight) => ({ weight }));

  const toggleAvailablePlate = async (weight: number) => {
    const selected = availablePlateWeightsKg.includes(weight);
    const next = DEFAULT_PLATES_KG.filter((option) =>
      option === weight ? !selected : availablePlateWeightsKg.includes(option),
    );

    try {
      await onAvailablePlateWeightsChange(next);
      setAvailablePlatesSaveFailed(false);
    } catch {
      setAvailablePlatesSaveFailed(true);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('workout.platesTitle')}>
      <div className="pb-2">
        {/* Always here, whatever the mode. It used to appear for a bar and hide
            for everything else, which left a plate machine's 12 kg carriage
            uncorrectable and its diagram quietly wrong. The label changes with
            the mode; the field does not come and go. */}
        <div className="mb-6 flex flex-col gap-2 border-b border-[var(--border)] pb-6">
          <div className="flex items-baseline justify-between gap-3">
            <span className="label-xs font-semibold text-[var(--text-2)]">{baseWeightLabel}</span>
            <span className="text-sm text-[var(--text-2)]">{plateLoadingLabel(loading)}</span>
          </div>
          {/* Keyed on `open` so every opening starts from the stored weight: a
              field left empty must not come back empty over a bar that is still
              20 kg. `Sheet` does drop its children, but only once the closing
              transition has run — not a guarantee to hang the field's
              correctness on. */}
          <BarWeightField
            key={String(open)}
            label={baseWeightLabel}
            weight={barWeight}
            onChange={onBarWeightChange}
          />
          <p className="text-sm leading-relaxed text-[var(--text-2)]">
            {t('workout.platesSettingsLink')}
          </p>
        </div>

        <details className="group mb-6 border-b border-[var(--border)] pb-6">
          <summary
            className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-xl
              px-1 text-left active:bg-[var(--surface-2)]
              focus-visible:[outline-color:var(--text-2)]
              [&::-webkit-details-marker]:hidden"
          >
            <span className="min-w-0 flex-1 text-base font-semibold text-[var(--text-1)]">
              {t('workout.platesAvailable')}
            </span>
            <span className="metric text-sm text-[var(--text-2)]">
              {t('workout.platesAvailableCount', {
                selected: availablePlateWeightsKg.length,
                total: DEFAULT_PLATES_KG.length,
              })}
            </span>
            <ChevronDownIcon
              aria-hidden="true"
              className="shrink-0 text-[var(--text-2)] transition-transform
                duration-[var(--dur-1)] group-open:rotate-180"
            />
          </summary>

          <div className="grid grid-cols-5 gap-2 pt-3">
            {DEFAULT_PLATES_KG.map((weight) => {
              const selected = availablePlateWeightsKg.includes(weight);
              const label = t('workout.platesAvailableOption', {
                weight: formatNumber(weight),
              });

              return (
                <button
                  key={weight}
                  type="button"
                  aria-pressed={selected}
                  aria-label={label}
                  onClick={() => void toggleAvailablePlate(weight)}
                  className={`metric min-h-12 rounded-xl border px-1 text-xs
                    transition-[box-shadow,border-color,background-color,color]
                    duration-[var(--dur-1)] focus-visible:[outline-color:var(--text-2)]
                    ${
                      selected
                        ? `border-[var(--text-2)] bg-[var(--text-2)] font-bold
                          text-[var(--surface-0)] ring-1 ring-inset ring-[var(--text-2)]`
                        : `border-[var(--border)] bg-[var(--surface-2)] font-medium
                          text-[var(--text-2)]`
                    }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {availablePlateWeightsKg.length === 0 && (
            <p className="mt-3 text-sm text-[var(--text-2)]">
              {t('workout.platesAvailableEmpty')}
            </p>
          )}

          {availablePlatesSaveFailed && (
            <p role="alert" className="mt-3 text-sm font-medium text-[var(--danger-ink)]">
              {t('workout.platesAvailableSaveError')}
            </p>
          )}
        </details>

        {loads.map((weightKg, index) => (
          <PlateBlock
            key={index}
            weightKg={weightKg}
            barWeight={barWeight}
            sides={sides}
            loading={loading}
            inventory={inventory}
            // Each further load is set off by a divider: the loads are a list of
            // separate answers, not one reading that runs together.
            divided={index > 0}
          />
        ))}

      </div>
    </Sheet>
  );
}

/**
 * The bar weight field, holding a draft that is allowed to be empty.
 *
 * The weight kept outside is a `number` — it is stored — so an emptied field has
 * nothing to hand it. Sending 0 in its place was the previous answer, and it
 * made the field impossible to retype: `NumberInput` resynchronises its text
 * from `value` during render, so the 0 landed straight back in the field that
 * had just been cleared and every following keystroke fell in behind that zero
 * — "22,5" typed as "022,5", measured at 375 px. The draft carries the empty
 * state instead, and only a real number is forwarded: the stored weight — and
 * the diagrams below, which are drawn from it — stay on the last value the
 * lifter actually entered until they finish typing the next one.
 */
function BarWeightField({
  label,
  weight,
  onChange,
}: {
  label: string;
  weight: number;
  onChange: (barWeight: number) => void;
}) {
  const [draft, setDraft] = useState<number | undefined>(weight);
  const [lastWeight, setLastWeight] = useState(weight);

  // A weight arriving from outside replaces the draft. Adjusted during render
  // rather than in an effect, for the same reason as `NumberInput`: an effect
  // would paint one frame of the previous bar first.
  if (weight !== lastWeight) {
    setLastWeight(weight);
    setDraft(weight);
  }

  return (
    <NumberInput
      value={draft}
      onChange={(value) => {
        setDraft(value);
        if (value !== undefined) onChange(value);
      }}
      min={0}
      max={Number.MAX_SAFE_INTEGER}
      step={2.5}
      suffix={t('units.kg')}
      focusTone="neutral"
      aria-label={label}
    />
  );
}

/** One load's answer: the weight, the head-on bar, and the exact per-side reading. */
function PlateBlock({
  weightKg,
  barWeight,
  sides,
  loading,
  inventory,
  divided,
}: {
  weightKg: number;
  barWeight: number;
  sides: number;
  loading: Exclude<PlateLoading, 'none'>;
  inventory: PlateInventory;
  divided: boolean;
}) {
  const load = computePlateLoad(weightKg, { barWeight, sides, inventory });
  const slabs = expand(load.perSide);
  const onOneSide = sides === 1;
  const bar = plateBaseWeightMatters(loading);
  const reading =
    slabs.length === 0
      ? bar
        ? t('workout.platesEmpty')
        : t('workout.platesEmptyOneSide')
      : readingLine(load.perSide);

  return (
    <div className={divided ? 'mt-6 border-t border-[var(--border)] pt-6' : ''}>
      <p className="text-center">
        <span className="metric text-4xl text-[var(--text-1)]">
          {t('workout.platesTotalReading', { weight: formatNumber(weightKg) })}
        </span>
      </p>

      {load.belowBar ? (
        <p className="mt-4 text-center text-sm text-[var(--text-2)]">
          {t(bar ? 'workout.platesBelowBar' : 'workout.platesBelowBase', {
            weight: formatNumber(barWeight),
          })}
        </p>
      ) : (
        <>
          {/* The head-on bar. Hidden from assistive tech — the reading below
              says the same thing in words. */}
          <div aria-hidden="true" className="mt-6 flex items-center justify-center overflow-x-auto">
            {/* The sleeve, running toward the lifter. */}
            <span className="h-2 w-7 shrink-0 rounded-l-sm bg-[var(--text-2)]" />
            {slabs.map((weight, index) => (
              <span
                key={index}
                style={{ height: slabHeight(weight), width: slabWidth(weight) }}
                className="shrink-0 rounded-sm border border-[var(--border)] bg-[var(--surface-2)]"
              />
            ))}
            {/* The sleeve tip past the last plate, where the collar clamps. */}
            <span className="h-2 w-3 shrink-0 rounded-r-sm bg-[var(--text-2)]" />
          </div>

          <p className="label-xs mt-5 text-center font-semibold text-[var(--text-2)]">
            {t(onOneSide ? 'workout.platesOneSide' : 'workout.platesPerSide')}
          </p>
          <p className="metric mt-1.5 text-center text-lg text-[var(--text-1)]">{reading}</p>

          {/* Read aloud for a screen reader in place of the diagram. */}
          <p className="sr-only">
            {t(onOneSide ? 'workout.platesAriaOneSide' : 'workout.platesAria', {
              plates: reading,
            })}
          </p>

          {load.remainderKg > 0 && (
            <p className="mt-2 text-center text-sm text-[var(--text-2)]">
              {t('workout.platesRemainder', { weight: formatNumber(load.remainderKg) })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
