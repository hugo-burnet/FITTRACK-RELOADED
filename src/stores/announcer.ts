import { setAudioVolume } from '@/audio/context';
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

const MODES: readonly AnnouncerMode[] = ['silence', 'sounds', 'voice'];

let current: AnnouncerMode | null = null;

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
