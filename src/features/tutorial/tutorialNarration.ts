import { primeAnnouncer } from '@/audio/announce';
import { audioBus } from '@/audio/context';
import { clipUrl, VOICE_GAIN } from '@/audio/voicePack';
import { requestMusicDucking, releaseMusicDuckingAfter } from '@/platform/audioFocus';
import { loadAnnouncerMode } from '@/stores/announcer';

let request = 0;
let activeSource: AudioBufferSourceNode | null = null;

export function stopTutorialNarration(): void {
  request += 1;
  const source = activeSource;
  activeSource = null;
  try {
    source?.stop();
  } catch {
    // A source that ended between the read and stop is already silent.
  }
  releaseMusicDuckingAfter(0);
}

/**
 * Tutorial speech is controlled playback, separate from event announcements.
 * A chapter can be skipped immediately; no queued sentence survives into the
 * next page and the external music remains ducked for exactly the active clip.
 */
export async function playTutorialNarration(clip: string, onEnded: () => void): Promise<boolean> {
  stopTutorialNarration();
  // `Silence` means the app makes no sound, and this clip is a sound: the
  // overlay then falls back to its reading time, with the transcript carrying
  // the chapter. Announcements are filtered in `planCue`; this path is not.
  if (loadAnnouncerMode() === 'silence') return false;
  const ownRequest = request;
  primeAnnouncer();
  const bus = audioBus();
  if (bus === null) return false;

  try {
    const response = await fetch(clipUrl(clip));
    if (!response.ok) return false;
    const buffer = await bus.context.decodeAudioData(await response.arrayBuffer());
    if (ownRequest !== request) return false;

    const source = bus.context.createBufferSource();
    const gain = bus.context.createGain();
    source.buffer = buffer;
    gain.gain.value = VOICE_GAIN;
    source.connect(gain);
    gain.connect(bus.voice);
    activeSource = source;

    const ducked = await requestMusicDucking();
    if (ownRequest !== request) {
      if (ducked) releaseMusicDuckingAfter(0);
      return false;
    }

    source.onended = () => {
      if (activeSource === source) activeSource = null;
      if (ownRequest !== request) return;
      if (ducked) releaseMusicDuckingAfter(0);
      onEnded();
    };
    source.start();
    if (ducked) releaseMusicDuckingAfter(buffer.duration * 1_000 + 200);
    return true;
  } catch {
    return false;
  }
}
