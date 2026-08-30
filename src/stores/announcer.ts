import { setAudioEcho, setAudioVolume } from '@/audio/context';
import type { AnnouncerMode } from '@/audio/announcer';

/**
 * How loud the app is allowed to be, remembered between sessions.
 *
 * In `localStorage` and not in Dexie on purpose: the setting is read on the
 * very first tick of a rest, from a synchronous path, and an `await` there
 * would mean the first countdown of the session goes by silently while the
 * database answers. Same reasoning as the theme.
 *
 * **`voice` is the default**, and it is not a bet on the recordings being
 * there: a missing clip is silence, so an app shipped without a voice pack
 * behaves exactly like `sounds`. The day the clips land in `public/voice`, the
 * app starts talking without anyone having to find a setting.
 */
export const ANNOUNCER_STORAGE_KEY = 'fittrack:announcer';

/**
 * The loudspeaker colouring — the hall the announcements echo in.
 *
 * On by default, because it *is* the character: a dry take of "Repos terminé"
 * is a voice memo, the same take through a PA is an announcement. Left
 * switchable all the same — headphones at 6 a.m. are not a gym at 7 p.m., and
 * a reverb tail under a podcast is a reverb tail too many.
 */
const ANNOUNCER_ECHO_STORAGE_KEY = 'fittrack:announcerEcho';

const MODES: readonly AnnouncerMode[] = ['silence', 'sounds', 'voice', 'voice-only'];

let current: AnnouncerMode | null = null;
let echo: boolean | null = null;

export function loadAnnouncerMode(): AnnouncerMode {
  if (current !== null) return current;
  const stored = localStorage.getItem(ANNOUNCER_STORAGE_KEY);
  current = MODES.find((mode) => mode === stored) ?? 'voice';
  return current;
}

export function applyAnnouncerMode(mode: AnnouncerMode): void {
  current = mode;
  localStorage.setItem(ANNOUNCER_STORAGE_KEY, mode);
  // Silence cuts the bus too: a tone already scheduled on the audio clock is
  // out of reach of any later `if`, and turning the announcer off mid-rest has
  // to be immediate to be believed.
  setAudioVolume(mode === 'silence' ? 0 : 1);
}

export function loadAnnouncerEcho(): boolean {
  if (echo !== null) return echo;
  echo = localStorage.getItem(ANNOUNCER_ECHO_STORAGE_KEY) !== 'off';
  return echo;
}

export function applyAnnouncerEcho(enabled: boolean): void {
  echo = enabled;
  localStorage.setItem(ANNOUNCER_ECHO_STORAGE_KEY, enabled ? 'on' : 'off');
  setAudioEcho(enabled);
}
