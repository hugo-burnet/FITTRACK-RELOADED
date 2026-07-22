import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Screen } from '@/app/Screen';
import { db } from '@/data/db';
import { seedDatabase } from '@/data/seed/seedDatabase';
import { t } from '@/i18n/fr';
import { Card, ConfirmAction, ListRow, SectionTitle } from '@/ui';

/**
 * The screen that answers "is it the database or the display?" in five seconds.
 * It stays in the app on purpose: a diagnostic tool, not technical debt.
 */

const megabytes = (bytes: number): string =>
  (bytes / 1_048_576).toLocaleString('fr-FR', { maximumFractionDigits: 1 });

export function DebugScreen() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [storage, setStorage] = useState<StorageEstimate | null>(null);

  // Counting every table also observes every table, so the figures update on
  // their own after a reset or a re-seed.
  const counts = useLiveQuery(() =>
    Promise.all(db.tables.map(async (table) => [table.name, await table.count()] as const)),
  );

  const recent = useLiveQuery(() =>
    db.exercises.orderBy('updatedAt').reverse().limit(20).toArray(),
  );

  useEffect(() => {
    if (navigator.storage === undefined) return;
    // Re-read after every write so the figure follows the reset button.
    void navigator.storage.estimate().then(setStorage, () => setStorage(null));
  }, [counts]);

  const run = (action: () => Promise<void>, done: string) => async () => {
    setBusy(true);
    setMessage(null);
    try {
      await action();
      setMessage(done);
    } catch (error) {
      console.error('Action de diagnostic échouée', error);
      setMessage(t('debug.failed'));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    await db.delete();
    await db.open();
  };

  return (
    <Screen
      title={t('debug.title')}
      onBack={() => void navigate('/settings')}
    >
      <div className="flex flex-col gap-9">
        <section>
          <SectionTitle>{t('debug.storageSection')}</SectionTitle>
          <Card>
            {storage === null || storage.usage === undefined ? (
              <p className="p-4 text-sm leading-relaxed text-[var(--text-2)]">
                {t('debug.storageUnavailable')}
              </p>
            ) : (
              <div className="p-4">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="label-xs font-semibold text-[var(--text-2)]">
                    {t('debug.storageUsed')}
                  </span>
                  <span className="metric text-3xl leading-none font-semibold text-[var(--text-1)]">
                    {megabytes(storage.usage)}
                    {/* Never label-xs on an SI symbol: it is Mo, not MO. */}
                    <span className="ml-1.5 text-base font-medium text-[var(--text-2)]">
                      {t('debug.storageUnit')}
                    </span>
                  </span>
                </div>
                {storage.quota !== undefined && (
                  // --text-2, not --text-3: measured at 2.3:1 on the light theme
                  // card, the exact failure Lot 1 documented. --text-3 is for
                  // values that are deliberately echoes — Lot 5's previous value,
                  // placeholders. A quota is a figure you actually read.
                  <p className="mt-2 text-right text-sm text-[var(--text-2)]">
                    {t('debug.storageQuota', { quota: megabytes(storage.quota) })}
                  </p>
                )}
              </div>
            )}
          </Card>
        </section>

        <section>
          <SectionTitle>{t('debug.tablesSection')}</SectionTitle>
          <Card>
            {/* Table names are identifiers, not prose: they stay as the schema
                spells them, which is the whole point of this screen. */}
            {(counts ?? []).map(([name, count]) => (
              <ListRow
                key={name}
                title={name}
                trailing={
                  <span className="tabular text-base font-semibold text-[var(--text-1)]">
                    {count.toLocaleString('fr-FR')}
                  </span>
                }
              />
            ))}
          </Card>
        </section>

        <section>
          <SectionTitle>{t('debug.recentSection')}</SectionTitle>
          <Card>
            {recent !== undefined && recent.length === 0 ? (
              <p className="p-4 text-sm leading-relaxed text-[var(--text-2)]">
                {t('debug.recentEmpty')}
              </p>
            ) : (
              (recent ?? []).map((exercise) => (
                <ListRow
                  key={exercise.id}
                  title={exercise.name}
                  subtitle={`${exercise.primaryMuscle} · ${exercise.equipment}`}
                  trailing={
                    exercise.isCustom === 1 ? (
                      <span className="label-xs font-semibold text-[var(--accent-ink)]">perso</span>
                    ) : undefined
                  }
                />
              ))
            )}
          </Card>
        </section>

        <section>
          <SectionTitle>{t('debug.actionsSection')}</SectionTitle>
          <Card>
            <ConfirmAction
              label={t('debug.reseed')}
              hint={t('debug.reseedHint')}
              confirmLabel={t('debug.confirm')}
              busy={busy}
              onConfirm={() => void run(seedDatabase, t('debug.reseedDone'))()}
            />
            <ConfirmAction
              label={t('debug.reset')}
              hint={t('debug.resetHint')}
              confirmLabel={t('debug.confirm')}
              danger
              busy={busy}
              onConfirm={() => void run(reset, t('debug.resetDone'))()}
            />
          </Card>

          {busy && <p className="mt-3 px-1 text-sm text-[var(--text-2)]">{t('debug.working')}</p>}
          {message !== null && !busy && (
            <p role="status" className="mt-3 px-1 text-sm text-[var(--text-1)]">
              {message}
            </p>
          )}
        </section>
      </div>
    </Screen>
  );
}
