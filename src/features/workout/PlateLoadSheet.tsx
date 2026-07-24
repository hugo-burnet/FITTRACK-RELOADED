import { useState } from 'react';
import { t } from '@/i18n/fr';
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
  barWeightAdjustable: boolean;
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
  barWeightAdjustable,
  onBarWeightChange,
  availablePlateWeightsKg,
  onAvailablePlateWeightsChange,
}: Props) {
  const [availablePlatesSaveFailed, setAvailablePlatesSaveFailed] = useState(false);
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
        {barWeightAdjustable && (
          <div className="mb-6 flex flex-col gap-2 border-b border-[var(--border)] pb-6">
            <span className="label-xs font-semibold text-[var(--text-2)]">
              {t('workout.platesBarWeight')}
            </span>
            <NumberInput
              value={barWeight}
              onChange={(value) => onBarWeightChange(value ?? 0)}
              min={0}
              max={Number.MAX_SAFE_INTEGER}
              step={2.5}
              suffix={t('units.kg')}
              focusTone="neutral"
              aria-label={t('workout.platesBarWeight')}
            />
          </div>
        )}

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
            inventory={inventory}
            // Each further load is set off by a divider: the loads are a list of
            // separate answers, not one reading that runs together.
            divided={index > 0}
          />
        ))}

        {!barWeightAdjustable && (
          <p
            className="mt-6 border-t border-[var(--border)] pt-4 text-center text-sm
              text-[var(--text-2)]"
          >
            {t('workout.platesMachineBase', { weight: formatNumber(barWeight) })}
          </p>
        )}
      </div>
    </Sheet>
  );
}

/** One load's answer: the weight, the head-on bar, and the exact per-side reading. */
function PlateBlock({
  weightKg,
  barWeight,
  sides,
  inventory,
  divided,
}: {
  weightKg: number;
  barWeight: number;
  sides: number;
  inventory: PlateInventory;
  divided: boolean;
}) {
  const load = computePlateLoad(weightKg, { barWeight, sides, inventory });
  const slabs = expand(load.perSide);
  const reading = slabs.length === 0 ? t('workout.platesEmpty') : readingLine(load.perSide);

  return (
    <div className={divided ? 'mt-6 border-t border-[var(--border)] pt-6' : ''}>
      <p className="text-center">
        <span className="metric text-4xl text-[var(--text-1)]">
          {t('workout.platesTotalReading', { weight: formatNumber(weightKg) })}
        </span>
      </p>

      {load.belowBar ? (
        <p className="mt-4 text-center text-sm text-[var(--text-2)]">
          {t('workout.platesBelowBar', { weight: formatNumber(barWeight) })}
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
            {t('workout.platesPerSide')}
          </p>
          <p className="metric mt-1.5 text-center text-lg text-[var(--text-1)]">{reading}</p>

          {/* Read aloud for a screen reader in place of the diagram. */}
          <p className="sr-only">{t('workout.platesAria', { plates: reading })}</p>

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
