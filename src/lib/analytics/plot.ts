/**
 * Values in, SVG coordinates out. Pure by construction (architecture §7).
 *
 * This module is the reason the charts carry no third-party dependency: the one
 * thing a charting library actually computes is here, in thirty lines, where it
 * can be tested. `plates.ts` and `warmup.ts` set the precedent — a calculation
 * the app depends on is a calculation the app owns.
 */

export interface PlotBox {
  width: number;
  height: number;
}

export interface PlotPoint {
  x: number;
  y: number;
}

export interface PlotRange {
  min: number;
  max: number;
}

/** One column of a histogram: where it sits, and how tall it stands. */
export interface BarSlot {
  x: number;
  centerX: number;
  width: number;
  y: number;
  height: number;
}

/** How much of a column the bar itself fills; the rest is the gap between two. */
const BAR_FILL = 0.62;

/**
 * The vertical range, **bounded by the data and not by zero**.
 *
 * A progression from 80 to 85 kg drawn from a zero baseline is a flat line, and
 * a flat line says nothing. The price of that freedom is paid in full by the
 * screen: the minimum and the maximum are engraved at both ends of the scale,
 * always, so no reading depends on assuming an origin.
 *
 * A range of zero width — one session, or three identical ones — is opened
 * rather than left flat: dividing by it would put every point at NaN.
 */
export function plotBounds(values: readonly number[]): PlotRange {
  if (values.length === 0) return { min: 0, max: 1 };

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max > min) return { min, max };

  // 10 % either side of the value, and 1 for a value of zero: enough for the
  // line to sit in the middle of the box rather than on its edge.
  const padding = Math.abs(min) * 0.1 || 1;
  return { min: min - padding, max: max + padding };
}

/**
 * Points spread edge to edge, in the order given, with the maximum at the top —
 * the SVG y axis points down, which is the one inversion this module owns.
 *
 * A single value is centred rather than pinned to `x = 0`: with one session
 * there is no interval to divide by, and a lone dot in the corner reads as a
 * rendering bug.
 */
export function plotPoints(values: readonly number[], box: PlotBox): PlotPoint[] {
  if (values.length === 0) return [];

  const { min, max } = plotBounds(values);
  const span = max - min;
  const step = values.length === 1 ? 0 : box.width / (values.length - 1);

  return values.map((value, index) => ({
    x: values.length === 1 ? box.width / 2 : step * index,
    y: box.height - ((value - min) / span) * box.height,
  }));
}

/**
 * Columns of equal width, measured **from zero** — the second geometry of this
 * module, and deliberately not a variant of the first.
 *
 * `plotBounds` bounds the scale by the data rather than by zero, and milestone
 * G1 paid for that freedom by engraving the minimum and the maximum. For a
 * histogram the same choice would be a lie: **the length of a bar *is* the
 * quantity**, so two sessions and four sessions have to read as double, not as
 * "the short one and the tall one". A bar that does not start at zero
 * misrepresents its neighbour. Hence a separate function rather than a flag: a
 * line and a bar disagree about what the bottom of the box means.
 *
 * `ceiling` comes from the caller because it is not only the data's business:
 * the weekly chart passes the largest of the counts **and the largest goal in
 * the window**, so an unreached target squashes the bars downward and the
 * shortfall is visible without a dashed reference line being drawn.
 */
export function barLayout(
  values: readonly number[],
  box: PlotBox,
  ceiling: number,
): BarSlot[] {
  if (values.length === 0) return [];

  // A column always exists, even for a week with no session: the gap is the
  // information. A ceiling of zero is opened to 1 so an empty window still
  // lays out its columns instead of dividing by nothing.
  const slot = box.width / values.length;
  const width = slot * BAR_FILL;
  const top = ceiling > 0 ? ceiling : 1;

  return values.map((value, index) => {
    const height = (Math.max(0, value) / top) * box.height;
    const x = slot * index + (slot - width) / 2;

    return { x, centerX: x + width / 2, width, y: box.height - height, height };
  });
}
