import type { SetType } from '@/data/types';
import { t } from '@/i18n/fr';
import type { ResolvedValues } from '@/lib/measurement';
import { setVolume } from '@/lib/records';
import { formatNumber } from '@/ui/numberField';

/**
 * L'étiquette qui monte d'une coche validée, dans le thème Cyber : ce que la série vient d'ajouter.
 *
 * Le tonnage quand il existe (charge × répétitions, la règle de `setVolume`), sinon la série
 * elle-même. Un échauffement ne compte dans aucun volume : il n'en revendique pas.
 */
export function setImpactTag(values: ResolvedValues, setType: SetType): string {
  const tonnage =
    setType === 'warmup' ? 0 : setVolume({ weight: values.weight, reps: values.reps });
  if (tonnage <= 0) return t('workout.setPlusOne');
  return t('workout.setTonnage', { value: formatNumber(Math.round(tonnage * 10) / 10) });
}
