import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { countCompletedWorkouts } from '@/data/repositories/history';
import { listHistoricalWorkouts } from '@/data/repositories/historicalWorkouts';
import { buildCsvExport, csvExportFileName } from '@/data/repositories/csvExport';
import { t } from '@/i18n/fr';
import { projectCoachExport } from '@/lib/export/projectCoachExport';
import { serializeMarkdown } from '@/lib/export/serializeMarkdown';
import { DEFAULT_EXPORT_OPTIONS } from '@/lib/export/types';
import { saveTextFile } from '@/platform/saveFile';
import { shareText, type ShareOutcome } from '@/platform/share';
import { Card, LearnMore, ListRow, SectionTitle } from '@/ui';

/**
 * Les deux exports que d'autres outils lisent : l'historique en texte, le CSV.
 *
 * À part de la sauvegarde complète : celle-ci sait tout remettre dans l'app, ceux-là montrent les
 * séances à quelqu'un d'autre ou à un tableur.
 */
export function ReadableExports() {
  const [historyShareOutcome, setHistoryShareOutcome] = useState<ShareOutcome | null>(null);
  /** Ce que la sauvegarde CSV a donné, dit une fois sous la liste. */
  const [csvMessage, setCsvMessage] = useState<string>();
  const [csvFailed, setCsvFailed] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  const historyMarkdown = useLiveQuery(async () => {
    const scope = { kind: 'all-history' } as const;
    const sources = await listHistoricalWorkouts(scope);
    if (sources.length === 0) return '';

    return serializeMarkdown(
      projectCoachExport(scope, sources, DEFAULT_EXPORT_OPTIONS, Date.now()),
    );
  }, []);

  /** Le compte des séances terminées : rien à sauvegarder, rien à cliquer. */
  const workoutCount = useLiveQuery(countCompletedWorkouts, [], 0);

  /**
   * La sauvegarde réimportable. Le fichier est fabriqué au clic et pas tenu à
   * jour en permanence : un `useLiveQuery` sur tout l'historique reconstruirait
   * le CSV entier à chaque série validée, pour un bouton qu'on touche deux fois
   * par mois.
   */
  const saveCsv = async () => {
    if (csvBusy) return;
    setCsvBusy(true);
    setCsvMessage(undefined);
    setCsvFailed(false);
    try {
      const csv = await buildCsvExport();
      const outcome = await saveTextFile({
        name: csvExportFileName(Date.now()),
        text: csv,
        type: 'text/csv;charset=utf-8',
        title: t('settings.exportCsvTitle'),
        // Le seul fichier de l'app qui part avec un BOM, et la seule raison
        // valable d'en mettre un : sans lui, Excel lit « Développé couché » en
        // mojibake. Le JSON de sauvegarde n'en veut surtout pas (cf. saveFile).
        bom: true,
      });
      if (outcome === 'failed') {
        setCsvFailed(true);
        setCsvMessage(t('settings.exportCsvFailed'));
      } else if (outcome === 'downloaded') {
        setCsvMessage(t('settings.exportCsvDownloaded'));
      }
    } catch {
      setCsvFailed(true);
      setCsvMessage(t('settings.exportCsvFailed'));
    } finally {
      setCsvBusy(false);
    }
  };

  const shareHistory = () => {
    setHistoryShareOutcome(null);
    void shareText({
      title: t('settings.exportHistoryTitle'),
      text: historyMarkdown ?? '',
    }).then((outcome) => {
      setHistoryShareOutcome(outcome === 'copied' || outcome === 'failed' ? outcome : null);
    });
  };

  return (
    <section>
      <SectionTitle>{t('settings.exportSection')}</SectionTitle>
      <Card>
        <ListRow
          title={t('settings.exportHistoryLink')}
          subtitle={t('settings.exportHistoryHint')}
          disabled={historyMarkdown === undefined || historyMarkdown === ''}
          onClick={shareHistory}
        />
        <ListRow
          title={t('settings.exportCsvLink')}
          subtitle={t('settings.exportCsvShort')}
          disabled={csvBusy || workoutCount === 0}
          onClick={() => void saveCsv()}
        />
      </Card>
      <LearnMore>
        <p className="text-sm leading-relaxed text-[var(--text-2)]">
          {t('settings.exportCsvHint')}
        </p>
      </LearnMore>
      {csvMessage !== undefined && (
        <p
          role="status"
          className={`mt-3 px-1 text-sm leading-relaxed ${
            csvFailed ? 'text-[var(--danger-ink)]' : 'text-[var(--text-2)]'
          }`}
        >
          {csvMessage}
        </p>
      )}
      {historyShareOutcome !== null && (
        <p
          role="status"
          className={`mt-3 px-1 text-sm leading-relaxed ${
            historyShareOutcome === 'failed' ? 'text-[var(--danger-ink)]' : 'text-[var(--text-2)]'
          }`}
        >
          {t(
            historyShareOutcome === 'failed'
              ? 'settings.exportHistoryFailed'
              : 'settings.exportHistoryCopied',
          )}
        </p>
      )}
    </section>
  );
}
