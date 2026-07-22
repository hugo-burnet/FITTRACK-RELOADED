/**
 * How fast a list follows the finger when a drag reaches the edge of the screen.
 *
 * Pulled out of `ReorderableList` as a pure function because the loop that calls
 * it runs on `requestAnimationFrame`, which never fires in an automated browser
 * — the panel does not composite, so no frame is ever produced. Left inline, the
 * one part of the drag that cannot be exercised by hand would also be the one
 * part with no test at all.
 */

/** Distance from an edge at which the list starts following. */
export const EDGE_PX = 72;

/** Pixels per frame at full speed — roughly 840 px/s at 60 Hz. */
export const EDGE_SPEED_PX = 14;

/**
 * Pixels to scroll on this frame. Negative scrolls up, 0 means the pointer is
 * clear of both edges.
 *
 * Speed ramps with how deep into the edge zone the pointer is, and is **clamped**
 * there: a finger dragged past the top of the screen reports a coordinate above
 * the container, and without the clamp the list would accelerate away from the
 * user the further off-screen they went.
 *
 * On a container shorter than two edge zones the two overlap and the top wins.
 * That is the right way round: the list is already nearly all visible, and
 * scrolling up is what gets you back to the rows you cannot see.
 */
export function edgeScrollDelta(box: { top: number; bottom: number }, y: number): number {
  const fromTop = box.top + EDGE_PX - y;
  if (fromTop > 0) return -EDGE_SPEED_PX * Math.min(1, fromTop / EDGE_PX);

  const fromBottom = y - (box.bottom - EDGE_PX);
  if (fromBottom > 0) return EDGE_SPEED_PX * Math.min(1, fromBottom / EDGE_PX);

  return 0;
}
