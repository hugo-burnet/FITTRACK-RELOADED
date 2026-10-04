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

/**
 * `null`: the finding asks for nothing — the plan stays as it is. It must not
 * say « plan inchangé » on its own, or a recap that also says « la charge sera
 * ajustée » would contradict itself; it only stops being read as a change.
 */
function signalCue(signal: CoachSignal): RecapCue | null {
  switch (signal.code) {
    case 'range_satisfied':
    case 'consolidating':
      return 'coach-recap-progress';
    case 'range_ceiling_reached':
    case 'range_completed':
      // Plafond arraché (R1) : la carte ne propose pas de charge, la voix non plus.
      if (signal.evidence.some((item) => item.label === 'ceiling_grinding' && item.value === 1)) {
        return null;
      }
      // Cran pas encore absorbé (R3.2) : l'objectif du jour est tenu, la hausse attend.
      if (signal.evidence.some((item) => item.label === 'step_needs_reps')) {
        return 'coach-recap-progress';
      }
      return 'coach-recap-increase';
    // Reprise (R5) : on refait la séance, le plan ne bouge pas.
    case 'returning':
      return null;
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
  const findings = [
    ...new Set(signals.map(signalCue).filter((cue): cue is RecapCue => cue !== null)),
  ];
  if (findings.length === 0) return ['workout-recap-start', 'coach-recap-steady'];
  return ['workout-recap-start', ...findings];
}

/**
 * The sessions whose recap has already been read out.
 *
 * Module-level, like the greeting and the records: the finish screen is one
 * back-and-forth away from the session screen, and a ref inside the component
 * forgets everything the moment you leave it — so the whole recap was spoken
 * again on every return. Dies with the page, which is the right answer for a
 * session resumed after a kill.
 */
const spoken = new Set<string>();

export function claimWorkoutRecap(workoutId: string): boolean {
  if (spoken.has(workoutId)) return false;
  spoken.add(workoutId);
  return true;
}

/** Only for the tests: the set is a module singleton by design. */
export function forgetWorkoutRecaps(): void {
  spoken.clear();
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
