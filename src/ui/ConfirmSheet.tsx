import { Button } from './Button';
import { Sheet } from './Sheet';
import { t } from '@/i18n/fr';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** What actually happens. Not a rhetorical "es-tu sûr ?". */
  body: string;
  /** Repeat the verb that armed it — "Supprimer" confirms "Supprimer". */
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
};

/**
 * A decision that deserves a second tap, taken at the bottom of the screen.
 *
 * `ConfirmAction` arms in place and belongs inside a card; this is its sheet
 * form, for an action reached through a "⋯" menu where there is no row to arm.
 *
 * Cancel is the filled button and comes first, exactly as on the Lot 2
 * diagnostic screen: `danger` and `ghost` are both transparent by charter, so
 * side by side the destructive move would look like backing out of it.
 */
export function ConfirmSheet({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  danger = false,
  onConfirm,
}: Props) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <p className="mb-6 text-base leading-relaxed text-[var(--text-2)]">{body}</p>
      <div className="flex gap-2">
        <Button variant="secondary" size="lg" onClick={onClose} fullWidth>
          {t('exercise.cancel')}
        </Button>
        <Button
          variant={danger ? 'danger' : 'primary'}
          size="lg"
          onClick={() => {
            onConfirm();
            onClose();
          }}
          fullWidth
        >
          {confirmLabel}
        </Button>
      </div>
    </Sheet>
  );
}
