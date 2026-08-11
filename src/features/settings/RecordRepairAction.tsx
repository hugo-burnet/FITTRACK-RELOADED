import { useRef, useState } from 'react';
import { rebuildAllRecords } from '@/data/repositories/personalRecords';
import { t } from '@/i18n/fr';
import { Button, ConfirmSheet, SectionTitle } from '@/ui';

export function RecordRepairAction() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<string>();
  const [failed, setFailed] = useState(false);
  const running = useRef(false);

  const repair = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setReport(undefined);
    setFailed(false);
    try {
      const result = await rebuildAllRecords();
      setReport(
        t('settings.recordRepairDone', {
          created: result.created,
          updated: result.updated,
          deleted: result.deleted,
        }),
      );
    } catch {
      setFailed(true);
      setReport(t('settings.recordRepairFailed'));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  return (
    <section>
      <SectionTitle>{t('settings.recordsSection')}</SectionTitle>
      <div className="rounded-2xl bg-[var(--surface-1)] p-4">
        <p className="text-base text-[var(--text-1)]">{t('settings.recordRepairTitle')}</p>
        <p className="mt-1 mb-4 text-sm leading-relaxed text-[var(--text-2)]">
          {t('settings.recordRepairHint')}
        </p>
        <Button
          type="button"
          variant="secondary"
          fullWidth
          disabled={busy}
          onClick={() => setConfirmOpen(true)}
        >
          {t(busy ? 'settings.recordRepairWorking' : 'settings.recordRepairAction')}
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
        title={t('settings.recordRepairConfirmTitle')}
        body={t('settings.recordRepairConfirmBody')}
        confirmLabel={t('settings.recordRepairConfirmAction')}
        onConfirm={() => void repair()}
      />
    </section>
  );
}
