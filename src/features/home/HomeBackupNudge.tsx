import { useRef, useState } from 'react';
import { getBootStorage } from '@/app/bootEasterEgg';
import { backupAgoLabel, backupSessionsLabel } from '@/features/settings/backupText';
import { exportBackup } from '@/features/settings/exportBackup';
import { useBackupStatus } from '@/features/settings/useBackupStatus';
import { t } from '@/i18n/fr';
import { snoozeUntil } from '@/lib/backupNudge';
import { snoozeBackupNudge } from '@/stores/backupMemory';
import { Button, Card } from '@/ui';

/**
 * Le rappel de sauvegarde de l'accueil.
 *
 * La base vit dans le téléphone : la règle n° 4 la garde d'un crash, pas d'un téléphone perdu ou
 * d'une app désinstallée, et la seule parade est un fichier qui en sort. L'app ne peut pas le
 * faire seule — Android ne laisse pas une app écrire où elle veut, hors de ses propres dossiers
 * qui disparaissent avec elle — mais elle peut ne pas laisser oublier.
 *
 * **Rare, factuel, jamais une alarme.** Il n'existe que si des séances ne sont dans aucune
 * sauvegarde (`backupNudge`), il dit ce qui est en jeu avec des chiffres, et il a deux sorties :
 * sauvegarder tout de suite, ou « Plus tard » qui le fait taire une semaine. Il se place *sous* la
 * séance à lancer : la prochaine action reste en tête de l'écran, ce rappel n'est pas elle.
 *
 * Sans séance à protéger il ne rend rien du tout, pas même un cadre vide.
 */
export function HomeBackupNudge() {
  const { nudge, lastBackupAt, now } = useBackupStatus();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Un état React ne suffit pas à refuser un double appui dans la même image : le second
  // `click` voit encore l'ancien `busy`.
  const running = useRef(false);

  if (!nudge.show) return null;

  const save = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setFailed(false);
    try {
      // `cancelled` : la feuille de partage a été fermée, une décision et non un échec —
      // le rappel reste, sans reproche.
      if ((await exportBackup()) === 'failed') setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  const later = () => snoozeBackupNudge(getBootStorage(), snoozeUntil(Date.now()));

  const body =
    nudge.reason === 'never' || lastBackupAt === undefined
      ? t('home.backupNever', { count: nudge.workouts })
      : t('home.backupSince', {
          ago: backupAgoLabel(lastBackupAt, now),
          sessions: backupSessionsLabel(nudge.workouts),
        });

  return (
    <section aria-labelledby="home-backup-title">
      <Card padded>
        <div className="space-y-3">
          <h2 id="home-backup-title" className="text-lg font-semibold text-[var(--text-1)]">
            {t('home.backupTitle')}
          </h2>
          <p className="text-sm leading-relaxed text-[var(--text-2)]">{body}</p>
          {failed && (
            <p role="status" className="text-sm leading-relaxed text-[var(--danger-ink)]">
              {t('home.backupFailed')}
            </p>
          )}
          <div className="flex gap-3">
            <Button
              variant="primary"
              className="flex-1"
              disabled={busy}
              onClick={() => void save()}
            >
              {t('home.backupAction')}
            </Button>
            <Button variant="secondary" className="flex-1" disabled={busy} onClick={later}>
              {t('home.backupLater')}
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}
