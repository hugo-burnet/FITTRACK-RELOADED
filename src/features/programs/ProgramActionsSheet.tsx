import { useState } from 'react';
import { t } from '@/i18n/fr';
import { ActionSheet, Button, ConfirmSheet, Input, Sheet } from '@/ui';

interface Props {
  open: boolean;
  hasStarted: boolean;
  canComplete: boolean;
  /** A completed block is read-only: neither its split nor its dates move again. */
  canEdit: boolean;
  onClose: () => void;
  onEditFuture: () => void;
  onShift: (days: number) => Promise<void>;
  onComplete: () => Promise<void>;
  onDelete: () => Promise<void>;
}

export function ProgramActionsSheet({
  open,
  hasStarted,
  canComplete,
  canEdit,
  onClose,
  onEditFuture,
  onShift,
  onComplete,
  onDelete,
}: Props) {
  const [shiftOpen, setShiftOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [weeks, setWeeks] = useState('');
  const [working, setWorking] = useState(false);

  const parsedWeeks = Number(weeks);
  const validWeeks = weeks.trim() !== '' && Number.isInteger(parsedWeeks) && parsedWeeks !== 0;

  return (
    <>
      <ActionSheet
        open={open}
        onClose={onClose}
        title={t('program.actionsTitle')}
        actions={[
          ...(canEdit
            ? [
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
              ]
            : []),
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
          // Toujours proposée, y compris sur un bloc terminé : c'est le seul
          // moyen de faire le ménage, et l'historique n'y perd rien.
          {
            label: t('program.deleteAction'),
            hint: t('program.deleteHint'),
            danger: true,
            onSelect: () => setDeleteOpen(true),
          },
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
            label={t('program.shiftWeeksLabel')}
            hint={t('program.shiftWeeksHint')}
            value={weeks}
            onChange={(event) => setWeeks(event.target.value)}
          />
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!validWeeks || working}
            onClick={() => {
              if (!validWeeks || working) return;
              setWorking(true);
              void onShift(parsedWeeks * 7).finally(() => {
                setWorking(false);
                setShiftOpen(false);
                setWeeks('');
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

      <ConfirmSheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('program.deleteTitle')}
        body={t('program.deleteBody')}
        confirmLabel={t('program.deleteAction')}
        danger
        onConfirm={() => void onDelete()}
      />
    </>
  );
}
