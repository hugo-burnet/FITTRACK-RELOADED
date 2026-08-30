import { t, type TranslationKey } from '@/i18n/fr';
import type { MilestoneArtKey } from '@/lib/milestones/art';

/**
 * La ligne sous le mème en grand : ce que le jeton *est*, pas le palier
 * (le titre de la feuille s'en charge). Une clé i18n par illustration,
 * parce que gigachad et rare Pepe se partagent plusieurs paliers.
 */
export function captionForArt(key: MilestoneArtKey): string {
  return t(`milestone.art.${key}` as TranslationKey);
}
