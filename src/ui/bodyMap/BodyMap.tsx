import type { MuscleGroup } from '@/data/types';
import { REGIONS_BY_MUSCLE, isDrawable } from './regionsByMuscle';
import { BACK_REGIONS, BODY_VIEW_BOX, FRONT_REGIONS, type BodyRegion } from './vendorPaths';

/**
 * Which muscles are lit, and how much. 0 to 1; anything absent stays unlit.
 *
 * One prop, deliberately: the exercise sheet passes 1 to the primary muscle and
 * 0.4 to the secondaries, and a heat map would pass a normalised volume. Nothing
 * about this contract mentions how the body is drawn, so the day the drawing
 * changes — another silhouette, or something else entirely — every caller is
 * already written.
 */
export type MuscleHighlight = Partial<Record<MuscleGroup, number>>;

interface Props {
  highlight: MuscleHighlight;
  /**
   * Decorative by default, and that is the honest reading: the screens that
   * show a body also name the muscles in text right beside it, so the drawing
   * duplicates information rather than carrying it. Pass a label only where
   * that stops being true.
   */
  label?: string;
}

/**
 * Front and back silhouettes, with the worked muscles lit.
 *
 * **A value ramp, not a colour.** The charte reserves the accent for primary
 * actions, validated sets and records — `MuscleBalanceCard` says so and every
 * analytics screen holds to it. A lit muscle here is the same ink as body text,
 * laid over the body's own surface at the intensity it was worked; the contrast
 * carries the reading, no hue is spent, and both themes work without a second
 * palette.
 *
 * Drawn in two layers rather than one, so no colour has to be interpolated: the
 * whole body first, in surface, then the lit regions over it in ink at
 * `fill-opacity`. It also guarantees a lit muscle is never hidden behind the
 * region drawn after it.
 */
export function BodyMap({ highlight, label }: Props) {
  return (
    <div
      className="flex items-start justify-center gap-2"
      {...(label === undefined ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label })}
    >
      <Silhouette regions={FRONT_REGIONS} viewBox={BODY_VIEW_BOX.front} highlight={highlight} />
      <Silhouette regions={BACK_REGIONS} viewBox={BODY_VIEW_BOX.back} highlight={highlight} />
    </div>
  );
}

/** Intensity per region id, resolved once per render from the muscle map. */
function litRegions(highlight: MuscleHighlight): Map<string, number> {
  const lit = new Map<string, number>();

  for (const [key, raw] of Object.entries(highlight)) {
    const muscle = key as MuscleGroup;
    // A group with no region — cardio, full body — simply has nothing to light.
    // It is not an error: `hasDrawableMuscles` is what decides whether the
    // drawing is worth showing at all.
    if (raw === undefined || !isDrawable(muscle)) continue;

    const intensity = Math.min(1, Math.max(0, raw));
    if (intensity === 0) continue;

    for (const id of REGIONS_BY_MUSCLE[muscle]) lit.set(id, intensity);
  }

  return lit;
}

function Silhouette({
  regions,
  viewBox,
  highlight,
}: {
  regions: BodyRegion[];
  viewBox: string;
  highlight: MuscleHighlight;
}) {
  const lit = litRegions(highlight);

  return (
    /* Sized by its height, not its width. The silhouette is 35 × 93 — barely
       more than a third as wide as it is tall — so a width-driven svg took 403 px
       of an 812 px screen and pushed the records off it. Height fixed, width
       derived from the viewBox. */
    <svg viewBox={viewBox} className="h-64 w-auto" aria-hidden>
      <g fill="var(--surface-2)" stroke="var(--border)" strokeWidth={0.1}>
        {regions.map((region) => (
          <path key={region.id} d={region.path} />
        ))}
      </g>
      <g fill="var(--text-1)" stroke="none">
        {regions.map((region) => {
          const intensity = lit.get(region.id);
          if (intensity === undefined) return null;
          return <path key={region.id} d={region.path} fillOpacity={intensity} />;
        })}
      </g>
    </svg>
  );
}
