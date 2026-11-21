import { useState } from 'react';
import { t } from '@/i18n/fr';
import { Button, ConfirmSheet, Sheet } from '@/ui';

type Props = {
  open: boolean;
  workoutName: string;
  /** `null` while the durable workout detail is still loading. */
  validatedSetCount: number | null;
  onClose: () => void;
  onResume: () => void;
  onFinish: () => void;
  onDiscard: () => void;
};

export function ActiveWorkoutRecoverySheet({
  open,
  workoutName,
  validatedSetCount,
  onClose,
  onResume,
  onFinish,
  onDiscard,
}: Props) {
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open && confirmingDiscard) setConfirmingDiscard(false);
  }

  const discardBody =
    validatedSetCount === null
      ? ''
      : validatedSetCount === 0
        ? t('recovery.discardBodyNone')
        : validatedSetCount === 1
          ? t('recovery.discardBodyOne')
          : t('recovery.discardBody', { count: validatedSetCount });

  return (
    <>
      <Sheet
        open={open && !confirmingDiscard}
        onClose={onClose}
        title={t('recovery.title')}
      >
        <p className="text-base font-semibold text-[var(--text-1)]">{workoutName}</p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">
          {t('recovery.body')}
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <Button variant="primary" size="lg" fullWidth onClick={onResume}>
            {t('recovery.resume')}
          </Button>
          <Button size="lg" fullWidth onClick={onFinish}>
            {t('recovery.finish')}
          </Button>
          <Button
            variant="danger"
            size="lg"
            fullWidth
            disabled={validatedSetCount === null}
            onClick={() => {
              if (validatedSetCount !== null) setConfirmingDiscard(true);
            }}
          >
            {t('recovery.discard')}
          </Button>
        </div>
      </Sheet>

      <ConfirmSheet
        open={open && confirmingDiscard && validatedSetCount !== null}
        onClose={() => setConfirmingDiscard(false)}
        title={t('recovery.discardTitle')}
        body={discardBody}
        confirmLabel={t('recovery.discardConfirm')}
        danger
        onConfirm={() => {
          setConfirmingDiscard(false);
          onDiscard();
        }}
      />
    </>
  );
}
