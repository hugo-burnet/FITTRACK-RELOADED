import { useState } from 'react';
import { setCoachVolumeBounds } from '@/data/repositories/settings';
import type { MuscleVolumeRow } from '@/data/repositories/coachVolume';
import { t } from '@/i18n/fr';
import { muscleLabel } from '@/i18n/labels';
import { VOLUME_BOUND_MAX, effectiveCeiling } from '@/lib/coach/volume';
import { Button, ChoiceChip, NumberInput, Sheet } from '@/ui';
import { formatNumber } from '@/ui/numberField';

type SaveState = 'idle' | 'saving' | 'error';

interface Props {
  /** Absente : la feuille est fermée. */
  row: MuscleVolumeRow | undefined;
  onClose: () => void;
}

/**
 * Les bornes d'un muscle : un plancher, un plafond, ou ni l'un ni l'autre.
 *
 * Rien n'est posé tant que la personne ne le pose : sans plancher, aucune alerte ; sans plafond, celui
 * que l'historique donne. « Aucun » et « automatique » sont donc des choix qu'on **touche**, pas un champ
 * qu'il faudrait vider — effacer trois caractères avec un doigt humide n'est pas un réglage.
 */
export function VolumeBoundsSheet({ row, onClose }: Props) {
  // La dernière ligne reste en place pendant que la feuille redescend.
  const [last, setLast] = useState(row);
  if (row !== undefined && row !== last) setLast(row);
  const shown = row ?? last;

  return (
    <Sheet
      open={row !== undefined}
      onClose={onClose}
      title={shown === undefined ? '' : muscleLabel(shown.muscle)}
    >
      {/* Monté avec la feuille, démonté avec elle : chaque ouverture repart des bornes enregistrées. */}
      {shown !== undefined && <BoundsForm row={shown} onClose={onClose} />}
    </Sheet>
  );
}

function BoundsForm({ row, onClose }: { row: MuscleVolumeRow; onClose: () => void }) {
  const [floor, setFloor] = useState<number | undefined>(row.bounds.floor);
  const [ceiling, setCeiling] = useState<number | undefined>(row.bounds.ceiling);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // Le plafond que l'historique donnerait si la personne n'en posait pas : c'est lui que « automatique »
  // rend, et il ne dépend pas de ce qu'elle tape ici.
  const automatic = effectiveCeiling(row.overview);
  const ordered = floor === undefined || ceiling === undefined || floor <= ceiling;

  const { overview } = row;
  const history =
    overview.weeksWorked === 0
      ? t('muscleVolume.sheetNoHistory')
      : t('muscleVolume.sheetHistory', {
          median: formatNumber(overview.median),
          max: formatNumber(overview.max),
          weeks: overview.weeksWorked,
        });

  const save = async () => {
    if (!ordered || saveState === 'saving') return;

    setSaveState('saving');
    try {
      await setCoachVolumeBounds(row.muscle, {
        ...(floor === undefined ? {} : { floor }),
        ...(ceiling === undefined ? {} : { ceiling }),
      });
      onClose();
    } catch {
      setSaveState('error');
    }
  };

  const change = (apply: () => void) => {
    apply();
    setSaveState('idle');
  };

  return (
    <div className="space-y-6 pb-2">
      <p className="text-sm leading-relaxed text-[var(--text-2)]">{history}</p>

      <div className="space-y-3">
        <p className="label-xs font-semibold text-[var(--text-2)]">{t('muscleVolume.floorLabel')}</p>
        <NumberInput
          aria-label={t('muscleVolume.floorLabel')}
          value={floor}
          onChange={(next) => change(() => setFloor(next))}
          integer
          step={1}
          min={1}
          max={VOLUME_BOUND_MAX}
        />
        <ChoiceChip
          label={t('muscleVolume.noFloor')}
          active={floor === undefined}
          quietActive
          onClick={() => change(() => setFloor(undefined))}
        />
        <p className="text-sm leading-relaxed text-[var(--text-2)]">{t('muscleVolume.floorHint')}</p>
      </div>

      <div className="space-y-3">
        <p className="label-xs font-semibold text-[var(--text-2)]">{t('muscleVolume.ceilingLabel')}</p>
        <NumberInput
          aria-label={t('muscleVolume.ceilingLabel')}
          value={ceiling}
          onChange={(next) => change(() => setCeiling(next))}
          integer
          step={1}
          min={1}
          max={VOLUME_BOUND_MAX}
        />
        <ChoiceChip
          label={
            automatic === undefined
              ? t('muscleVolume.autoCeilingNone')
              : t('muscleVolume.autoCeilingValue', { sets: automatic })
          }
          active={ceiling === undefined}
          quietActive
          onClick={() => change(() => setCeiling(undefined))}
        />
        <p className="text-sm leading-relaxed text-[var(--text-2)]">{t('muscleVolume.ceilingHint')}</p>
      </div>

      {!ordered && (
        <p role="status" className="text-sm leading-relaxed text-[var(--danger-ink)]">
          {t('muscleVolume.orderError')}
        </p>
      )}
      {saveState === 'error' && (
        <p role="alert" className="text-sm leading-relaxed text-[var(--danger-ink)]">
          {t('muscleVolume.saveError')}
        </p>
      )}

      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={!ordered || saveState === 'saving'}
        onClick={() => void save()}
      >
        {saveState === 'saving' ? t('muscleVolume.saving') : t('muscleVolume.save')}
      </Button>
    </div>
  );
}
