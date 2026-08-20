import { announce, primeAnnouncer, voiceQueueRemainingMs } from '@/audio/announce';
import type { CueId } from '@/audio/cues';
import type { CoachSignal } from '@/lib/coach';
import { requestMusicDucking, releaseMusicDuckingAfter } from '@/platform/audioFocus';
import { loadAnnouncerMode } from '@/stores/announcer';

type RecapCue =
  | 'coach-recap-steady'
  | 'coach-recap-progress'
  | 'coach-recap-increase'
  | 'coach-recap-adjust'
  | 'coach-recap-fatigue'
  | 'coach-recap-plateau';

function signalCue(signal: CoachSignal): RecapCue {
  switch (signal.code) {
    case 'range_satisfied':
      return 'coach-recap-progress';
    case 'range_ceiling_reached':
    case 'range_completed':
      return 'coach-recap-increase';
    case 'range_missed':
      return 'coach-recap-adjust';
    case 'intra_session_drop':
    case 'long_rest':
      return 'coach-recap-fatigue';
    case 'plateau':
      return 'coach-recap-plateau';
  }
}

/** One concise conclusion per distinct finding, in the coach's display order. */
export function workoutRecapCues(signals: readonly CoachSignal[]): CueId[] {
  if (signals.length === 0) return ['workout-recap-start', 'coach-recap-steady'];
  const findings = [...new Set(signals.map(signalCue))];
  return ['workout-recap-start', ...findings];
}

/** Speak the visible coach recap, ducking external Android media for its duration. */
export async function speakWorkoutRecap(signals: readonly CoachSignal[]): Promise<void> {
  if (loadAnnouncerMode() !== 'voice') return;
  primeAnnouncer();
  const ducked = await requestMusicDucking();
  let spoke = false;
  for (const cue of workoutRecapCues(signals)) spoke = announce(cue) || spoke;
  if (ducked) releaseMusicDuckingAfter(spoke ? voiceQueueRemainingMs() + 250 : 0);
}
