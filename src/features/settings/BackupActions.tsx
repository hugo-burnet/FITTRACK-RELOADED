import { useRef, useState } from 'react';
import { buildBackup, restoreBackup } from '@/data/repositories/backup';
import { useTutorialControls } from '@/features/tutorial/tutorialContext';
import { t, type TranslationKey } from '@/i18n/fr';
import {
  backupFileName,
  parseBackup,
  serializeBackup,
  type BackupCounts,
  type BackupFile,
  type BackupProblem,
} from '@/lib/backup';
import { saveTextFile } from '@/platform/saveFile';
import { ConfirmSheet, ListRow, SectionTitle } from '@/ui';
import { backupOrphanMessage, backupStructureMessage } from './backupMessages';

/**
 * Les refus qui tiennent en une phrase fixe. `invalid-structure` n'y est pas :
 * son message nomme la table et la ligne, et se compose dans `backupMessages`.
 */
const PROBLEM_MESSAGE = {
  'not-json': 'settings.restoreErrorNotJson',
  'not-a-backup': 'settings.restoreErrorNotBackup',
  'unsupported-version': 'settings.restoreErrorVersion',
  'unsupported-schema': 'settings.restoreErrorSchema',
  empty: 'settings.restoreErrorEmpty',
} as const satisfies Record<Exclude<BackupProblem, 'invalid-structure'>, TranslationKey>;

type Notice = { text: string; failed: boolean };

/**
 * The backup that comes back — the whole account out to one file, and that file
 * back into the app.
 *
 * **Its own section, next to the CSV and not instead of it.** The CSV is the
 * history in a format other tools read; this is everything else too (routines
 * never performed, programmes, records, the coach's journal, the plate rack,
 * the theme) in a format only FitTrack reads. Both stay, because they answer
 * two different questions — "montre ça à quelqu'un d'autre" and "remets ça sur
 * mon nouveau téléphone".
 *
 * **The restore asks, with numbers.** It replaces everything the app holds, so
 * the file is read and counted *before* the question is put, and the question
 * says what the file contains rather than "es-tu sûr ?". A file that is not a
 * backup is refused at that point, with nothing written.
 */
export function BackupActions({
  // Injected so a test can watch the reload rather than perform it: jsdom has
  // no navigation, and a restored preference read once into module memory
  // (the announcer, the theme) only takes effect on the next launch.
  reload = () => window.location.reload(),
}: {
  reload?: () => void;
} = {}) {
  const tutorial = useTutorialControls();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [pending, setPending] = useState<{
    backup: BackupFile;
    counts: BackupCounts;
    total: number;
    /** Déjà rédigé, ou `null` quand le fichier se tient. */
    orphans: string | null;
  } | null>(null);

  const fail = (key: TranslationKey) => setNotice({ text: t(key), failed: true });

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const backup = await buildBackup();
      const outcome = await saveTextFile({
        name: backupFileName(backup.exportedAt),
        text: serializeBackup(backup),
        type: 'application/json;charset=utf-8',
        title: t('settings.backupExportTitle'),
      });
      if (outcome === 'failed') fail('settings.backupExportFailed');
      else if (outcome === 'shared' || outcome === 'downloaded') {
        tutorial?.report({ type: 'backup-exported', outcome });
        if (outcome === 'downloaded') {
          setNotice({ text: t('settings.backupExportDownloaded'), failed: false });
        }
      }
    } catch {
      fail('settings.backupExportFailed');
    } finally {
      setBusy(false);
    }
  };

  const read = async (file: File) => {
    setNotice(null);
    let text: string;
    try {
      text = await file.text();
    } catch {
      fail('settings.restoreErrorUnreadable');
      return;
    }
    const parsed = parseBackup(text);
    if (!parsed.ok) {
      if (parsed.problem === 'invalid-structure') {
        setNotice({
          text: backupStructureMessage(parsed.flaws ?? [], parsed.flawCount ?? 0),
          failed: true,
        });
      } else {
        fail(PROBLEM_MESSAGE[parsed.problem]);
      }
      return;
    }
    setPending({
      backup: parsed.backup,
      counts: parsed.counts,
      total: parsed.total,
      orphans: backupOrphanMessage(parsed.orphans),
    });
    tutorial?.report({ type: 'restore-confirmation-opened' });
  };

  const confirm = () => {
    if (pending === null) return;
    const backup = pending.backup;
    setPending(null);
    setBusy(true);
    void restoreBackup(backup)
      .then(() => {
        setNotice({ text: t('settings.restoreDone'), failed: false });
        // A beat, so the sentence is read before the screen goes.
        setTimeout(reload, 600);
      })
      .catch(() => {
        setBusy(false);
        fail('settings.restoreFailed');
      });
  };

  return (
    <section>
      <SectionTitle>{t('settings.backupSection')}</SectionTitle>
      <div className="overflow-hidden rounded-2xl bg-[var(--surface-1)]">
        <ListRow
          tutorialId="backup-export"
          title={t('settings.backupExportLink')}
          subtitle={t('settings.backupExportHint')}
          disabled={busy}
          onClick={() => void save()}
        />
        <ListRow
          tutorialId="backup-restore"
          title={t('settings.backupImportLink')}
          subtitle={t('settings.backupImportHint')}
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        />
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) void read(file);
          // Cleared so choosing the same file twice fires again.
          event.target.value = '';
        }}
      />

      {notice !== null && (
        <p
          role="status"
          className={`mt-3 px-1 text-sm leading-relaxed ${
            notice.failed ? 'text-[var(--danger-ink)]' : 'text-[var(--text-2)]'
          }`}
        >
          {notice.text}
        </p>
      )}

      <ConfirmSheet
        open={pending !== null}
        onClose={() => setPending(null)}
        title={t('settings.restoreConfirmTitle')}
        // Numbers, not a generic warning: "tu vas perdre des données" is
        // something you learn to tap through. La date du fichier vient en
        // premier — c'est le repère qui départage deux sauvegardes — et ce que
        // le fichier a de bancal se dit avant la question, pas après.
        body={[
          // Un fichier sans date ne s'invente pas un 1er janvier 1970.
          pending === null || pending.backup.exportedAt <= 0
            ? ''
            : t('settings.restoreConfirmFile', {
                date: new Date(pending.backup.exportedAt).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }),
                rows: pending.total,
              }),
          t('settings.restoreConfirmBody', {
            workouts: pending?.counts.workouts ?? 0,
            routines: pending?.counts.routines ?? 0,
            exercises: pending?.counts.exercises ?? 0,
            records: pending?.counts.personalRecords ?? 0,
          }),
          pending?.orphans ?? '',
        ]
          .filter((line) => line !== '')
          .join('\n')}
        confirmLabel={t('settings.restoreConfirmAction')}
        danger
        onConfirm={confirm}
      />
    </section>
  );
}
