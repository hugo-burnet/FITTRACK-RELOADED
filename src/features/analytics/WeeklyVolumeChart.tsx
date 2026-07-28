import { barLayout } from '@/lib/analytics/plot';
import { ChartSurface } from './ChartSurface';

/**
 * Tonnage or duration, one column per observed week.
 *
 * The geometry is G2's because the contract is the same: length starts at zero,
 * an internal empty week is data, and a tap selects the closest week. The
 * colour contract is deliberately different: volume has no goal and a large
 * value is not something the app congratulates.
 */

const BOX = { width: 300, height: 120 };
const PAD = 6;
const ZERO_STUB = 4;
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
      {bars[selectedIndex] !== undefined && (
        <rect
          x={bars[selectedIndex]!.x - bars[selectedIndex]!.width * 0.25}
          y={-PAD}
          width={bars[selectedIndex]!.width * 1.5}
          height={BOX.height + PAD * 2}
          rx={2}
          fill="none"
          stroke="var(--text-2)"
          strokeWidth={1}
        />
      )}

      {bars.map((slot, index) =>
        slot.height > 0 ? (
          <rect
            key={index}
            x={slot.x}
            y={slot.y}
            width={slot.width}
            height={slot.height}
            rx={Math.min(2, slot.width / 2)}
            fill="var(--text-2)"
          />
        ) : (
          <rect
            key={index}
            x={slot.x}
            y={BOX.height - ZERO_STUB}
            width={slot.width}
            height={ZERO_STUB}
            rx={1}
            fill="var(--text-2)"
          />
        ),
      )}

      <line
        x1={0}
        y1={BOX.height}
        x2={BOX.width}
        y2={BOX.height}
        stroke="var(--text-2)"
        strokeWidth={1}
      />
    </ChartSurface>
  );
}
