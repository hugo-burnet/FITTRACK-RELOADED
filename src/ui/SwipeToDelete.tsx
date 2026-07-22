import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';

type Props = {
  /** The word engraved under the row — and, literally, the threshold. */
  label: string;
  onDelete: () => void;
  children: ReactNode;
};

/** Travel before the gesture takes the pointer. Below this, a tap is still a tap. */
const ENGAGE_PX = 10;

/** Air after the word, so the threshold is not the very last pixel of the L. */
const AFTER_WORD_PX = 16;

/**
 * `--dur-2` as a number, because the deletion is timed rather than waited for.
 *
 * The row leaving used to be what triggered the write, on `transitionend`. That
 * ties a database write to a paint: a transition that never completes — the tab
 * backgrounded by an incoming call, which is a case the charter names — leaves
 * the gesture done, the row gone from the screen and nothing written. A timer
 * always resolves, and if the app dies inside these 220 ms the set is still
 * there, which is the safe way for a deletion to fail.
 */
const EXIT_MS = 220;

/** Where the word starts. Aligns with the card's own text inset. */
const WORD_INSET_PX = 16;

/**
 * Guard rails around the measured threshold: a system font twice the expected
 * width must not make the gesture impossible, nor a narrow one make it trivial.
 */
const THRESHOLD_MIN_PX = 72;
const THRESHOLD_MAX_PX = 170;

/**
 * Swipe a row to the right to delete it.
 *
 * **The threshold is the word.** As the row travels, it uncovers "Supprimer"
 * engraved in the surface below; the delete commits at exactly the point where
 * the word is fully readable. There is no arbitrary pixel count to learn and no
 * progress bar to read — the typography *is* the gauge, and a half-uncovered
 * word says "not yet" without a legend.
 *
 * That width is measured from the rendered span, never hardcoded: the app ships
 * no webfont, so the word is set in whatever the phone calls its system sans and
 * its width is a property of the device. The figure measured on this desktop
 * would be a fiction anywhere else — the Lot 5 lesson, filed under a rep range
 * that read "12 – 20" here and "2 – 2" on a phone.
 *
 * Two things keep it out of the way of everything else on the busiest screen of
 * the app:
 *
 * - `touch-action: pan-y` — the browser keeps vertical scrolling, natively, and
 *   hands over the horizontal axis. `none` would freeze the scroll of the one
 *   screen that is scrolled sixty times a session; listening without it would
 *   fight the scroll for the first frames of every drag.
 * - The gesture never starts inside a field. A finger lands on those two cells
 *   to type, and a swipe begun there would open the keyboard on the way past.
 *
 * No keyboard equivalent here, deliberately: the rank button opens the set's
 * sheet, "Supprimer la série" is in it, and that path was there first. This is a
 * shortcut over it, not the only way through.
 */
export function SwipeToDelete({ label, onDelete, children }: Props) {
  const wordRef = useRef<HTMLSpanElement>(null);
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  /** Set the moment the gesture takes over, so the tap it ends with is eaten. */
  const swallowClick = useRef(false);
  /** Latched at the crossing: the tick fires once, not on every frame past it. */
  const ticked = useRef(false);

  const [threshold, setThreshold] = useState(THRESHOLD_MIN_PX);
  const [travel, setTravel] = useState(0);
  const [engaged, setEngaged] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const width = wordRef.current?.getBoundingClientRect().width ?? 0;
    if (width === 0) return;
    const measured = WORD_INSET_PX + width + AFTER_WORD_PX;
    setThreshold(Math.min(THRESHOLD_MAX_PX, Math.max(THRESHOLD_MIN_PX, measured)));
  }, [label]);

  /**
   * The callback, pinned. Callers pass it as an inline arrow, and the screen it
   * lives on re-renders on every keystroke of the grid — a plain dependency
   * would clear and restart the timer each time, so the deletion would keep
   * being pushed 220 ms further away for as long as anything on the card moved.
   * The trap the focus effect in `Sheet` documents, answered with a ref here
   * rather than a narrowed dependency: the timer needs the *latest* callback,
   * not to be pinned to the first one.
   */
  const commit = useRef(onDelete);
  useEffect(() => {
    commit.current = onDelete;
  });

  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => commit.current(), EXIT_MS);
    return () => clearTimeout(timer);
  }, [leaving]);

  const armed = travel >= threshold;

  const startSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    swallowClick.current = false;
    if (leaving) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if ((event.target as HTMLElement).closest('input, textarea') !== null) return;
    origin.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
  };

  const moveSwipe = (event: ReactPointerEvent<HTMLDivElement>) => {
    const from = origin.current;
    if (from === null || event.pointerId !== from.id) return;

    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;

    if (!engaged) {
      // Anything that reads as vertical, or as a pull to the left, belongs to
      // the page. Letting go here rather than at the threshold is what keeps a
      // scroll begun on a row from ending as a deletion.
      if (Math.abs(dy) > Math.abs(dx) || dx < -ENGAGE_PX) {
        origin.current = null;
        return;
      }
      if (dx < ENGAGE_PX) return;
      setEngaged(true);
      swallowClick.current = true;
      try {
        // Best effort, never a precondition. Capture only keeps the moves coming
        // if the finger wanders off the row; a browser that refuses it — or a
        // pointer the browser has already taken back — must not leave the row
        // stuck half-open with the word showing and nothing able to close it.
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Nothing to do: the row still tracks the pointer through its own events.
      }
    }

    // Measured from the engage point, so the row starts under the finger
    // instead of jumping the 10 px that woke the gesture up.
    const raw = Math.max(0, dx - ENGAGE_PX);
    // Past the word the row gets heavier. The threshold becomes something the
    // thumb can feel, which is the half of the signal you get without looking —
    // the other half is the tick below.
    const next = raw > threshold ? threshold + (raw - threshold) * 0.4 : raw;

    if (next >= threshold && !ticked.current) {
      ticked.current = true;
      navigator.vibrate?.(10); // the pick-up tick of ReorderableList, same weight
    }
    if (next < threshold) ticked.current = false;

    setTravel(next);
  };

  const endSwipe = (commit: boolean) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (origin.current?.id !== event.pointerId) return;
    origin.current = null;
    ticked.current = false;
    setEngaged(false);

    // `pointercancel` is the browser taking the gesture back — a scroll it
    // decided to own. It is not a release, so it deletes nothing.
    if (commit && travel >= threshold) {
      setLeaving(true);
      setTravel(event.currentTarget.getBoundingClientRect().width);
      return;
    }
    setTravel(0);
  };

  return (
    <div
      className="relative isolate overflow-hidden"
      // The tap that closes a swipe would otherwise land on whatever the finger
      // started over — "Précédent" writes last session's figures into the row.
      onClickCapture={(event) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        event.stopPropagation();
        event.preventDefault();
      }}
    >
      {/* The engraved well. `--surface-2` is the app's recessed token, which is
          what a slot under a row should be — and why there is no red panel here:
          the charter keeps --color-danger as a fill for a block that needs one,
          and a slab of it under a moving thumb would be the loudest thing on a
          screen where the loudest thing is a validated set. The danger stays
          ink, on the word. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[var(--surface-2)]"
        // Uncovered by clipping, not by growing: the well keeps one geometry and
        // only its paint changes, so the word inside is laid out once instead of
        // being reflowed on every frame of a release.
        style={{
          clipPath: `inset(0 calc(100% - ${travel}px) 0 0)`,
          transition: engaged ? 'none' : 'clip-path var(--dur-2) var(--ease-mech)',
        }}
      >
        <span
          ref={wordRef}
          className="label-xs absolute top-1/2 left-4 -translate-y-1/2 font-semibold whitespace-nowrap
            transition-colors duration-[var(--dur-1)]"
          style={{ color: armed ? 'var(--danger-ink)' : 'var(--text-2)' }}
        >
          {label}
        </span>
      </div>

      <div
        onPointerDown={startSwipe}
        onPointerMove={moveSwipe}
        onPointerUp={endSwipe(true)}
        onPointerCancel={endSwipe(false)}
        className="relative bg-[var(--surface-1)]"
        style={{
          transform: `translateX(${travel}px)`,
          transition: engaged ? 'none' : 'transform var(--dur-2) var(--ease-mech)',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  );
}
