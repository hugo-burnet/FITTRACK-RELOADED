import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { edgeScrollDelta } from './edgeScroll';

/**
 * Spread onto whatever the user takes hold of. Nothing else may carry it — the
 * `touch-action` below is what keeps the rest of the row scrolling the page.
 *
 * Move and release ride on the handle too, not on the list or the window:
 * `setPointerCapture` redirects every later event of the gesture to the element
 * that captured it, so a listener anywhere else would simply never fire.
 */
export type DragHandleProps = {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  style: CSSProperties;
};

export type ItemState = {
  handleProps: DragHandleProps;
  dragging: boolean;
};

type Props<T> = {
  items: readonly T[];
  /** Stable key per item, so a reorder moves the DOM node and keeps its focus. */
  keyOf: (item: T) => string;
  onReorder: (from: number, to: number) => void;
  renderItem: (item: T, index: number, state: ItemState) => ReactNode;
  className?: string;
};

type Rect = { center: number };

type DragState = {
  from: number;
  to: number;
  pointerId: number;
  startY: number;
  startScrollTop: number;
  dy: number;
  rects: Rect[];
  /** What a displaced row moves by: the dragged row's height plus the gap. */
  span: number;
};

/**
 * The nearest scrolling ancestor.
 *
 * Walked generically rather than reaching for the app's `<main>`: a `ui/`
 * component that knows about the app shell is the backwards dependency §7 of the
 * architecture forbids, and the same one Lot 3 fixed by moving the icons here.
 */
function scrollParent(node: HTMLElement | null): HTMLElement | null {
  for (let element = node?.parentElement ?? null; element; element = element.parentElement) {
    const overflow = getComputedStyle(element).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && element.scrollHeight > element.clientHeight)
      return element;
  }
  return null;
}

/** The row the dragged one has travelled past, by centre crossing. */
function targetIndex(rects: Rect[], from: number, dy: number): number {
  const center = (rects[from]?.center ?? 0) + dy;
  let to = from;

  if (dy > 0) {
    while (to + 1 < rects.length && center > (rects[to + 1]?.center ?? Infinity)) to += 1;
  } else {
    while (to - 1 >= 0 && center < (rects[to - 1]?.center ?? -Infinity)) to -= 1;
  }

  return to;
}

/**
 * Drag-to-reorder built on Pointer Events.
 *
 * **Not** the HTML5 drag-and-drop API, which Chrome on Android never fires from
 * a touch: a list built on it works only on the developer's desktop, and this
 * lot's checkpoint is explicitly "au doigt sur ton téléphone". Pointer Events
 * are one implementation for mouse and finger alike, so there is one behaviour
 * to test rather than two.
 *
 * Three things make it usable rather than merely functional:
 *
 * - `touch-action: none` rides on `handleProps` and therefore on the handle
 *   alone. Touch the row anywhere else and the page scrolls exactly as before —
 *   put it on the row or the list and the whole screen stops scrolling.
 * - The list follows the finger near either edge of the scrolling ancestor. Six
 *   exercises are two screens tall, and without this the last one can never
 *   reach the first position.
 * - The rectangles are measured once, at pick-up. Measuring inside `pointermove`
 *   would force a layout on every frame of the drag.
 */
export function ReorderableList<T>({ items, keyOf, onReorder, renderItem, className }: Props<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const pointerY = useRef(0);
  const [drag, setDrag] = useState<DragState | null>(null);

  const dragging = drag !== null;

  /**
   * Recomputes from the live pointer position and the live scroll offset. Written
   * as a state updater so it closes over nothing: the auto-scroll frame loop and
   * the pointer handler both call it, and neither can go stale.
   */
  const follow = useCallback(() => {
    setDrag((current) => {
      if (current === null) return current;
      const scrolled = (scrollerRef.current?.scrollTop ?? 0) - current.startScrollTop;
      const dy = pointerY.current - current.startY + scrolled;
      return { ...current, dy, to: targetIndex(current.rects, current.from, dy) };
    });
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const scroller = scrollerRef.current;
    if (scroller === null) return;

    let frame = requestAnimationFrame(function step() {
      const delta = edgeScrollDelta(scroller.getBoundingClientRect(), pointerY.current);

      if (delta !== 0) {
        scroller.scrollTop += delta;
        // The rows were measured in viewport space at pick-up, so scrolling has
        // to be folded back into the offset or the held row would drift.
        follow();
      }

      frame = requestAnimationFrame(step);
    });

    return () => cancelAnimationFrame(frame);
  }, [dragging, follow]);

  const startDrag = (index: number) => (event: PointerEvent<HTMLElement>) => {
    const rows = [...(containerRef.current?.children ?? [])];
    const boxes = rows.map((row) => row.getBoundingClientRect());
    const own = boxes[index];
    if (own === undefined) return;

    // The gap comes from the layout rather than a prop: a displaced row has to
    // move by exactly one slot, whatever CSS spacing the caller chose.
    const next = boxes[index + 1];
    const previous = boxes[index - 1];
    const gap =
      next !== undefined
        ? next.top - own.bottom
        : previous !== undefined
          ? own.top - previous.bottom
          : 0;

    scrollerRef.current = scrollParent(containerRef.current);
    pointerY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
    // A short tick confirms the pick-up on a row that is under the thumb and
    // therefore invisible. No-op wherever the API is absent.
    navigator.vibrate?.(10);

    setDrag({
      from: index,
      to: index,
      pointerId: event.pointerId,
      startY: event.clientY,
      startScrollTop: scrollerRef.current?.scrollTop ?? 0,
      dy: 0,
      rects: boxes.map((box) => ({ center: box.top + box.height / 2 })),
      span: own.height + gap,
    });
  };

  const movePointer = (event: PointerEvent<HTMLElement>) => {
    if (drag === null || event.pointerId !== drag.pointerId) return;
    pointerY.current = event.clientY;
    follow();
  };

  const endDrag = (commit: boolean) => (event: PointerEvent<HTMLElement>) => {
    if (drag === null || event.pointerId !== drag.pointerId) return;
    // `pointercancel` means the gesture was taken away mid-flight, so it is not
    // an instruction to move anything.
    if (commit && drag.to !== drag.from) onReorder(drag.from, drag.to);
    setDrag(null);
  };

  const moveByKey = (index: number) => (event: KeyboardEvent<HTMLElement>) => {
    const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const to = index + step;
    if (to >= 0 && to < items.length) onReorder(index, to);
  };

  /** Where a row sits while another one is being dragged over it. */
  const offsetOf = (index: number): number => {
    if (drag === null) return 0;
    if (index === drag.from) return drag.dy;
    if (drag.from < index && index <= drag.to) return -drag.span;
    if (drag.to <= index && index < drag.from) return drag.span;
    return 0;
  };

  return (
    <div ref={containerRef} className={className}>
      {items.map((item, index) => {
        const held = drag?.from === index;
        return (
          <div
            key={keyOf(item)}
            style={{
              transform: `translateY(${offsetOf(index)}px)`,
              // The held row tracks the finger, so it must not lag behind it.
              transition: held ? 'none' : 'transform var(--dur-2) var(--ease-mech)',
              zIndex: held ? 30 : undefined,
              position: held ? 'relative' : undefined,
            }}
          >
            {renderItem(item, index, {
              dragging: held,
              handleProps: {
                onPointerDown: startDrag(index),
                onPointerMove: movePointer,
                onPointerUp: endDrag(true),
                onPointerCancel: endDrag(false),
                onKeyDown: moveByKey(index),
                style: { touchAction: 'none' },
              },
            })}
          </div>
        );
      })}
    </div>
  );
}
