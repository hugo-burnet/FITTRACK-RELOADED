/**
 * Rounds the corners of a polygonal SVG path.
 *
 * The embedded geometry is **0,9 % curves**: 836 vertices and eight curve
 * commands across 89 paths. It is a low-poly diagram, and no amount of stroke
 * tuning hides a hard corner. This takes the edge off the vertices without
 * pretending to be anatomy it is not — each corner is cut back along its two
 * edges and bridged by a quadratic through the original vertex, which is the
 * one smoothing that cannot invent a shape: the curve stays inside the triangle
 * formed by the corner, so a rounded outline never leaves the original one.
 *
 * Pure by construction, and **conservative by default**: anything it does not
 * fully understand comes back untouched. A path carrying a curve command is
 * returned verbatim rather than approximated, and so is one whose parse fails.
 * A silhouette that renders slightly angular is a small disappointment; one
 * whose forearm has been smoothed into a sausage is a bug.
 */

/** How far back a corner is cut, in user units of the 35 × 93 viewBox. */
export const CORNER_RADIUS = 0.35;

interface Point {
  x: number;
  y: number;
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000;

/** Splits `m 1,2 3,4 z` into `[['m', [1,2,3,4]], ['z', []]]`. */
function tokenise(d: string): [string, number[]][] | undefined {
  const out: [string, number[]][] = [];
  const commands = d.match(/[a-zA-Z][^a-zA-Z]*/g);
  if (commands === null) return undefined;

  for (const chunk of commands) {
    const letter = chunk[0]!;
    const numbers = (chunk.slice(1).match(/-?\d*\.?\d+(?:e-?\d+)?/g) ?? []).map(Number);
    if (numbers.some(Number.isNaN)) return undefined;
    out.push([letter, numbers]);
  }

  return out;
}

/**
 * The closed polygons of a path, or `undefined` if it holds anything else.
 *
 * `m` with extra coordinate pairs means an implicit `lineto` for each, which is
 * how every path in the embedded file is written.
 */
function toPolygons(d: string): Point[][] | undefined {
  const tokens = tokenise(d);
  if (tokens === undefined) return undefined;

  const polygons: Point[][] = [];
  let current: Point[] = [];
  let cursor: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };

  const push = (point: Point) => {
    current.push(point);
    cursor = point;
  };

  for (const [letter, numbers] of tokens) {
    const relative = letter === letter.toLowerCase();

    switch (letter.toUpperCase()) {
      case 'M': {
        if (numbers.length < 2 || numbers.length % 2 !== 0) return undefined;
        if (current.length > 0) polygons.push(current);
        current = [];
        for (let i = 0; i < numbers.length; i += 2) {
          const x = relative ? cursor.x + numbers[i]! : numbers[i]!;
          const y = relative ? cursor.y + numbers[i + 1]! : numbers[i + 1]!;
          push({ x, y });
          if (i === 0) start = { x, y };
        }
        break;
      }
      case 'L': {
        if (numbers.length < 2 || numbers.length % 2 !== 0) return undefined;
        for (let i = 0; i < numbers.length; i += 2) {
          push({
            x: relative ? cursor.x + numbers[i]! : numbers[i]!,
            y: relative ? cursor.y + numbers[i + 1]! : numbers[i + 1]!,
          });
        }
        break;
      }
      case 'H': {
        for (const value of numbers) push({ x: relative ? cursor.x + value : value, y: cursor.y });
        break;
      }
      case 'V': {
        for (const value of numbers) push({ x: cursor.x, y: relative ? cursor.y + value : value });
        break;
      }
      case 'Z': {
        if (current.length > 0) polygons.push(current);
        current = [];
        cursor = start;
        break;
      }
      // A curve, an arc, anything else: hand the path back untouched.
      default:
        return undefined;
    }
  }

  if (current.length > 0) polygons.push(current);
  return polygons;
}

const distance = (a: Point, b: Point): number => Math.hypot(b.x - a.x, b.y - a.y);

/** `from` moved towards `to` by `length`, in absolute coordinates. */
function along(from: Point, to: Point, length: number): Point {
  const span = distance(from, to);
  if (span === 0) return { ...from };
  const ratio = length / span;
  return { x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio };
}

function polygonToPath(points: Point[], radius: number): string {
  // Under four points there is no corner worth rounding — a triangle is often a
  // finger or a knuckle, and rounding it costs the whole shape.
  if (points.length < 4) {
    const [first, ...rest] = points as [Point, ...Point[]];
    return `M ${round3(first.x)},${round3(first.y)}${rest
      .map((point) => ` L ${round3(point.x)},${round3(point.y)}`)
      .join('')} Z`;
  }

  const segments: string[] = [];

  for (let i = 0; i < points.length; i++) {
    const previous = points[(i - 1 + points.length) % points.length]!;
    const corner = points[i]!;
    const next = points[(i + 1) % points.length]!;

    // Never eat more than a third of either edge, or two adjacent corners on a
    // short segment would swallow it and cross over each other.
    const cut = Math.min(radius, distance(corner, previous) / 3, distance(corner, next) / 3);

    const entry = along(corner, previous, cut);
    const exit = along(corner, next, cut);

    segments.push(
      i === 0
        ? `M ${round3(entry.x)},${round3(entry.y)}`
        : ` L ${round3(entry.x)},${round3(entry.y)}`,
      ` Q ${round3(corner.x)},${round3(corner.y)} ${round3(exit.x)},${round3(exit.y)}`,
    );
  }

  return `${segments.join('')} Z`;
}

/**
 * The path with its corners rounded, or the path itself when that cannot be
 * done safely.
 */
export function roundPath(d: string, radius: number = CORNER_RADIUS): string {
  const polygons = toPolygons(d);
  if (polygons === undefined || polygons.length === 0) return d;

  return polygons.map((polygon) => polygonToPath(polygon, radius)).join(' ');
}
