import { Capacitor, registerPlugin } from '@capacitor/core';

interface AudioFocusResult {
  granted: boolean;
}

interface FitTrackAudioFocusPlugin {
  requestDucking: () => Promise<AudioFocusResult>;
  abandon: () => Promise<void>;
}

const AudioFocus = registerPlugin<FitTrackAudioFocusPlugin>('FitTrackAudioFocus');
let releaseTimer: number | undefined;

/** Ask Android to lower other media temporarily. Web playback remains untouched. */
export async function requestMusicDucking(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    return (await AudioFocus.requestDucking()).granted;
  } catch {
    return false;
  }
}

/** Restore the previous media owner after the complete spoken queue has ended. */
export function releaseMusicDuckingAfter(delayMs: number): void {
  if (!Capacitor.isNativePlatform()) return;
  if (releaseTimer !== undefined) window.clearTimeout(releaseTimer);
  releaseTimer = window.setTimeout(() => {
    releaseTimer = undefined;
    void AudioFocus.abandon().catch(() => undefined);
  }, Math.max(0, delayMs));
}
