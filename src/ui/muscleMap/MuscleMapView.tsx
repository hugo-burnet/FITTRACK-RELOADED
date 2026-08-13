import { useEffect, useRef } from 'react';
import svgSource from './muscle-map.svg?raw';
import { MUSCLE_IDS, type MuscleView } from './muscleGroups';
import { MuscleMap as MuscleMapCore, type MuscleMapOptions } from './muscleMap';
import { toIntensities, type MuscleHighlight } from './musclesByGroup';

/**
 * The drawing's own proportions, read off its `viewBox`.
 *
 * The host has to carry them: the map injects an svg sized `100% × 100%`, so a
 * flex child with no intrinsic width would collapse to nothing.
 */
const VIEW_BOX_RATIO = '815 / 2048';

/**
 * **A value ramp, not a colour** — the charte reserves the accent for primary
 * actions, validated sets and records, and every analytics screen holds to it.
 *
 * `color-mix` rather than the class's own `restColor`/`peakColor`: those take hex
 * literals, which would freeze one theme's palette into the drawing. Mixing the
 * charte's two tokens keeps a lit muscle the same ink as body text over the body's
 * own surface, and both themes follow without a second palette.
 *
 * Mixed `in srgb` on purpose. It reproduces exactly what the previous body map
 * obtained by compositing `--text-1` at `fill-opacity` over a `--surface-2` base;
 * `in oklab` would be perceptually smoother but would shift every intensity off
 * the value the charte was contrast-checked at.
 */
const RAMP = {
  silhouetteColor: 'var(--surface-2)',
  // The charte's line ink, already used by the charts. `--border` sits at 1,45:1
  // on a card and would be invisible between two unlit muscles.
  outlineColor: 'var(--axis)',
  outlineWidth: 1,
  colorScale: (intensity: number) =>
    `color-mix(in srgb, var(--text-1) ${Math.round(intensity * 100)}%, var(--surface-2))`,
} satisfies Partial<MuscleMapOptions>;

interface Props {
  /**
   * Which muscles are lit, and how much. The contract is the catalogue's
   * vocabulary, never the drawing's — `musclesByGroup` is the only translator.
   */
  highlight: MuscleHighlight;
  /**
   * Decorative by default, and that is the honest reading: the screens that show
   * a body also name the muscles in text right beside it, so the drawing
   * duplicates information rather than carrying it. Pass a label only where that
   * stops being true.
   */
  label?: string;
}

/**
 * Front and back, with the worked muscles lit.
 *
 * Two instances rather than one with a view switch. A switch would hide half the
 * body behind a tap, and the reading this drawing exists for — *where are the
 * gaps* — needs both halves in the eye at once. It costs a second copy of the
 * geometry in the DOM and buys a glance.
 */
export function MuscleMap({ highlight, label }: Props) {
  return (
    <div
      className="flex items-start justify-center gap-2"
      {...(label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
    >
      <MuscleMapView view="front" highlight={highlight} />
      <MuscleMapView view="back" highlight={highlight} />
    </div>
  );
}

function MuscleMapView({ view, highlight }: { view: MuscleView; highlight: MuscleHighlight }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MuscleMapCore | null>(null);
  /** What is currently painted, so an unchanged highlight repaints nothing. */
  const painted = useRef<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;

    const map = new MuscleMapCore(host, { svgSource, view, ...RAMP });
    mapRef.current = map;
    painted.current = null;

    return () => {
      map.destroy();
      mapRef.current = null;
    };
  }, [view]);

  /**
   * No dependency array, and a signature guard instead.
   *
   * `highlight` is rebuilt by `balanceHighlight` inside the parent's render, so it
   * is a new object every time and a dependency on it would repaint on renders
   * that changed nothing. That is not merely wasteful: painting reorders the lit
   * paths in the DOM to bring them out from under the trapezius, and re-inserting
   * a node restarts the drawing's `transition: fill`, which reads as a flicker.
   *
   * The signature is built in `MUSCLE_IDS` order rather than from the object's own
   * keys, so two highlights with the same values compare equal whatever order
   * their keys were inserted in.
   */
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const intensities = toIntensities(highlight);
    const signature = MUSCLE_IDS.map((id) => intensities[id] ?? 0).join(',');
    if (signature === painted.current) return;

    painted.current = signature;
    map.setIntensities(intensities);
  });

  return <div ref={hostRef} className="h-64 shrink-0" style={{ aspectRatio: VIEW_BOX_RATIO }} />;
}
