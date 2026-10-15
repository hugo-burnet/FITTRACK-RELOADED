import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAppNavigate } from '@/app/navigation';
import { Screen } from '@/app/Screen';
import { getVolumeOverview } from '@/data/repositories/coachVolume';
import { t } from '@/i18n/fr';
import { muscleLabel } from '@/i18n/labels';
import type { MuscleGroup } from '@/data/types';
import { Card, ListRow } from '@/ui';
import { VolumeBoundsSheet } from './VolumeBoundsSheet';
import { volumeBoundsReading, volumeReading } from './volumeText';

/**
 * R6 — ce que l'historique dit du volume de chaque muscle, et les bornes que la personne pose. Cf.
 * `docs/design/specs/2026-10-04-coach-v2-design.md`, R6.
 *
 * Une ligne par région du corps, **toutes** — un muscle jamais travaillé aussi : c'est un fait observé,
 * et c'est ce que cet écran existe pour montrer. Toucher une ligne ouvre ses bornes.
 */
export function VolumeScreen() {
  const navigate = useAppNavigate();
  const rows = useLiveQuery(() => getVolumeOverview(), []);
  const [editing, setEditing] = useState<MuscleGroup>();

  return (
    <Screen title={t('muscleVolume.title')} onBack={() => void navigate(-1)}>
      <div className="space-y-6" aria-busy={rows === undefined}>
        <p className="px-1 text-sm leading-relaxed text-[var(--text-2)]">{t('muscleVolume.intro')}</p>

        {rows !== undefined && (
          <Card>
            {rows.map((row) => {
              const bounds = volumeBoundsReading(row);
              return (
                <ListRow
                  key={row.muscle}
                  title={muscleLabel(row.muscle)}
                  subtitle={volumeReading(row.overview)}
                  trailing={
                    <span className="flex flex-col items-end text-sm leading-snug">
                      <span>{bounds.floor}</span>
                      <span>{bounds.ceiling}</span>
                    </span>
                  }
                  onClick={() => setEditing(row.muscle)}
                />
              );
            })}
          </Card>
        )}
      </div>

      <VolumeBoundsSheet
        row={rows?.find((row) => row.muscle === editing)}
        onClose={() => setEditing(undefined)}
      />
    </Screen>
  );
}
