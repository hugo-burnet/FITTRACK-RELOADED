import { useEffect, useRef, useState } from 'react';
import { t } from '@/i18n/fr';

type Props = {
  /** What was deleted, in its own words — « 102,5 × 8 », « Série 3 ». */
  reading: string;
  onUndo: () => void;
  /** Fired when the strip has finished closing. The slot is free after this. */
  onExpire: () => void;
};

/** How long the way back stays open. A rest between sets is longer than this. */
const GRACE_MS = 6000;

/** `--dur-2`, in a number: the collapse has to be over before the slot goes. */
const CLOSE_MS = 220;

/**
 * The way back from a deletion, standing in the slot the deleted row left.
 *
 * Not a toast. A toast at the bottom of the screen can say *that* something was
 * deleted but never *which* — and this screen holds twenty near-identical rows
 * of two numbers each. A strip sitting between set 2 and set 3 needs no words to
 * say which one went, and it appears under the thumb that just swiped rather
 * than at the far edge of a phone being held one-handed. It also costs the app
 * no overlay, no portal and no z-index: only a table can keep its own undo in
 * the gap, and this screen is a table.
 *
 * It carries no rank. The rows below have already renumbered — the deletion is
 * real, written, and survives a crash — so a strip with a number on it would be
 * claiming a place in a sequence it is no longer part of.
 */
export function UndoRow({ reading, onUndo, onExpire }: Props) {
  const [closing, setClosing] = useState(false);

  // Pinned, not depended on: the caller passes an inline arrow and the live
  // grid above re-renders on every keystroke, which would restart the six
  // seconds each time and leave the strip standing for the whole session.
  const expire = useRef(onExpire);
  useEffect(() => {
    expire.current = onExpire;
  });

  useEffect(() => {
    const timer = setTimeout(() => setClosing(true), GRACE_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => expire.current(), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [closing]);

  return (
    // The 1fr → 0fr grid rather than a height: the strip closes without anyone
    // having to know how tall it is, and the rows below rise into the gap on the
    // one curve the app owns. Reduced motion flattens it, like everything else.
    <div
      // `role` on the wrapper, never on the button: it would replace the
      // button's own role, and the strip would be announced as a reading with
      // no hint that it is the way back.
      role="status"
      className="grid transition-[grid-template-rows] duration-[var(--dur-2)] ease-[var(--ease-mech)]"
      style={{ gridTemplateRows: closing ? '0fr' : '1fr' }}
    >
      <div className="overflow-hidden">
        <button
          type="button"
          aria-label={t('common.undoDelete', { reading })}
          onClick={onUndo}
          className="flex min-h-14 w-full items-center gap-3 bg-[var(--surface-2)] px-4 text-left
            active:bg-[var(--surface-1)]"
        >
          <span className="metric min-w-0 flex-1 truncate text-sm text-[var(--text-2)] line-through">
            {reading}
          </span>
          <span className="shrink-0 text-base font-semibold text-[var(--accent-ink)]">
            {t('common.undo')}
          </span>
        </button>
      </div>
    </div>
  );
}
