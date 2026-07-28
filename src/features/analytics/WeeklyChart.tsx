import { barLayout } from '@/lib/analytics/plot';
import type { WeekBucket } from '@/lib/analytics/weeks';
import { ChartSurface } from './ChartSurface';

/**
 * The histogram. Same hand-drawn SVG as the curve, same `ChartSurface`, and
 * deliberately not the same geometry — cf. the spec of G2, §6.
 *
 * **One thing is coloured: the week that reached its goal.** The charte reserves
 * the accent for primary actions, **validated sets** and records. A week that
 * holds its target is a validated week in the exact sense a ticked set is: a
 * commitment made, then kept. Same green, same fact, another scale. At arm's
 * length the green bars are the rhythm and the grey ones are the gaps.
 *
 * **No grid.** The one rule drawn is the baseline the bars stand on — and a bar
 * needs it, because its length is measured from zero and a week at zero would
 * otherwise be whitespace indistinguishable from a margin.
 */

const BOX = { width: 300, height: 120 };
/** Small: nothing overshoots sideways, and nothing is drawn above the ceiling. */
const PAD = 6;
/**
 * The mark a week with **no** session gets, in the tone of the baseline.
 *
 * Reported from use: an empty week drew nothing at all, so the eye read a gap
 * in the spacing rather than a column at zero — and once the rhythm of the
 * columns is broken, every other height looks arbitrary. Three pixels of the
 * axis's own colour say "this week exists, and it is zero" without ever reading
 * as a small quantity.
 */
const ZERO_STUB = 4;

interface Props {
  buckets: readonly WeekBucket[];
  /** The top of the scale: the largest count, the largest goal, or 1. */
  ceiling: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Read by a screen reader instead of the drawing. */
  summary: string;
}

export function WeeklyChart({ buckets, ceiling, selectedIndex, onSelect, summary }: Props) {
  const bars = barLayout(
    buckets.map((bucket) => bucket.sessions),
    BOX,
    ceiling,
  ).map((slot, index) => ({ slot, bucket: buckets[index]! }));

  return (
    <ChartSurface
      box={BOX}
      pad={PAD}
      label={summary}
      xs={bars.map(({ slot }) => slot.centerX)}
      onSelect={onSelect}
    >
      {/* Selection is the lit **slot**, drawn first so everything sits on top of
          it. Not a change of the bar's colour — that made the selected week read
          as a third category rather than as a cursor, and it was unreadable on a
          week at zero, which has no surface to recolour. Not a ring either: a
          ring around a bar of height zero encloses nothing, and the empty week
          is precisely the one worth tapping. A lit column works at any height,
          including none. */}
      {bars[selectedIndex] !== undefined && (
        <rect
          x={bars[selectedIndex]!.slot.x - bars[selectedIndex]!.slot.width * 0.25}
          // Crossing the baseline, top and bottom, because **no bar ever does**:
          // a block that stops at the axis is read as a value, and that is the
          // mistake the previous version made in white.
          y={-PAD}
          width={bars[selectedIndex]!.slot.width * 1.5}
          height={BOX.height + PAD * 2}
          rx={2}
          fill="var(--surface-2)"
        />
      )}

      {bars.map(({ slot, bucket }) => {
        const reached = bucket.goal !== null && bucket.sessions >= bucket.goal;

        return slot.height > 0 ? (
          <rect
            key={bucket.weekStart}
            x={slot.x}
            y={slot.y}
            width={slot.width}
            height={slot.height}
            rx={Math.min(2, slot.width / 2)}
            fill={reached ? 'var(--accent-ink)' : 'var(--text-2)'}
          />
        ) : (
          <rect
            key={bucket.weekStart}
            x={slot.x}
            y={BOX.height - ZERO_STUB}
            width={slot.width}
            height={ZERO_STUB}
            rx={1}
            fill="var(--border)"
          />
        );
      })}

      {/* The zero the bars stand on. Not a grid — the one line without which a
          week at zero cannot be seen at all. */}
      <line
        x1={0}
        y1={BOX.height}
        x2={BOX.width}
        y2={BOX.height}
        stroke="var(--border)"
        strokeWidth={1}
      />
    </ChartSurface>
  );
}
