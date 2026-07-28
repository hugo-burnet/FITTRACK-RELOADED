import { useRef, type ReactNode } from 'react';
import type { PlotBox } from '@/lib/analytics/plot';

/**
 * The frame every chart in this app shares — and, deliberately, nothing else.
 *
 * G1's spec forbade abstracting before there were two concrete charts. There are
 * two now, and the honest answer is that **the drawing does not factor and the
 * interaction factors entirely**: a curve and a histogram disagree about what
 * the bottom of the box means (`plotBounds` vs `barLayout`), about their mark,
 * and about what selection looks like — but they agree, line for line, on the
 * SVG element, the accessibility contract and the gesture.
 *
 * So this component receives **the x of each mark**, not the data. It knows
 * neither what a session is nor what a week is. What is left out is as
 * deliberate as what is in: no `<Chart type="line" | "bar">`, no series layer.
 * Two cases do not make a library, and the first `variant` prop is always the
 * beginning of the component nobody dares touch.
 */

interface Props {
  box: PlotBox;
  /** Room for the widest mark drawn at an edge, so nothing clips. */
  pad: number;
  /** Read by a screen reader instead of the drawing. */
  label: string;
  /** Where each mark sits horizontally, in box coordinates. */
  xs: readonly number[];
  onSelect: (index: number) => void;
  children: ReactNode;
}

export function ChartSurface({ box, pad, label, xs, onSelect, children }: Props) {
  const svg = useRef<SVGSVGElement>(null);

  /**
   * The nearest mark in x, not the one under the finger.
   *
   * An 8px dot is a target nobody hits reliably out of breath, and a per-mark
   * hit area would leave dead zones between them. Here the whole plot is live:
   * you have to be *closest*, never accurate — which is how a chart satisfies
   * the 48px rule without drawing a single target. It is also what makes a week
   * with **no** session selectable: a column of height zero has no surface of
   * its own, but it still has an abscissa.
   */
  const selectNearest = (clientX: number) => {
    const rect = svg.current?.getBoundingClientRect();
    if (rect === undefined || xs.length === 0) return;

    const ratio = (clientX - rect.left) / rect.width;
    const x = ratio * (box.width + pad * 2) - pad;

    let nearest = 0;
    let distance = Number.POSITIVE_INFINITY;
    xs.forEach((candidate, index) => {
      const gap = Math.abs(candidate - x);
      if (gap < distance) {
        distance = gap;
        nearest = index;
      }
    });
    onSelect(nearest);
  };

  return (
    <svg
      ref={svg}
      role="img"
      aria-label={label}
      viewBox={`${-pad} ${-pad} ${box.width + pad * 2} ${box.height + pad * 2}`}
      className="w-full touch-none"
      style={{ height: box.height + pad * 2 }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        selectNearest(event.clientX);
      }}
      onPointerMove={(event) => {
        // Only while dragging: scrubbing the chart moves the reading above it.
        if (event.buttons !== 0) selectNearest(event.clientX);
      }}
    >
      {children}
    </svg>
  );
}
