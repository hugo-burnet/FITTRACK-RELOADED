import { CUES, clipsFor, isRepCadence, type CueId } from './cues';
import type { ToneId } from './tones';

/**
 * The cadence rules — the only part of the announcer that has to be right.
 *
 * Playing a sound is trivial; deciding *not* to play one is the whole feature.
 * A voice that comments on every set becomes the reason the feature gets turned
 * off in week two, so the rules here are written to spend words sparingly:
 *
 * - a **tone** fires whenever its cue does, because a tone is information;
 * - a **line** only fires when the cue is worth a sentence, when nothing else
 *   is speaking, and when the same cue did not just speak;
 * - a **higher priority** buys the right to interrupt — a record beats a
 *   "dernière série", nothing beats a record.
 *
 * Pure and injected with its clock and its picker, so a session's worth of
 * announcements can be replayed in a test without an audio device.
 */
export type AnnouncerMode = 'silence' | 'sounds' | 'voice' | 'voice-only';

/**
 * Ce qu'un mode autorise — la seule autorité, et volontairement pas un `if`.
 *
 * Trois questions séparées parce qu'elles ne se recouvrent pas : « Voix
 * uniquement » parle et sonne comme le mode complet, et ne diffère que sur la
 * cadence. Un composant qui rejouerait la règle chez lui finirait par diverger
 * d'elle le jour où un quatrième mode arrive.
 */
export interface GuidancePolicy {
  voice: boolean;
  tones: boolean;
  /** Le métronome de répétitions a-t-il le droit d'être armé ? */
  repPacing: boolean;
}

export function guidancePolicy(mode: AnnouncerMode): GuidancePolicy {
  switch (mode) {
    case 'silence':
      return { voice: false, tones: false, repPacing: true };
    case 'sounds':
      return { voice: false, tones: true, repPacing: true };
    case 'voice':
      return { voice: true, tones: true, repPacing: true };
    case 'voice-only':
      return { voice: true, tones: true, repPacing: false };
  }
}

export interface AnnouncerMemory {
  /** When the last line started, on the wall clock. */
  spokeAt: number;
  spokePriority: number;
  firedAt: Readonly<Partial<Record<CueId, number>>>;
  lastClip: Readonly<Partial<Record<CueId, string>>>;
}

export interface CuePlan {
  tone: ToneId | null;
  clip: string | null;
}

const SILENT: CuePlan = { tone: null, clip: null };

export const EMPTY_MEMORY: AnnouncerMemory = {
  spokeAt: Number.NEGATIVE_INFINITY,
  spokePriority: 0,
  firedAt: {},
  lastClip: {},
};

/** Chooses among the variants of a line. Injected so tests stay deterministic. */
export type ClipPicker = (clips: readonly string[]) => string;

export const pickAtRandom: ClipPicker = (clips) =>
  clips[Math.floor(Math.random() * clips.length)] ?? '';

export function planCue(
  memory: AnnouncerMemory,
  mode: AnnouncerMode,
  cue: CueId,
  now: number,
  choose: ClipPicker,
): { plan: CuePlan; memory: AnnouncerMemory } {
  const policy = guidancePolicy(mode);
  if (!policy.voice && !policy.tones) return { plan: SILENT, memory };

  // Le tri du mode « Voix uniquement » : la tonalité part avec la phrase. Ne
  // retirer que la phrase aurait laissé le battement, qui est justement ce
  // qu'on ne supporte plus au bout de deux semaines.
  if (!policy.repPacing && isRepCadence(cue)) return { plan: SILENT, memory };

  const definition = CUES[cue];
  const previous = memory.firedAt[cue];
  if (previous !== undefined && now - previous < definition.cooldownMs) {
    return { plan: SILENT, memory };
  }

  const clip = policy.voice ? chooseLine(memory, cue, now, choose) : null;
  const plan: CuePlan = { tone: definition.tone, clip };

  return {
    plan,
    memory: {
      // A cue that says nothing claims no silence: `set-validated` fires thirty
      // times a session, and letting it start a grace period would mute every
      // sentence that follows a set — which is all of them.
      spokeAt: clip === null ? memory.spokeAt : now,
      spokePriority: clip === null ? memory.spokePriority : definition.priority,
      firedAt: { ...memory.firedAt, [cue]: now },
      lastClip: clip === null ? memory.lastClip : { ...memory.lastClip, [cue]: clip },
    },
  };
}

function chooseLine(
  memory: AnnouncerMemory,
  cue: CueId,
  now: number,
  choose: ClipPicker,
): string | null {
  const clips = clipsFor(cue);
  if (clips.length === 0) return null;

  const definition = CUES[cue];
  const quiet = now - memory.spokeAt >= definition.gapMs;
  if (!quiet && definition.priority <= memory.spokePriority) return null;

  // Never the same variant twice running: two identical sentences in a row is
  // what makes a recorded voice sound like a machine, where three rotating ones
  // sound like someone watching.
  const previous = memory.lastClip[cue];
  const candidates =
    clips.length > 1 && previous !== undefined
      ? clips.filter((candidate) => candidate !== previous)
      : clips;

  const picked = choose(candidates);
  return picked === '' ? null : picked;
}
