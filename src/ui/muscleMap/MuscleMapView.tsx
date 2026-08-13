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
 * **Mixed `in oklab`, and that is what buys the gradations.** `in srgb` came
 * first, to reproduce exactly what the previous body map got by compositing
 * `--text-1` at `fill-opacity`. But sRGB interpolates encoded values, and the
 * encoding already carries a gamma: a muscle at 40 % of the ramp landed most of
 * the way to white, so every worked muscle piled into the top of the range and
 * the body read as two tones, lit and unlit. Reported from the phone as a want of
 * nuance, which is exactly what it was.
 *
 * oklab interpolates perceived lightness instead, so equal steps of intensity look
 * like equal steps. The mid-range opens up and a muscle worked twice as much as
 * another finally looks it.
 */

/**
 * Where the ramp starts, and why it does not start at zero.
 *
 * `--surface-2` on a `--surface-1` card is **1,11:1** — the pairing is the
 * charte's own, but the charte only ever uses it under a border, for inputs. Used
 * as a fill it left the body invisible: the drawing read as a wireframe, its
 * `--axis` outlines carrying the whole shape while every fill vanished into the
 * card. Reported from the phone in exactly those terms.
 *
 * So an unworked muscle is lifted off the base — enough to read as a mass against
 * the card, never enough to read as worked.
 *
 * **The ceiling is not a matter of taste.** A dark region is what this drawing
 * exists to report: `balanceHighlight` argues the eye must go to the *gaps*, and a
 * bright unworked body is precisely how that reading is lost. Raising this number
 * buys visibility and spends the finding, so it stays as low as the card allows —
 * the outline carries the form anyway, at its own 3,5:1.
 */
const UNWORKED_FLOOR = 24;

/**
 * The silhouette — head, hands, feet, everything that is not a muscle.
 *
 * Kept **below** the floor rather than at `--surface-2`: it has no outline of its
 * own, so at the card's own value it disappeared entirely. Under the unworked
 * muscles it reads as the body's own ground, and the muscle mass stays the
 * lightest thing on an untrained figure — which is the right hierarchy for a
 * drawing about muscles.
 */
const SILHOUETTE_FLOOR = 10;

const ink = (percent: number) =>
  `color-mix(in oklab, var(--text-1) ${Math.round(percent)}%, var(--surface-2))`;

const RAMP = {
  silhouetteColor: ink(SILHOUETTE_FLOOR),
  // The charte's line ink, already used by the charts. `--border` sits at 1,45:1
  // on a card and would be invisible between two unlit muscles.
  outlineColor: 'var(--axis)',
  outlineWidth: 1,
  colorScale: (intensity: number) => ink(UNWORKED_FLOOR + (100 - UNWORKED_FLOOR) * intensity),
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
    /* Sized by the width available, not by a fixed height.
     *
     * A fixed `h-64` was inherited from the previous body map, whose blocky
     * regions read fine that small. This drawing carries twenty-six real muscles
     * in the same box, and the small ones — the cuff, the rhomboids — closed up.
     * The two figures now take the card's width between them, so the phone that
     * has room gives it. `max-w` keeps a wide screen from turning the pair into a
     * poster, and `basis-0 grow` splits the room evenly whatever the gap. */
    <div
      className="mx-auto flex w-full max-w-sm items-start justify-center gap-3"
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

  return (
    <div ref={hostRef} className="min-w-0 grow basis-0" style={{ aspectRatio: VIEW_BOX_RATIO }} />
  );
}
