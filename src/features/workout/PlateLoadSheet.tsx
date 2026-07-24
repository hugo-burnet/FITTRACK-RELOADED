import { t } from '@/i18n/fr';
import { computePlateLoad, type PlateCount } from '@/lib/plates';
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
export function PlateLoadSheet({ open, onClose, loads, barWeight, sides }: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={t('workout.platesTitle')}>
      <div className="pb-2">
        {loads.map((weightKg, index) => (
          <PlateBlock
            key={index}
            weightKg={weightKg}
            barWeight={barWeight}
            sides={sides}
            // Each further load is set off by a divider: the loads are a list of
            // separate answers, not one reading that runs together.
            divided={index > 0}
          />
        ))}

        <p className="mt-6 border-t border-[var(--border)] pt-4 text-center text-sm text-[var(--text-2)]">
          {t('workout.platesBar', { weight: formatNumber(barWeight) })}
        </p>
      </div>
    </Sheet>
  );
}

/** One load's answer: the weight, the head-on bar, and the exact per-side reading. */
function PlateBlock({
  weightKg,
  barWeight,
  sides,
  divided,
}: {
  weightKg: number;
  barWeight: number;
  sides: number;
  divided: boolean;
}) {
  const load = computePlateLoad(weightKg, { barWeight, sides });
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
