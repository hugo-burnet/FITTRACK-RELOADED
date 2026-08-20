import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { inspectHistoryResnapshot, resnapshotHistory } from '@/data/repositories/historyRepair';
import { t } from '@/i18n/fr';
import { Button, ConfirmSheet, SectionTitle } from '@/ui';

export function HistoryUpdateAction() {
  const preview = useLiveQuery(inspectHistoryResnapshot, []);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string>();
  const [failed, setFailed] = useState(false);

  const updateHistory = async () => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    setReport(undefined);
    try {
      const { repaired } = await resnapshotHistory();
      setReport(
        repaired === 0
          ? t('settings.repairDoneNone')
          : t(repaired === 1 ? 'settings.repairDoneOne' : 'settings.repairDone', { repaired }),
      );
    } catch {
      setFailed(true);
      setReport(t('settings.repairFailed'));
    } finally {
      setBusy(false);
    }
  };

  const changed = preview?.changed ?? 0;

  return (
    <section>
      <SectionTitle>{t('settings.repairLink')}</SectionTitle>
      <div className="rounded-2xl bg-[var(--surface-1)] p-4">
        <p className="text-sm leading-relaxed text-[var(--text-2)]">{t('settings.repairHint')}</p>

        <div className="my-4 border-y border-[var(--border)] py-4">
          <p className="font-semibold text-[var(--text-1)]">
            {preview === undefined
              ? t('settings.repairPreviewLoading')
              : changed === 0
                ? t('settings.repairPreviewCurrent')
                : t('settings.repairPreviewChanges', { count: changed })}
          </p>
          {preview !== undefined && changed > 0 && (
            <p className="mt-1 text-sm leading-relaxed text-[var(--text-2)]">
              {t('settings.repairPreviewDetails', {
                muscles: preview.muscles,
                names: preview.names,
                equipment: preview.equipment,
                measurements: preview.measurements,
              })}
            </p>
          )}
        </div>

        <Button
          type="button"
          variant="secondary"
          fullWidth
          disabled={preview === undefined || changed === 0 || busy}
          onClick={() => setConfirmOpen(true)}
        >
          {busy ? t('debug.working') : t('settings.repairConfirmAction')}
        </Button>
      </div>

      {report !== undefined && (
        <p
          role={failed ? 'alert' : 'status'}
          className={`mt-3 px-1 text-sm leading-relaxed ${
            failed ? 'text-[var(--danger-ink)]' : 'text-[var(--text-2)]'
          }`}
        >
          {report}
        </p>
      )}

      <ConfirmSheet
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('settings.repairConfirmTitle')}
        body={t('settings.repairConfirmBody', { count: changed })}
        confirmLabel={t('settings.repairConfirmAction')}
        onConfirm={() => void updateHistory()}
      />
    </section>
  );
}
