import { useEffect, useState } from 'react';
import { previewAnnouncer } from '@/audio/announce';
import type { AnnouncerMode } from '@/audio/announcer';
import { allClips } from '@/audio/cues';
import { probeVoicePack } from '@/audio/voicePack';
import { useTutorialControls } from '@/features/tutorial/tutorialContext';
import { t, type TranslationKey } from '@/i18n/fr';
import {
  applyAnnouncerEcho,
  applyAnnouncerMode,
  loadAnnouncerEcho,
  loadAnnouncerMode,
} from '@/stores/announcer';
import { ListRow, SectionTitle, Toggle } from '@/ui';

/** One clip answers for the folder — the pack is written in one run. */
const [PROBE_CLIP] = allClips();

const MODES: { value: AnnouncerMode; labelKey: TranslationKey }[] = [
  { value: 'silence', labelKey: 'settings.announcerSilence' },
  { value: 'sounds', labelKey: 'settings.announcerSounds' },
  { value: 'voice', labelKey: 'settings.announcerVoice' },
  { value: 'voice-only', labelKey: 'settings.announcerVoiceOnly' },
];

/**
 * How loud the app is, and the one place where you can hear the answer.
 *
 * **Choosing plays.** A sound setting judged from a label is a setting nobody
 * trusts: the tap that picks a mode is also a user gesture, which is precisely
 * what the browser demands before any audio at all — so the demonstration is
 * free, and it doubles as proof that the phone is not on silent.
 *
 * **The missing-pack line is not an error.** The repository ships the script of
 * the voice, not necessarily its recordings, and an app with no clips simply
 * beeps. Saying so beats leaving someone to wonder why "Sons + voix" sounds
 * exactly like "Sons".
 */
export function AnnouncerSettings() {
  const tutorial = useTutorialControls();
  const [mode, setMode] = useState<AnnouncerMode>(loadAnnouncerMode);
  /** `undefined` while the answer is unknown — never rendered as "missing". */
  const [installed, setInstalled] = useState<boolean | undefined>(
    PROBE_CLIP === undefined ? false : undefined,
  );

  useEffect(() => {
    if (PROBE_CLIP === undefined) return;
    let cancelled = false;
    void probeVoicePack(PROBE_CLIP).then((found) => {
      if (!cancelled) setInstalled(found);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const [echo, setEcho] = useState(loadAnnouncerEcho);

  const choose = (next: AnnouncerMode) => {
    setMode(next);
    applyAnnouncerMode(next);
    tutorial?.report({ type: 'announcer-mode-changed', mode: next });
    if (next !== 'silence') void previewAnnouncer('rest-over');
  };

  const toggleEcho = () => {
    const next = !echo;
    setEcho(next);
    applyAnnouncerEcho(next);
    tutorial?.report({ type: 'announcer-echo-changed', enabled: next });
    // Heard immediately, and on the phrase the switch is about: the difference
    // between a voice memo and an announcement is not describable in a label.
    if (mode !== 'silence') void previewAnnouncer('rest-over');
  };

  const voiceNote =
    installed === undefined
      ? 'settings.announcerVoiceChecking'
      : installed
        ? 'settings.announcerVoiceReady'
        : 'settings.announcerVoiceMissing';

  return (
    <section>
      <SectionTitle>{t('settings.announcerSection')}</SectionTitle>
      <div className="rounded-2xl bg-[var(--surface-1)] p-4">
        <div
          role="radiogroup"
          aria-label={t('settings.announcer')}
          data-tutorial-id="announcer-modes"
          /* Deux colonnes depuis qu'il y a quatre modes : « Voix uniquement »
             ne tient pas sur un quart de 375 px, et une rangée qui tronque ses
             propres libellés ne se choisit pas. */
          className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--surface-2)] p-1"
        >
          {MODES.map(({ value, labelKey }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              onClick={() => choose(value)}
              className={`min-h-12 rounded-lg px-2 text-base font-semibold
                transition-colors duration-[var(--dur-1)] ease-[var(--ease-mech)]
                ${
                  mode === value
                    ? 'bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                    : 'text-[var(--text-2)]'
                }`}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[var(--text-2)]">
          {t('settings.announcerHint')}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">
          {t('settings.announcerMusicHint')}
        </p>
        {mode === 'voice-only' && (
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">
            {t('settings.announcerVoiceOnlyHint')}
          </p>
        )}
        {/* Le pack manquant concerne les deux modes qui parlent. */}
        {(mode === 'voice' || mode === 'voice-only') && (
          <p className="mt-2 text-sm leading-relaxed text-[var(--text-2)]">{t(voiceNote)}</p>
        )}
      </div>

      {mode !== 'silence' && (
        <div className="mt-3 overflow-hidden rounded-2xl bg-[var(--surface-1)]">
          <ListRow
            title={t('settings.announcerEcho')}
            subtitle={t('settings.announcerEchoHint')}
            tutorialId="announcer-echo"
            trailing={
              <Toggle
                label={t('settings.announcerEcho')}
                mark={t(echo ? 'settings.effortPromptOn' : 'settings.effortPromptOff')}
                checked={echo}
                onChange={toggleEcho}
              />
            }
          />
        </div>
      )}
    </section>
  );
}
