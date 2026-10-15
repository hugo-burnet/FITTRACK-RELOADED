import { useLiveQuery } from 'dexie-react-hooks';
import { useAppNavigate } from '@/app/navigation';
import { listVolumeLow } from '@/data/repositories/coachVolume';
import { volumeLowLine } from '@/features/settings/volumeText';
import { t } from '@/i18n/fr';
import { Button, Card } from '@/ui';

/** Au-delà, la carte devient une liste de courses : les autres se lisent sur l'écran des bornes. */
const MAX_LINES = 4;

/**
 * Un muscle sous le plancher que la personne a posé, deux semaines complètes de suite.
 *
 * **Elle ne dit que ce que la personne a demandé à entendre.** Sans plancher posé, aucune carte — l'app ne
 * décide pas que 3,8 séries d'ischios, c'est trop peu —, et sans séance dans chacune des deux semaines non
 * plus : des vacances ne sont pas un volume bas. Elle ne se ferme pas à la main : elle part quand le
 * volume remonte, ou quand le plancher est abaissé ou retiré — c'est ce que « Régler » ouvre.
 *
 * Sous la séance à lancer, comme le rappel de sauvegarde : la prochaine action reste en tête de l'écran.
 */
export function HomeVolumeCard() {
  const navigate = useAppNavigate();
  const lows = useLiveQuery(() => listVolumeLow(), []);

  if (lows === undefined || lows.length === 0) return null;

  const shown = lows.slice(0, MAX_LINES);
  const hidden = lows.length - shown.length;

  return (
    <section aria-labelledby="home-volume-title">
      <Card padded>
        <div className="space-y-3">
          <h2 id="home-volume-title" className="text-lg font-semibold text-[var(--text-1)]">
            {t('muscleVolume.lowTitle')}
          </h2>
          <ul className="space-y-1 text-sm leading-relaxed text-[var(--text-2)]">
            {shown.map((low) => (
              <li key={low.muscle}>{volumeLowLine(low)}</li>
            ))}
            {hidden > 0 && <li>{t('muscleVolume.lowMore', { count: hidden })}</li>}
          </ul>
          <Button variant="secondary" onClick={() => void navigate('/settings/volume')}>
            {t('muscleVolume.lowAdjust')}
          </Button>
        </div>
      </Card>
    </section>
  );
}
