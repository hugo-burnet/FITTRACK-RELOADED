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
/** Small: nothing overshoots sideways, and the selection mark sits under the
 *  baseline rather than around a bar. */
const PAD = 6;
/** Where the selection tick is drawn, below the baseline. */
const TICK = 4;

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
      {bars.map(({ slot, bucket }, index) => {
        const reached = bucket.goal !== null && bucket.sessions >= bucket.goal;
        const isSelected = index === selectedIndex;

        return (
          <g key={bucket.weekStart}>
            {slot.height > 0 && (
              <rect
                x={slot.x}
                y={slot.y}
                width={slot.width}
                height={slot.height}
                rx={Math.min(2, slot.width / 2)}
                fill={
                  reached
                    ? 'var(--accent-ink)'
                    : isSelected
                      ? 'var(--text-1)'
                      : 'var(--text-2)'
                }
              />
            )}

            {/* Selection is a mark under the baseline, not a ring around the
                bar: a ring around a bar of height zero encloses nothing, and
                the empty week is precisely the one worth tapping. */}
            {isSelected && (
              <rect
                x={slot.x}
                y={BOX.height + 2}
                width={slot.width}
                height={TICK / 2}
                rx={TICK / 4}
                fill={reached ? 'var(--accent-ink)' : 'var(--text-1)'}
              />
            )}
          </g>
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
