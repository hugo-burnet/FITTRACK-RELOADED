import { useState } from 'react';
import { t } from '@/i18n/fr';
import { saveTextFile } from '@/platform/saveFile';
import { syncCoordinator as sync } from '@/stores/sync';
import { SyncError } from '@/lib/sync/types';
import { Button, Input, SectionTitle } from '@/ui';

export function AccountDataControls({ username, busy, run }: {
  username: string;
  busy: boolean;
  run: (action: () => Promise<void>) => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  return (
    <section className="flex flex-col gap-4">
      <SectionTitle>{t('sync.accountDataTitle')}</SectionTitle>
      <p className="text-base leading-relaxed text-[var(--text-2)]">{t('sync.serverExportHint')}</p>
      <Button variant="secondary" disabled={busy} onClick={() => void run(() => sync.exportAccount(async (text) => {
        const result = await saveTextFile({ name: 'fittrack-server-account.json', text,
          type: 'application/json;charset=utf-8', title: t('sync.exportAccount') });
        if (result === 'failed') throw new SyncError('generic');
      }))}>{t('sync.exportAccount')}</Button>
      {!deleting ? (
        <Button variant="danger" disabled={busy} onClick={() => setDeleting(true)}>{t('sync.deleteAccount')}</Button>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            try { await sync.deleteAccount(password, confirmation); }
            finally { setPassword(''); }
          });
        }}>
          <p className="text-base leading-relaxed text-[var(--text-2)]">{t('sync.deleteAccountHint')}</p>
          <Input label={t('sync.deleteConfirmation')} hint={t('sync.deleteConfirmationHint', { username })}
            value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off" spellCheck={false} disabled={busy} />
          <Input label={t('sync.currentPassword')} type="password" autoComplete="current-password"
            value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} />
          <Button variant="secondary" type="button" disabled={busy} onClick={() => {
            setDeleting(false); setPassword(''); setConfirmation('');
          }}>{t('sync.cancel')}</Button>
          <Button variant="danger" type="submit" disabled={busy || confirmation !== username || !password}>
            {t(busy ? 'sync.working' : 'sync.deleteAccountConfirm')}
          </Button>
        </form>
      )}
    </section>
  );
}
