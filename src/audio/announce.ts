import { loadAnnouncerEcho, loadAnnouncerMode } from '@/stores/announcer';
import { EMPTY_MEMORY, pickAtRandom, planCue, type AnnouncerMemory } from './announcer';
import { audioBus, setAudioEcho, unlockAudio } from './context';
import { CUES, allClips, clipsFor, type CueId } from './cues';
import { playTone } from './tones';
import { impactPack } from './impactPack';
import { voicePack } from './voicePack';
import { requestMusicDucking, releaseMusicDuckingAfter } from '@/platform/audioFocus';

/**
 * The announcer as the app calls it: one function, one cue, no ceremony.
 *
 * Everything that can decide *not* to make a sound lives upstream in
 * `planCue`; everything that can fail to make one lives downstream in the bus
 * and the pack. What is left here is the wiring, and the memory that survives
 * from one cue to the next.
 */
let memory: AnnouncerMemory = EMPTY_MEMORY;
let warmed = false;

/**
 * Called from a real user gesture. Creates the audio context the browser will
 * not let us create later, then pulls the clips into memory: a word decoded at
 * the moment it is needed arrives after the moment it described.
 */
export function primeAnnouncer(): void {
  unlockAudio();
  const bus = audioBus();
  if (bus === null) return;
  // The chain is built with the context, before anything has read the stored
  // preference — this is the first moment both exist, so it is where they meet.
  setAudioEcho(loadAnnouncerEcho());
  if (warmed) return;
  warmed = true;
  void impactPack.warmUp(bus);
  void voicePack.warmUp(bus, allClips());
}

/**
 * Plays a cue on demand, outside the cadence rules — the settings screen only.
 *
 * A preview that obeys the cooldown would answer the second tap with silence,
 * and silence is exactly what the person tapping is trying to rule out. It
 * waits for the clip rather than skipping it for the same reason: here, late
 * is not a problem, mute is.
 */
export async function previewAnnouncer(cue: CueId): Promise<void> {
  primeAnnouncer();
  const bus = audioBus();
  if (bus === null || loadAnnouncerMode() === 'silence') return;

  const { tone } = CUES[cue];
  if (tone !== null) playTone(bus, tone);
  if (loadAnnouncerMode() !== 'voice') return;

  const clips = clipsFor(cue);
  await voicePack.warmUp(bus, clips);
  const clip = pickAtRandom(clips);
  if (clip !== '') voicePack.play(bus, clip);
}

/**
 * Fires a cue, `when` seconds from now on the audio clock. Returns whether
 * anything was actually played — the rest countdown reads that answer to
 * decide whether it may stand the Android notification down.
 */
export function announce(cue: CueId, when = 0): boolean {
  const bus = audioBus();
  if (bus === null) return false;

  // The scheduled instant, not the current one: a countdown queued three
  // seconds ahead must be judged against the clock it will land on.
  const at = Date.now() + Math.max(0, when) * 1000;
  const result = planCue(memory, loadAnnouncerMode(), cue, at, pickAtRandom);
  memory = result.memory;

  const { tone, clip } = result.plan;
  if (tone !== null) playTone(bus, tone, when);
  const spoke = clip !== null && voicePack.play(bus, clip, when);
  if (spoke && CUES[cue].duckMusic) {
    void requestMusicDucking().then((granted) => {
      if (granted) releaseMusicDuckingAfter(voicePack.queuedMs(bus) + 250);
    });
  }
  return tone !== null || spoke;
}

/** How long external music must remain ducked for every queued line to finish. */
export function voiceQueueRemainingMs(): number {
  const bus = audioBus();
  return bus === null ? 0 : voicePack.queuedMs(bus);
}
