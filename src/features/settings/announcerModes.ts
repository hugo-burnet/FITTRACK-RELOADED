import type { AnnouncerMode } from '@/audio/announcer';
import type { TranslationKey } from '@/i18n/fr';

/**
 * Les modes d'annonce et leur libellé. À part du composant : le sommaire des Réglages n'a besoin que
 * du nom du mode courant, pas des clips ni du sondage de la voix qu'`AnnouncerSettings` embarque.
 */
export const ANNOUNCER_MODES: { value: AnnouncerMode; labelKey: TranslationKey }[] = [
  { value: 'silence', labelKey: 'settings.announcerSilence' },
  { value: 'sounds', labelKey: 'settings.announcerSounds' },
  { value: 'voice', labelKey: 'settings.announcerVoice' },
  { value: 'voice-only', labelKey: 'settings.announcerVoiceOnly' },
];
