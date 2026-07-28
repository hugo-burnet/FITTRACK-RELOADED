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
