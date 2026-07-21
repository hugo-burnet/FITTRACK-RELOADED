import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
};

/** Past this many pixels of downward drag, releasing dismisses the sheet. */
const DISMISS_AFTER_PX = 96;

/**
 * The container for every picker in the app: it rises from the bottom, inside
 * thumb reach, and closes by dragging down, tapping the backdrop, or Escape.
 */
export function Sheet({ open, onClose, title, children }: Props) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  const [mounted, setMounted] = useState(open);
  const [raised, setRaised] = useState(false);
  const [dragOrigin, setDragOrigin] = useState<number | null>(null);
  const [dragY, setDragY] = useState(0);

  const dragging = dragOrigin !== null;

  // Adjusted during render rather than in an effect: an effect would paint one
  // frame of the sheet before it is positioned off-screen, so it would flash.
  if (open && !mounted) setMounted(true);
  if (!open && raised) setRaised(false);

  // One frame after mounting so the browser has a "down" position to animate from.
  useEffect(() => {
    if (!mounted) return;
    const frame = requestAnimationFrame(() => setRaised(true));
    return () => cancelAnimationFrame(frame);
  }, [mounted]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    setDragOrigin(event.clientY);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragOrigin === null) return;
    setDragY(Math.max(0, event.clientY - dragOrigin));
  };

  const endDrag = () => {
    if (dragOrigin === null) return;
    setDragOrigin(null);
    setDragY(0);
    if (dragY > DISMISS_AFTER_PX) onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 transition-opacity duration-[var(--dur-2)]
          ease-[var(--ease-mech)]"
        style={{ opacity: raised ? 1 : 0 }}
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onTransitionEnd={() => {
          if (!open) setMounted(false);
        }}
        className="relative max-h-[88%] overflow-y-auto overscroll-contain rounded-t-3xl
          border-t border-[var(--border)] bg-[var(--surface-1)] outline-none"
        style={{
          transform: raised ? `translateY(${dragY}px)` : 'translateY(100%)',
          transition: dragging ? 'none' : 'transform var(--dur-2) var(--ease-mech)',
        }}
      >
        <header
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          className="sticky top-0 touch-none bg-[var(--surface-1)] pt-3 pb-4"
        >
          <div className="mx-auto h-1 w-9 rounded-full bg-[var(--border)]" />
          <h2 id={titleId} className="mt-4 px-5 text-lg font-semibold text-[var(--text-1)]">
            {title}
          </h2>
        </header>

        <div className="safe-bottom px-5 pb-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
