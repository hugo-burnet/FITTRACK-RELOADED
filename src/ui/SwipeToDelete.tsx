import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';

type Props = {
  label: string;
  onDelete: () => void;
  children: ReactNode;
};

const ENGAGE_PX = 10;
const AFTER_WORD_PX = 16;

// Never couple a data write to transitionend, which may not fire in background.
const EXIT_MS = 220;

const WORD_INSET_PX = 16;
const THRESHOLD_MIN_PX = 72;
const THRESHOLD_MAX_PX = 170;

/** Horizontal deletion shortcut; the set menu remains the keyboard-accessible path. */
export function SwipeToDelete({ label, onDelete, children }: Props) {
  const wordRef = useRef<HTMLSpanElement>(null);
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const swallowClick = useRef(false);
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

  // Keep the latest callback without restarting the exit timer on each render.
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
      // Vertical movement belongs to page scrolling.
      if (Math.abs(dy) > Math.abs(dx) || dx < -ENGAGE_PX) {
        origin.current = null;
        return;
      }
      if (dx < ENGAGE_PX) return;
      setEngaged(true);
      swallowClick.current = true;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is optional; local events still track the gesture.
      }
    }

    const raw = Math.max(0, dx - ENGAGE_PX);
    const next = raw > threshold ? threshold + (raw - threshold) * 0.4 : raw;

    if (next >= threshold && !ticked.current) {
      ticked.current = true;
      navigator.vibrate?.(10);
    }
    if (next < threshold) ticked.current = false;

    setTravel(next);
  };

  const endSwipe = (commit: boolean) => (event: ReactPointerEvent<HTMLDivElement>) => {
    if (origin.current?.id !== event.pointerId) return;
    origin.current = null;
    ticked.current = false;
    setEngaged(false);

    // A browser-cancelled gesture must never delete.
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
      // Swallow the click produced by the completed swipe.
      onClickCapture={(event) => {
        if (!swallowClick.current) return;
        swallowClick.current = false;
        event.stopPropagation();
        event.preventDefault();
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[var(--surface-2)]"
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
