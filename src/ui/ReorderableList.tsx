import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { edgeScrollDelta } from './edgeScroll';

/** Pointer handlers applied only to the drag handle so the row can still scroll. */
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
  keyOf: (item: T) => string;
  onReorder: (from: number, to: number) => void;
  renderItem: (item: T, index: number, state: ItemState) => ReactNode;
  className?: string;
  disabled?: boolean;
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
  span: number;
};

/** Finds the nearest scrolling ancestor without coupling to the app shell. */
function scrollParent(node: HTMLElement | null): HTMLElement | null {
  for (let element = node?.parentElement ?? null; element; element = element.parentElement) {
    const overflow = getComputedStyle(element).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && element.scrollHeight > element.clientHeight)
      return element;
  }
  return null;
}

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

/** Touch-compatible reordering with edge auto-scroll and keyboard controls. */
export function ReorderableList<T>({
  items,
  keyOf,
  onReorder,
  renderItem,
  className,
  disabled = false,
}: Props<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const pointerY = useRef(0);
  const [drag, setDrag] = useState<DragState | null>(null);

  const dragging = drag !== null;

  useEffect(() => {
    if (disabled) setDrag(null);
  }, [disabled]);

  // A state updater keeps both pointer and auto-scroll callers free of stale state.
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
        // Account for scrolling after the initial viewport-space measurement.
        follow();
      }

      frame = requestAnimationFrame(step);
    });

    return () => cancelAnimationFrame(frame);
  }, [dragging, follow]);

  const startDrag = (index: number) => (event: PointerEvent<HTMLElement>) => {
    if (disabled) return;
    const rows = [...(containerRef.current?.children ?? [])];
    const boxes = rows.map((row) => row.getBoundingClientRect());
    const own = boxes[index];
    if (own === undefined) return;

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
    // A browser-cancelled gesture must not reorder.
    if (commit && drag.to !== drag.from) onReorder(drag.from, drag.to);
    setDrag(null);
  };

  const moveByKey = (index: number) => (event: KeyboardEvent<HTMLElement>) => {
    if (disabled) return;
    const step = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const to = index + step;
    if (to >= 0 && to < items.length) onReorder(index, to);
  };

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
