import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { t } from '@/i18n/fr';
import { CloseIcon } from './icons';

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

  /**
   * Focus moves into the dialog **once, when it opens** — and never again.
   *
   * `open` is the only dependency on purpose. Callers pass `onClose` as an
   * inline arrow, so it has a fresh identity on every parent render; a sheet
   * whose fields write straight through to the database re-renders on every
   * keystroke, and re-running this would pull focus off the input each time.
   * On a phone that closes the keyboard — measured: the caret left the field on
   * the very first character, which made "82,5" impossible to type.
   */
  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
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
        aria-label={t('common.close')}
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
          <div className="mt-4 flex items-center gap-2 px-5">
            <h2
              id={titleId}
              className="min-w-0 flex-1 truncate text-lg font-semibold text-[var(--text-1)]"
            >
              {title}
            </h2>
            {/* A visible way out. Dragging the panel down works and stays, but it
                is a gesture you have to already know — reported from the phone,
                where it was the only way to put a sheet away.
                `stopPropagation` on the pointer: the header is the drag surface,
                so without it pressing this button would begin a drag instead. */}
            <button
              type="button"
              aria-label={t('common.close')}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onClose}
              className="-my-2 -mr-3 flex size-12 shrink-0 items-center justify-center rounded-xl
                text-[var(--text-2)] active:bg-[var(--surface-2)]"
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="safe-bottom px-5 pb-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
