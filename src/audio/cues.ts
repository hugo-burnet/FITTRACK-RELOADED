import script from './voiceScript.json';
import type { ToneId } from './tones';

/**
 * What the announcer has to say, and what it is allowed to say it over.
 *
 * A cue is an event of the session, not a sound: the sound is what the cue
 * *always* produces, the line is what it produces when the voice is on and the
 * cadence rules allow it. Splitting the two is what keeps the feature usable
 * over four hundred sets a month — a tone can fire thirty times a session, a
 * sentence cannot.
 */
export type CueId =
  | 'workout-started'
  | 'set-validated'
  | 'last-set-ahead'
  | 'exercise-cleared'
  | 'record-beaten'
  | 'rest-10'
  | 'rest-3'
  | 'rest-2'
  | 'rest-1'
  | 'rest-over'
  | 'rest-extended'
  | 'pace-start-10'
  | 'pace-reps-missing'
  | 'rep-tick'
  | 'rep-3'
  | 'rep-2'
  | 'rep-1'
  | 'set-done'
  | 'workout-recap-start'
  | 'coach-recap-steady'
  | 'coach-recap-progress'
  | 'coach-recap-increase'
  | 'coach-recap-adjust'
  | 'coach-recap-fatigue'
  | 'coach-recap-plateau'
  | 'workout-finished';

export interface CueDefinition {
  /** Always played, in every mode but silence. `null` for a line-only cue. */
  tone: ToneId | null;
  /**
   * Who wins when two cues land inside the same breath. A higher number
   * speaks over the quiet time a lower one just claimed — a record is worth
   * interrupting a "dernière série" for, never the reverse.
   */
  priority: number;
  /**
   * How much silence a line wants before it. A countdown asks for almost
   * none — its three words are one sentence spoken across three seconds —
   * where a comment on the session asks for a couple of seconds, so that two
   * unrelated events never overlap into mush.
   */
  gapMs: number;
  /** The same cue stays silent for this long after firing. */
  cooldownMs: number;
  /** Spoken outside an active set: temporarily lower other Android media. */
  duckMusic: boolean;
}

export const CUES: Record<CueId, CueDefinition> = {
  'workout-started': {
    tone: 'chime', priority: 2, gapMs: 1_500, cooldownMs: 60_000, duckMusic: true,
  },
  // The one cue with no line: it fires on every validated set.
  'set-validated': { tone: 'validate', priority: 0, gapMs: 0, cooldownMs: 0, duckMusic: false },
  'last-set-ahead': {
    tone: 'validate', priority: 2, gapMs: 3_000, cooldownMs: 20_000, duckMusic: true,
  },
  'exercise-cleared': {
    tone: 'validate', priority: 2, gapMs: 3_000, cooldownMs: 20_000, duckMusic: true,
  },
  // One validation may create several distinct records. The voice pack queues
  // their lines; a cue cooldown here would silently discard all but the first.
  'record-beaten': {
    tone: 'record', priority: 3, gapMs: 0, cooldownMs: 0, duckMusic: true,
  },
  'rest-10': { tone: null, priority: 2, gapMs: 1_000, cooldownMs: 0, duckMusic: true },
  // The countdown is the cadence: three ticks, one per second, no cooldown
  // between them and nothing allowed to speak across them.
  'rest-3': { tone: 'tick', priority: 1, gapMs: 700, cooldownMs: 0, duckMusic: true },
  'rest-2': { tone: 'tick', priority: 1, gapMs: 700, cooldownMs: 0, duckMusic: true },
  'rest-1': { tone: 'tick', priority: 1, gapMs: 700, cooldownMs: 0, duckMusic: true },
  'rest-over': {
    tone: 'chime', priority: 2, gapMs: 700, cooldownMs: 5_000, duckMusic: true,
  },
  // Said once, when the effort strip buys you seconds. Worth a sentence because
  // the number on the rest line changed under you and nothing else explains it.
  'rest-extended': {
    tone: 'validate', priority: 2, gapMs: 1_000, cooldownMs: 5_000, duckMusic: true,
  },
  'pace-start-10': {
    tone: null, priority: 3, gapMs: 1_000, cooldownMs: 0, duckMusic: true,
  },
  'pace-reps-missing': {
    tone: 'chime', priority: 3, gapMs: 700, cooldownMs: 2_000, duckMusic: true,
  },
  // The rep metronome. `rep-tick` is the beat and says nothing — it fires
  // eight to twelve times a set. Only the last three reps are named, and the
  // words are recorded apart from the rest countdown's: the same "trois" said
  // over a bar and said to someone standing up are not the same "trois".
  'rep-tick': { tone: 'repTap', priority: 1, gapMs: 0, cooldownMs: 0, duckMusic: false },
  'rep-3': { tone: 'repTap', priority: 1, gapMs: 700, cooldownMs: 0, duckMusic: false },
  'rep-2': { tone: 'repTap', priority: 1, gapMs: 700, cooldownMs: 0, duckMusic: false },
  'rep-1': { tone: 'repTap', priority: 1, gapMs: 700, cooldownMs: 0, duckMusic: false },
  'set-done': {
    tone: 'validate', priority: 2, gapMs: 700, cooldownMs: 3_000, duckMusic: true,
  },
  // These lines form one deliberate debrief. They all enter the voice pack at
  // once; its one-second breathing room serializes them without losing any.
  'workout-recap-start': {
    tone: 'chime', priority: 3, gapMs: 0, cooldownMs: 60_000, duckMusic: true,
  },
  'coach-recap-steady': {
    tone: null, priority: 3, gapMs: 0, cooldownMs: 60_000, duckMusic: true,
  },
  'coach-recap-progress': {
    tone: null, priority: 3, gapMs: 0, cooldownMs: 60_000, duckMusic: true,
  },
  'coach-recap-increase': {
    tone: null, priority: 3, gapMs: 0, cooldownMs: 60_000, duckMusic: true,
  },
  'coach-recap-adjust': {
    tone: null, priority: 3, gapMs: 0, cooldownMs: 60_000, duckMusic: true,
  },
  'coach-recap-fatigue': {
    tone: null, priority: 3, gapMs: 0, cooldownMs: 60_000, duckMusic: true,
  },
  'coach-recap-plateau': {
    tone: null, priority: 3, gapMs: 0, cooldownMs: 60_000, duckMusic: true,
  },
  'workout-finished': {
    tone: 'chime', priority: 3, gapMs: 1_500, cooldownMs: 60_000, duckMusic: true,
  },
};

export interface VoiceLine {
  id: string;
  cue: CueId;
  text: string;
}

const LINES: readonly VoiceLine[] = (script.lines as VoiceLine[]).filter(
  (line) => line.cue in CUES,
);

const BY_CUE = new Map<CueId, string[]>();
for (const line of LINES) {
  const clips = BY_CUE.get(line.cue) ?? [];
  clips.push(line.id);
  BY_CUE.set(line.cue, clips);
}

/** The clip ids that can answer a cue, in script order. Empty = tone only. */
export function clipsFor(cue: CueId): readonly string[] {
  return BY_CUE.get(cue) ?? [];
}

/** Every clip the pack expects, for the warm-up and for the settings check. */
export function allClips(): readonly string[] {
  return LINES.map((line) => line.id);
}

/** The written line behind a clip, for the credits screen and the generator. */
export function textOf(clip: string): string | undefined {
  return LINES.find((line) => line.id === clip)?.text;
}
