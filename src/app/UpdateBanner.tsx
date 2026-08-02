import { useState, useSyncExternalStore } from 'react';
import { applyUpdate, isUpdateAvailable, subscribeAppUpdate } from '@/platform/appUpdate';
import { t } from '@/i18n/fr';

/**
 * "Une nouvelle version est disponible", with the two answers.
 *
 * Mounted at the top, as a fixed overlay rather than a flex sibling — the same
 * exception `SeedErrorBanner` takes, for the same reason: the shell's layout
 * chain was measured on a real phone at Lot 1, and a strip that appears at an
 * unpredictable moment must not reflow the screen underneath it. Reflowing the
 * live session screen mid-set is precisely the accident to avoid.
 *
 * "Plus tard" only hides the strip. The worker keeps waiting, and the update
 * lands at the next cold start; the alternative — nagging on every render — is
 * how a user learns to dismiss without reading.
 */
export function UpdateBanner() {
  const available = useSyncExternalStore(subscribeAppUpdate, isUpdateAvailable, () => false);
  const [postponed, setPostponed] = useState(false);

  if (!available || postponed) return null;

  return (
    <div
      role="alert"
      className="safe-top fixed inset-x-0 top-0 z-50 border-b-2 border-[var(--color-accent)]
        bg-[var(--surface-2)]"
    >
      <div className="mx-auto flex max-w-[36rem] items-center gap-3 px-4 py-2">
        <p className="flex-1 text-sm leading-snug text-[var(--text-1)]">{t('update.available')}</p>
        <button
          type="button"
          onClick={() => setPostponed(true)}
          className="min-h-12 shrink-0 px-3 text-sm font-semibold text-[var(--text-2)]"
        >
          {t('update.later')}
        </button>
        <button
          type="button"
          onClick={() => void applyUpdate()}
          className="min-h-12 shrink-0 rounded-xl bg-[var(--color-accent)] px-4 text-sm
            font-semibold text-[var(--color-accent-fg)]"
        >
          {t('update.reload')}
        </button>
      </div>
    </div>
  );
}
