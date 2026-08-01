import type { MetricPoint } from '@/lib/analytics/metrics';
import { plotPoints } from '@/lib/analytics/plot';
import { ChartSurface } from './ChartSurface';

/**
 * The curve. Hand-drawn SVG, no charting library — cf. the spec of G1, §2.3: the
 * one thing a library actually computes lives in `lib/analytics/plot.ts`, where
 * it is tested, and what is left is thirty lines of markup that already speak
 * the app's tokens.
 *
 * **The curve carries the accent's hue; the point holding the record carries it
 * at full strength.** The charte reserves the accent for primary actions,
 * validated sets and records — "nothing else" — and a curve of past sessions is
 * none of the three, its peak is. That much is unchanged: the record is still
 * the only bright mark on the drawing, so the accent stays information instead
 * of becoming decoration. What changed at the phone review is the line and the
 * ordinary points: drawn in --text-2 they were grey in a coloured app, and in
 * the dark theme a colour tuned for text lands almost white. They are now
 * --accent-data, the same hue muted, which is what makes the record read as
 * *more* of something rather than as the only thing.
 *
 * **No grid, no axes.** Direct labels before gridlines: the minimum and maximum
 * are engraved at both ends of the scale by the card around this component, and
 * the two dates sit under the plot. On 375px a grid is noise that makes the
 * curve harder to read, not easier.
 *
 * The `<svg>`, the accessibility contract and the tap-the-nearest-mark gesture
 * moved to `ChartSurface` at milestone G2, when the histogram turned out to need
 * exactly those and nothing more. Not a pixel of this rendering changed.
 */

const BOX = { width: 300, height: 120 };
/**
 * Room for the widest mark drawn at a point, so nothing clips at the edges.
 *
 * The measurement, not a guess: the selection ring is `r = 9` with a 1.5px
 * stroke straddling it, so it reaches **9.75px** from the centre. At 8px the
 * last point — which is exactly where the record usually sits — lost two pixels
 * off its right edge. Reported from the screen.
 */
const PAD = 12;

interface Props {
  points: readonly MetricPoint[];
  /** Index of the record — the only point that wears the accent. */
  bestIndex?: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Read by a screen reader instead of the drawing. */
  summary: string;
}

export function ProgressChart({ points, bestIndex, selectedIndex, onSelect, summary }: Props) {
  /** Each point paired with where it lands, so nothing indexes across two lists. */
  const plotted = plotPoints(
    points.map((point) => point.value),
    BOX,
  ).map((position, index) => ({ position, point: points[index]! }));

  const path = plotted
    .map(({ position }, index) => `${index === 0 ? 'M' : 'L'} ${position.x} ${position.y}`)
    .join(' ');

  return (
    <ChartSurface
      box={BOX}
      pad={PAD}
      label={summary}
      xs={plotted.map(({ position }) => position.x)}
      onSelect={onSelect}
    >
      {/* 2px, round joins — a hairline disappears at arm's length. Drawn only
          from two points on: a line to nowhere is not a trend. */}
      {plotted.length > 1 && (
        <path
          d={path}
          fill="none"
          stroke="var(--accent-data)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}

      {plotted.map(({ position, point }, index) => {
        const isBest = index === bestIndex;
        const isSelected = index === selectedIndex;

        return (
          <g key={point.workoutId}>
            {/* The 2px surface ring: without it two close sessions merge into
                one smudge. It is drawn as a fat stroke under the dot. */}
            <circle
              cx={position.x}
              cy={position.y}
              r={isSelected ? 6 : 4.5}
              fill={isBest ? 'var(--accent-ink)' : 'var(--accent-data)'}
              stroke="var(--surface-1)"
              strokeWidth={2}
            />
            {/* Selection is a ring, not a colour: the accent is spoken for, and
                a second hue on this chart would make the record ambiguous. */}
            {isSelected && (
              <circle
                cx={position.x}
                cy={position.y}
                r={9}
                fill="none"
                stroke={isBest ? 'var(--accent-ink)' : 'var(--text-1)'}
                strokeWidth={1.5}
              />
            )}
          </g>
        );
      })}
    </ChartSurface>
  );
}
