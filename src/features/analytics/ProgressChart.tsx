import { useRef } from 'react';
import type { MetricPoint } from '@/lib/analytics/metrics';
import { plotPoints } from '@/lib/analytics/plot';

/**
 * The curve. Hand-drawn SVG, no charting library — cf. the spec, §2.3: the one
 * thing a library actually computes lives in `lib/analytics/plot.ts`, where it
 * is tested, and what is left is thirty lines of markup that already speak the
 * app's tokens.
 *
 * **One thing is coloured: the point holding the record.** The charte reserves
 * the accent for primary actions, validated sets and records — "nothing else".
 * A curve of past sessions is none of the three; its peak is. So the accent
 * stays information instead of becoming decoration, and at arm's length the one
 * green pixel is the one you were looking for.
 *
 * **No grid, no axes.** Direct labels before gridlines: the minimum and maximum
 * are engraved at both ends of the scale by the card around this component, and
 * the two dates sit under the plot. On 375px a grid is noise that makes the
 * curve harder to read, not easier.
 */

const BOX = { width: 300, height: 120 };
/** Room for the dot radius and its surface ring, so nothing clips at the edges. */
const PAD = 8;

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
  const svg = useRef<SVGSVGElement>(null);
  /** Each point paired with where it lands, so nothing indexes across two lists. */
  const plotted = plotPoints(
    points.map((point) => point.value),
    BOX,
  ).map((position, index) => ({ position, point: points[index]! }));

  /**
   * The nearest point in x, not the one under the finger.
   *
   * A 8px dot is a target nobody hits reliably out of breath, and a per-point
   * hit area would leave dead zones between them. Here the whole plot is live:
   * you have to be *closest*, never accurate.
   */
  const selectNearest = (clientX: number) => {
    const box = svg.current?.getBoundingClientRect();
    if (box === undefined || plotted.length === 0) return;

    const ratio = (clientX - box.left) / box.width;
    const x = ratio * (BOX.width + PAD * 2) - PAD;

    let nearest = 0;
    let distance = Number.POSITIVE_INFINITY;
    plotted.forEach(({ position }, index) => {
      const candidate = Math.abs(position.x - x);
      if (candidate < distance) {
        distance = candidate;
        nearest = index;
      }
    });
    onSelect(nearest);
  };

  const path = plotted
    .map(({ position }, index) => `${index === 0 ? 'M' : 'L'} ${position.x} ${position.y}`)
    .join(' ');

  return (
    <svg
      ref={svg}
      role="img"
      aria-label={summary}
      viewBox={`${-PAD} ${-PAD} ${BOX.width + PAD * 2} ${BOX.height + PAD * 2}`}
      className="w-full touch-none"
      style={{ height: BOX.height + PAD * 2 }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        selectNearest(event.clientX);
      }}
      onPointerMove={(event) => {
        // Only while dragging: scrubbing the curve moves the reading above it.
        if (event.buttons !== 0) selectNearest(event.clientX);
      }}
    >
      {/* 2px, round joins — a hairline disappears at arm's length. Drawn only
          from two points on: a line to nowhere is not a trend. */}
      {plotted.length > 1 && (
        <path
          d={path}
          fill="none"
          stroke="var(--text-2)"
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
              fill={isBest ? 'var(--accent-ink)' : 'var(--text-2)'}
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
    </svg>
  );
}
