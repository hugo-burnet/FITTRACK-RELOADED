import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { replaceMissingProgramRoutine } from '@/data/repositories/programs';
import { createRoutine, listRoutineSummaries } from '@/data/repositories/routines';
import { t } from '@/i18n/fr';
import { Button, Input, Sheet } from '@/ui';

interface Props {
  open: boolean;
  programId: string;
  entryId: string;
  effectiveFromWeekIndex: number;
  onClose: () => void;
}

export function MissingRoutineReplacementSheet({
  open,
  programId,
  entryId,
  effectiveFromWeekIndex,
  onClose,
}: Props) {
  const routines = useLiveQuery(listRoutineSummaries, []);
  const [routineId, setRoutineId] = useState('');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const close = () => {
    setRoutineId('');
    setNewName('');
    setFailed(false);
    onClose();
  };

  const replaceWith = async (replacementRoutineId: string) => {
    if (busy || replacementRoutineId === '') return;
    setBusy(true);
    setFailed(false);
    try {
      await replaceMissingProgramRoutine(
        programId,
        effectiveFromWeekIndex,
        entryId,
        replacementRoutineId,
      );
      close();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const createAndReplace = async () => {
    const name = newName.trim();
    if (busy || name === '') return;
    setBusy(true);
    setFailed(false);
    try {
      const routine = await createRoutine(name);
      await replaceMissingProgramRoutine(programId, effectiveFromWeekIndex, entryId, routine.id);
      close();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={close} title={t('program.replaceRoutineTitle')}>
      <div className="flex flex-col gap-5 pb-3">
        <p className="text-sm leading-relaxed text-[var(--text-2)]">
          {t('program.replaceRoutineHint', { week: effectiveFromWeekIndex + 1 })}
        </p>

        {(routines ?? []).length > 0 ? (
          <>
            <label className="flex flex-col gap-2">
              <span className="label-xs font-semibold text-[var(--text-2)]">
                {t('program.replaceRoutineLabel')}
              </span>
              <select
                aria-label={t('program.replaceRoutineLabel')}
                value={routineId}
                disabled={routines === undefined || busy}
                onChange={(event) => setRoutineId(event.target.value)}
                className="min-h-12 w-full rounded-lg bg-[var(--surface-2)] px-3 text-base
                  text-[var(--text-1)] outline-none focus:ring-2 focus:ring-[var(--accent-ink)]"
              >
                <option value="">{t('program.chooseRoutine')}</option>
                {(routines ?? []).map(({ routine }) => (
                  <option key={routine.id} value={routine.id}>
                    {routine.name}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="primary"
              fullWidth
              disabled={routineId === '' || busy}
              onClick={() => void replaceWith(routineId)}
            >
              {t('program.replaceRoutineConfirm')}
            </Button>
          </>
        ) : (
          <p className="text-sm leading-relaxed text-[var(--text-2)]">
            {routines === undefined
              ? t('program.routinesLoading')
              : t('program.replaceRoutineEmpty')}
          </p>
        )}

        {routines !== undefined && (
          <div className="border-t border-[var(--border)] pt-5">
            <div className="flex flex-col gap-4">
              <Input
                label={t('program.replaceRoutineCreateLabel')}
                placeholder={t('program.replaceRoutineCreatePlaceholder')}
                value={newName}
                disabled={busy}
                onChange={(event) => setNewName(event.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                fullWidth
                disabled={newName.trim() === '' || busy}
                onClick={() => void createAndReplace()}
              >
                {t('program.replaceRoutineCreate')}
              </Button>
            </div>
          </div>
        )}

        {failed && (
          <p role="alert" className="text-sm leading-relaxed text-[var(--danger-ink)]">
            {t('program.replaceRoutineFailed')}
          </p>
        )}
      </div>
    </Sheet>
  );
}
