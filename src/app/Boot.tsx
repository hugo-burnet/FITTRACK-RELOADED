import { useState } from 'react';
import { t } from '@/i18n/fr';

/**
 * Held on screen until the seed resolves. Deliberately static: nothing spins,
 * nothing pulses. On a warm start this is visible for a few dozen milliseconds,
 * and an animation that never completes its first cycle reads as a glitch.
 */
export function BootScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-[var(--surface-0)]">
      <p className="text-2xl font-semibold tracking-tight text-[var(--text-1)]">{t('app.name')}</p>
      <p className="label-xs font-semibold text-[var(--text-2)]">{t('boot.loading')}</p>
    </div>
  );
}

/**
 * Shown when the seed failed. A fixed overlay rather than a flex sibling: the
 * shell's layout chain was measured on a real phone at Lot 1 and a degraded
 * state is not a reason to disturb it.
 */
export function SeedErrorBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div
      role="alert"
      className="safe-top fixed inset-x-0 top-0 z-50 border-b-2 border-[var(--color-warn)]
        bg-[var(--surface-2)]"
    >
      <div className="mx-auto flex max-w-[36rem] items-center gap-3 px-4 py-2">
        <p className="flex-1 text-sm leading-snug text-[var(--text-1)]">{t('boot.seedFailed')}</p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="min-h-12 shrink-0 px-3 text-sm font-semibold text-[var(--text-2)]"
        >
          {t('boot.dismiss')}
        </button>
      </div>
    </div>
  );
}
