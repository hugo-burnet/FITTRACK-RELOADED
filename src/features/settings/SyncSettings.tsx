import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { deleteSyncRecovery, getSyncRecovery, listSyncRecoveries } from '@/data/repositories/sync';
import { t, type TranslationKey } from '@/i18n/fr';
import { backupFileName, serializeBackup } from '@/lib/backup';
import { SyncError, type SyncRecoveryInfo, type SyncReview } from '@/lib/sync/types';
import { saveTextFile } from '@/platform/saveFile';
import { syncCoordinator as sync } from '@/stores/sync';
import { Button, ConfirmSheet, Input, SectionTitle, Toggle } from '@/ui';

const ERRORS: Record<string, TranslationKey> = Object.fromEntries(
  [
    'unavailable',
    'network',
    'invalid_credentials',
    'password_invalid',
    'registration_refused',
    'too_many_attempts',
    'logout_required',
    'authentication_required',
    'account_mismatch',
    'stale_review',
    'active_workout',
    'active_remote',
    'photos_unsupported',
    'request_too_large',
    'invalid_response',
    'invalid_snapshot',
    'logout_incomplete',
    'device_restored',
    'consent_not_saved',
  ].map((code) => [code, `sync.errors.${code}`]),
) as Record<string, TranslationKey>;

export function SyncSettings() {
  const navigate = useAppNavigate();
  const view = useSyncExternalStore(sync.subscribe, sync.getSnapshot);
  const [mode, setMode] = useState<'login' | 'register' | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [invitation, setInvitation] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    choice: 'enable' | 'push' | 'pull';
    review: SyncReview | null;
  } | null>(null);
  const [recoveries, setRecoveries] = useState<SyncRecoveryInfo[]>([]);
  const [deleting, setDeleting] = useState<SyncRecoveryInfo | null>(null);
  useEffect(() => {
    let alive = true;
    // open() stays offline unless this device already used an account or enabled sync.
    void sync
      .open()
      .catch(() => {})
      .finally(() => {
        void listSyncRecoveries()
          .then((copies) => {
            if (alive) setRecoveries(copies);
          })
          .catch(() => {});
      });
    return () => {
      alive = false;
    };
  }, []);
  async function run(action: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
      setRecoveries(await listSyncRecoveries());
    } catch (failure) {
      setError(failure instanceof SyncError ? failure.code : 'generic');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  const authenticate = () =>
    run(async () => {
      if (!mode) return;
      try {
        await sync.authenticate(mode, {
          username,
          password,
          ...(mode === 'register' ? { invitation } : {}),
        });
        setMode(null);
      } finally {
        setPassword('');
        setInvitation('');
      }
    });
  const confirm = () => {
    const choice = confirmation;
    setConfirmation(null);
    void run(async () => {
      if (choice?.choice === 'enable') await sync.activate();
      else if (choice && (await sync.resolve(choice.choice, choice.review)) === 'applied')
        window.location.reload();
    });
  };
  const exportRecovery = (id: string) =>
    run(async () => {
      const backup = await getSyncRecovery(id);
      if (!backup) throw new SyncError('stale_review');
      const outcome = await saveTextFile({
        name: backupFileName(backup.exportedAt),
        text: serializeBackup(backup),
        type: 'application/json;charset=utf-8',
        title: t('sync.recoveryTitle'),
      });
      if (outcome === 'failed') throw new SyncError('generic');
      if (outcome === 'shared' || outcome === 'downloaded') setNotice(t('sync.recoverySaved'));
    });
  const removeRecovery = () => {
    const copy = deleting;
    setDeleting(null);
    if (copy) void run(() => deleteSyncRecovery(copy.id));
  };
  const shownError = error ?? view.error;
  const remote = view.review?.remote.snapshot;
  return (
    <Screen title={t('sync.title')} onBack={() => void navigate('/settings')}>
      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-[var(--text-1)]">{t('sync.localTitle')}</h2>
          <p className="text-sm leading-relaxed text-[var(--text-2)]">{t('sync.localHint')}</p>
        </section>
        {view.user === null ? (
          <section className="flex flex-col gap-4">
            {mode === null ? (
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                >
                  {t('sync.login')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                >
                  {t('sync.register')}
                </Button>
              </div>
            ) : (
              <form
                className="flex flex-col gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void authenticate();
                }}
              >
                <SectionTitle>
                  {t(mode === 'register' ? 'sync.register' : 'sync.login')}
                </SectionTitle>
                <Input
                  label={t('sync.username')}
                  hint={t('sync.usernameHint')}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                  minLength={3}
                  maxLength={32}
                  disabled={busy}
                />
                <Input
                  label={t('sync.password')}
                  hint={mode === 'register' ? t('sync.passwordHint') : undefined}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  minLength={mode === 'register' ? 12 : 1}
                  maxLength={1024}
                  required
                  disabled={busy}
                />
                {mode === 'register' && (
                  <Input
                    label={t('sync.invitation')}
                    hint={t('sync.invitationHint')}
                    value={invitation}
                    onChange={(event) => setInvitation(event.target.value)}
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={128}
                    required
                    disabled={busy}
                  />
                )}
                <p className="text-sm leading-relaxed text-[var(--text-2)]">
                  {t('sync.accountOnly')}
                </p>
                <Button variant="primary" type="submit" disabled={busy}>
                  {t(busy ? 'sync.working' : mode === 'register' ? 'sync.create' : 'sync.login')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setMode(null);
                    setPassword('');
                    setInvitation('');
                  }}
                >
                  {t('sync.cancel')}
                </Button>
              </form>
            )}
          </section>
        ) : (
          <section className="flex flex-col gap-4">
            <h2 className="break-words text-lg font-semibold">
              {t('sync.connected', { username: view.user.username })}
            </h2>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--surface-1)] p-4">
              <span className="text-base font-medium">{t('sync.switch')}</span>
              <Toggle
                label={t('sync.switch')}
                mark={t(view.enabled ? 'sync.on' : 'sync.off')}
                checked={view.enabled}
                disabled={!view.enabled && busy}
                onChange={() => {
                  if (view.enabled) void sync.deactivate().catch(() => setError('generic'));
                  else setConfirmation({ choice: 'enable', review: null });
                }}
              />
            </div>
            <p className="text-sm leading-relaxed text-[var(--text-2)]">
              {t(view.enabled ? 'sync.onHint' : 'sync.offHint')}
            </p>
            {view.enabled && (
              <>
                <p className="text-sm leading-relaxed text-[var(--text-2)]">
                  {t('sync.turnOffHint')}
                </p>
                <Button disabled={busy} onClick={() => void run(() => sync.cycle())}>
                  {t(busy ? 'sync.working' : 'sync.now')}
                </Button>
              </>
            )}
            <Button variant="ghost" disabled={busy} onClick={() => void run(() => sync.signOut())}>
              {t('sync.logout')}
            </Button>
          </section>
        )}
        <p role="status" className="text-sm leading-relaxed text-[var(--text-2)]">
          {t(`sync.phases.${view.phase}`)}
        </p>
        {view.review && view.enabled && (
          <section className="flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-[var(--text-2)]">{t('sync.conflictHint')}</p>
            <table className="w-full table-fixed text-left text-sm">
              <thead>
                <tr>
                  <th className="py-2 font-medium" scope="col">
                    {t('sync.workouts')}
                  </th>
                  <th className="py-2 font-medium" scope="col">
                    {t('sync.device')}
                  </th>
                  <th className="py-2 font-medium" scope="col">
                    {t('sync.server')}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th className="py-2 font-normal" scope="row">
                    {t('sync.workouts')}
                  </th>
                  <td>{view.review.localCounts.workouts}</td>
                  <td>
                    {remote?.tables.workouts.filter((row) => row.deletedAt === 0).length ?? 0}
                  </td>
                </tr>
                <tr>
                  <th className="py-2 font-normal" scope="row">
                    {t('sync.routines')}
                  </th>
                  <td>{view.review.localCounts.routines}</td>
                  <td>
                    {remote?.tables.routines.filter((row) => row.deletedAt === 0).length ?? 0}
                  </td>
                </tr>
              </tbody>
            </table>
            <Button
              disabled={busy}
              onClick={() => setConfirmation({ choice: 'push', review: view.review })}
            >
              {t('sync.useLocal')}
            </Button>
            {remote && (
              <Button
                disabled={busy}
                onClick={() => setConfirmation({ choice: 'pull', review: view.review })}
              >
                {t('sync.useRemote')}
              </Button>
            )}
          </section>
        )}
        {recoveries.length > 0 && (
          <section className="flex flex-col gap-3">
            <SectionTitle>{t('sync.recoveriesTitle')}</SectionTitle>
            <p className="text-sm leading-relaxed text-[var(--text-2)]">
              {t('sync.recoveriesHint')}
            </p>
            {recoveries.map((copy) => (
              <div
                key={copy.id}
                className="flex flex-col gap-2 rounded-2xl bg-[var(--surface-1)] p-4"
              >
                <p className="text-sm leading-relaxed">
                  {t(
                    copy.source === 'server'
                      ? 'sync.recoveryServer'
                      : copy.source === 'device'
                        ? 'sync.recoveryDevice'
                        : 'sync.recoveryLegacy',
                    {
                      date: new Date(copy.createdAt).toLocaleString('fr-FR', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }),
                    },
                  )}
                </p>
                <Button disabled={busy} onClick={() => void exportRecovery(copy.id)}>
                  {t('sync.recovery')}
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => setDeleting(copy)}>
                  {t('sync.recoveryDelete')}
                </Button>
              </div>
            ))}
          </section>
        )}
        {notice && (
          <p role="status" className="text-sm text-[var(--text-2)]">
            {notice}
          </p>
        )}
        {shownError === 'consent_not_saved' && (
          <Button disabled={busy} onClick={() => void run(() => sync.deactivate())}>
            {t('sync.retryOff')}
          </Button>
        )}
        {shownError && (
          <p role="alert" className="text-sm leading-relaxed text-[var(--danger-ink)]">
            {t(Object.hasOwn(ERRORS, shownError) ? ERRORS[shownError]! : 'sync.errors.generic')}
          </p>
        )}
      </div>
      <ConfirmSheet
        open={confirmation !== null}
        onClose={() => setConfirmation(null)}
        title={t(
          confirmation?.choice === 'enable'
            ? 'sync.enableTitle'
            : confirmation?.choice === 'push'
              ? 'sync.pushTitle'
              : 'sync.pullTitle',
          { username: view.user?.username ?? '' },
        )}
        body={t(
          confirmation?.choice === 'enable'
            ? 'sync.enableBody'
            : confirmation?.choice === 'push'
              ? 'sync.pushBody'
              : 'sync.pullBody',
          { username: view.user?.username ?? '' },
        )}
        confirmLabel={t(
          confirmation?.choice === 'enable'
            ? 'sync.enableConfirm'
            : confirmation?.choice === 'push'
              ? 'sync.pushConfirm'
              : 'sync.pullConfirm',
        )}
        danger={confirmation?.choice !== 'enable'}
        onConfirm={confirm}
      />
      <ConfirmSheet
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t('sync.recoveryDeleteTitle')}
        body={t('sync.recoveryDeleteBody')}
        confirmLabel={t('sync.recoveryDeleteConfirm')}
        danger
        onConfirm={removeRecovery}
      />
    </Screen>
  );
}
