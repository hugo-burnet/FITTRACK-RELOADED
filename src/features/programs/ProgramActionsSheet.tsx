import { useState } from 'react';
import { t } from '@/i18n/fr';
import { ActionSheet, Button, ConfirmSheet, Input, Sheet } from '@/ui';

interface Props {
  open: boolean;
  hasStarted: boolean;
  canComplete: boolean;
  onClose: () => void;
  onEditFuture: () => void;
  onShift: (days: number) => Promise<void>;
  onComplete: () => Promise<void>;
}

export function ProgramActionsSheet({
  open,
  hasStarted,
  canComplete,
  onClose,
  onEditFuture,
  onShift,
  onComplete,
}: Props) {
  const [shiftOpen, setShiftOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [days, setDays] = useState('');
  const [working, setWorking] = useState(false);

  const parsedDays = Number(days);
  const validDays = days.trim() !== '' && Number.isInteger(parsedDays) && parsedDays !== 0;

  return (
    <>
      <ActionSheet
        open={open}
        onClose={onClose}
        title={t('program.actionsTitle')}
        actions={[
          {
            label: t('program.editFuture'),
            hint: t('program.editFutureHint'),
            onSelect: onEditFuture,
          },
          {
            label: t('program.shiftAction'),
            hint: t('program.shiftActionHint'),
            onSelect: () => setShiftOpen(true),
          },
          ...(canComplete
            ? [
                {
                  label: t('program.completeAction'),
                  hint: t('program.completeHint'),
                  danger: true,
                  onSelect: () => setCompleteOpen(true),
                },
              ]
            : []),
        ]}
      />

      <Sheet open={shiftOpen} onClose={() => setShiftOpen(false)} title={t('program.shiftTitle')}>
        <div className="flex flex-col gap-5 pb-2">
          {hasStarted && (
            <p className="text-sm leading-relaxed text-[var(--danger-ink)]">
              {t('program.shiftStartedWarning')}
            </p>
          )}
          <Input
            type="number"
            step="1"
            inputMode="numeric"
            label={t('program.shiftDaysLabel')}
            hint={t('program.shiftDaysHint')}
            value={days}
            onChange={(event) => setDays(event.target.value)}
          />
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!validDays || working}
            onClick={() => {
              if (!validDays || working) return;
              setWorking(true);
              void onShift(parsedDays).finally(() => {
                setWorking(false);
                setShiftOpen(false);
                setDays('');
              });
            }}
          >
            {t('program.shiftConfirm')}
          </Button>
        </div>
      </Sheet>

      <ConfirmSheet
        open={completeOpen}
        onClose={() => setCompleteOpen(false)}
        title={t('program.completeTitle')}
        body={t('program.completeBody')}
        confirmLabel={t('program.completeAction')}
        danger
        onConfirm={() => void onComplete()}
      />
    </>
  );
}
