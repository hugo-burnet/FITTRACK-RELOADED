import type { ReactNode } from 'react';
import { t } from '@/i18n/fr';
import { ArrowLeftIcon } from '@/ui/icons';

type Props = {
  title: string;
  /**
   * Draws the back arrow, on the left, before the title. Every screen that can
   * be left gets the identical control from here rather than spelling out its
   * own.
   */
  onBack?: () => void;
  /** Right-hand slot in the header: a count, an action. */
  action?: ReactNode;
  children: ReactNode;
};

/**
 * The frame every screen shares: one h1, one measure, one set of margins.
 * Centralised so no screen has to re-derive its own padding — the bottom of a
 * list disappearing behind the navigation is the classic bug here.
 *
 * The way back is an **arrow on the left**, not the destination's name on the
 * right. Reported from the phone: a word in the top corner reads as a label
 * rather than as something to press, and it also put a second piece of text
 * beside a title the user chose, on 375px. The arrow is the mark every phone
 * already uses, and it costs the title no room.
 *
 * Reaching the top corner one-handed is not the concern it would be for a
 * primary action: every screen long enough to matter carries its real exit on a
 * sticky bar in the thumb zone.
 */
export function Screen({ title, onBack, action, children }: Props) {
  return (
    <section className="mx-auto flex min-h-full w-full max-w-[36rem] flex-col px-4 pb-8">
      <header className="flex min-h-16 items-center gap-2 pt-5 pb-4">
        {onBack && (
          <button
            type="button"
            aria-label={t('common.back')}
            onClick={onBack}
            className="-ml-3 flex size-12 shrink-0 items-center justify-center rounded-xl
              text-[var(--text-1)] active:bg-[var(--surface-1)]"
          >
            <ArrowLeftIcon />
          </button>
        )}
        {/* Truncates rather than wraps: a title is the one line you scan, and a
            routine's name belongs to the user — it can be anything. */}
        <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight text-[var(--text-1)]">
          {title}
        </h1>
        {action}
      </header>
      {/* Grows to fill the screen so a lone empty state can centre itself in it. */}
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}
