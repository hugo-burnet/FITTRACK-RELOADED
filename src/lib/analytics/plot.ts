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
 * The shortest a **non-zero** bar is allowed to be, as a share of its track.
 *
 * One set against a ceiling of sixty is 1.7 % — two pixels, which reads as
 * nothing. A quantity that exists has to look like one; the difference between
 * "a little" and "none at all" is the whole subject of a distribution.
 */
const MIN_FRACTION = 0.02;

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

/**
 * A share of the track, 0 to 1 — the third geometry of this module, and no more
 * a generalisation of the other two than they are of each other.
 *
 * **Why a fraction and not coordinates**, when `plotPoints` and `barLayout` both
 * return pixels: these marks carry HTML labels on their own line. A muscle name
 * has to be read in French at reading size, and a `<text>` inside a scaled
 * `viewBox` lies about its size — which is exactly why milestones G1 and G2 keep
 * every word of theirs *outside* the SVG. Labels in HTML means bars in HTML,
 * means a fluid track whose width is unknown until render. It is also what the
 * regularity rail of `HistorySummaryCard` already consumes (`scaleX(fraction)`).
 *
 * And it is not `barLayout` turned on its side: `barLayout` places N columns
 * **along** a box — `slot`, `centerX`, `BAR_FILL` — because the horizontal axis
 * is its own. Here the rows are laid out by the DOM, so four of `BarSlot`'s five
 * fields would be ignored. What is left is one quantity per row.
 *
 * `ceiling` comes from the caller, as it does for `barLayout`: here it is simply
 * the largest count. There is no goal to fold in — this screen has no target to
 * hold anyone to, cf. the spec of G3, §4.5.
 */
export function barFractions(values: readonly number[], ceiling: number): number[] {
  const top = ceiling > 0 ? ceiling : 1;

  return values.map((value) => {
    // Exactly zero, never the floor: absence is not a small quantity. A muscle
    // with no set at all is marked by the stub in the axis's own tone, and the
    // two must not be confused — that distinction is the point of the screen.
    if (value <= 0) return 0;
    return Math.min(1, Math.max(MIN_FRACTION, value / top));
  });
}
