import { barLayout } from '@/lib/analytics/plot';
import { ChartSurface } from './ChartSurface';
import { ColumnFrame, ZeroStub } from './ColumnFrame';

/**
 * Tonnage or duration, one column per observed week.
 *
 * The geometry is G2's because the contract is the same: length starts at zero,
 * an internal empty week is data, and a tap selects the closest week.
 *
 * The colour contract is deliberately different, and it is the *ink* that
 * differs, not the palette: every column is --accent-data, **none is ever
 * --accent-ink**, because volume has no goal and a large value is not something
 * the app congratulates. Uniform on purpose — the reader is meant to compare
 * heights, not to look for the one that lights up. The card says as much in a
 * sentence, so a flat colour reads as an answer rather than as the accent
 * failing to apply. Which is exactly how it was reported from the phone, back
 * when these bars were grey.
 */

const BOX = { width: 300, height: 120 };
const PAD = 6;
const SINGLE_BAR_WIDTH = 18;

interface Props {
  values: readonly number[];
  ceiling: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Read by a screen reader instead of the drawing. */
  summary: string;
}

export function WeeklyVolumeChart({
  values,
  ceiling,
  selectedIndex,
  onSelect,
  summary,
}: Props) {
  const bars = barLayout(values, BOX, ceiling).map((slot) =>
    values.length === 1
      ? { ...slot, x: slot.centerX - SINGLE_BAR_WIDTH / 2, width: SINGLE_BAR_WIDTH }
      : slot,
  );

  return (
    <ChartSurface
      box={BOX}
      pad={PAD}
      label={summary}
      xs={bars.map((slot) => slot.centerX)}
      onSelect={onSelect}
    >
      {bars.map((slot, index) =>
        slot.height > 0 ? (
          <rect
            key={index}
            x={slot.x}
            y={slot.y}
            width={slot.width}
            height={slot.height}
            rx={Math.min(2, slot.width / 2)}
            fill="var(--accent-data)"
          />
        ) : (
          <ZeroStub key={index} slot={slot} box={BOX} />
        ),
      )}

      {/* Baseline and cursor, shared with the sessions chart — cf. ColumnFrame. */}
      <ColumnFrame box={BOX} selected={bars[selectedIndex]} />
    </ChartSurface>
  );
}
