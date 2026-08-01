import { useState } from 'react';
import { t } from '@/i18n/fr';
import { Button, Sheet } from '@/ui';

export function DeloadSheet({
  open,
  onClose,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  onApply: () => Promise<unknown>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setFailed(false);
  }

  const apply = async () => {
    if (submitting) return;
    setSubmitting(true);
    setFailed(false);
    try {
      await onApply();
      onClose();
    } catch {
      setFailed(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={t('workout.deloadTitle')}>
      <p className="mb-6 text-base leading-relaxed text-[var(--text-2)]">
        {t('workout.deloadBody')}
      </p>
      {failed && (
        <p role="alert" className="mb-4 text-sm text-[var(--danger-ink)]">
          {t('workout.deloadError')}
        </p>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" size="lg" onClick={onClose} fullWidth>
          {t('exercise.cancel')}
        </Button>
        <Button size="lg" disabled={submitting} onClick={() => void apply()} fullWidth>
          {t('workout.deloadConfirm')}
        </Button>
      </div>
    </Sheet>
  );
}
