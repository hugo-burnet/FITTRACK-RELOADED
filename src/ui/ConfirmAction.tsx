import { useState } from 'react';
import { Button } from './Button';
import { t } from '@/i18n/fr';

type Props = {
  label: string;
  hint: string;
  /** Confirm label. Repeat the verb of `label` — "Supprimer" confirms "Supprimer". */
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
};

/**
 * Arms in place, then confirms. Not `window.confirm`: the native dialog is
 * unstyled, jarring, and blocks the WebView. Arming in place also leaves the
 * target where the thumb already is.
 *
 * Written for the Lot 2 diagnostic screen, moved to `ui/` in Lot 3 when
 * deleting an exercise needed exactly the same guard.
 */
export function ConfirmAction({
  label,
  hint,
  confirmLabel,
  danger = false,
  busy = false,
  onConfirm,
}: Props) {
  const [armed, setArmed] = useState(false);

  return (
    <div className="border-b border-[var(--border)] p-4 last:border-b-0">
      {/* The hint comes first: you read what a button does before you arm it. */}
      <p className="mb-4 text-sm leading-relaxed text-[var(--text-2)]">{hint}</p>

      {armed ? (
        <div className="flex gap-2">
          {/* Cancel is the filled one and sits first. Both variants are
              transparent by charter, so leaving them side by side would make
              the destructive move look exactly like backing out of it. */}
          <Button variant="secondary" onClick={() => setArmed(false)} fullWidth>
            {t('debug.cancel')}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={() => {
              setArmed(false);
              onConfirm();
            }}
            disabled={busy}
            fullWidth
          >
            {confirmLabel}
          </Button>
        </div>
      ) : (
        <Button
          variant={danger ? 'danger' : 'secondary'}
          onClick={() => setArmed(true)}
          disabled={busy}
          fullWidth
        >
          {label}
        </Button>
      )}
    </div>
  );
}
