/**
 * The single audio context of the app, and the two rules that shape it.
 *
 * **Everything goes through Web Audio, nothing through `<audio>`.** An
 * `HTMLAudioElement` asks Android for audio focus, and Android grants it by
 * ducking whatever else is playing — the music in the headphones drops for the
 * duration of a 400 ms word, then climbs back. A `BufferSource` on a context
 * built for short effects mixes instead of interrupting. That is a requirement
 * of this feature, not an implementation detail: the announcer speaks *over*
 * the music, it never takes its place.
 *
 * **The unlock is the whole problem.** Mobile browsers refuse to start audio
 * without a user gesture, and a `play()` fired from a timer two minutes later
 * has none: it fails silently, which is the worst possible failure for a
 * feature whose entire job is to make a noise. So the context is created and
 * resumed on the first touch of the session, and reused from then on.
 */

export interface AudioBus {
  context: AudioContext;
  /** Every source connects here, so one gain controls the whole announcer. */
  master: GainNode;
}

/** Chrome ships it prefixed on older Android WebViews. */
type AudioContextCtor = typeof AudioContext;

let bus: AudioBus | null = null;
let volume = 1;

function constructor(): AudioContextCtor | undefined {
  const scope = window as typeof window & { webkitAudioContext?: AudioContextCtor };
  return scope.AudioContext ?? scope.webkitAudioContext;
}

/**
 * Called from a real user gesture, as often as one happens: creating the
 * context is what needs the gesture, and `resume()` is what recovers a context
 * the browser suspended while the app was in the background.
 *
 * Never throws. A device with no Web Audio still gets the vibration, and a rest
 * that ends silently is a degraded timer, not a broken screen.
 */
export function unlockAudio(): void {
  try {
    const Ctor = constructor();
    if (Ctor === undefined) return;
    if (bus === null) {
      // `interactive` asks the platform for the smallest buffer it can hold:
      // a countdown tick that lands 200 ms late is not a countdown.
      const context = new Ctor({ latencyHint: 'interactive' });
      const master = context.createGain();
      master.gain.value = volume;
      master.connect(context.destination);
      bus = { context, master };
    }
    if (bus.context.state === 'suspended') void bus.context.resume();
  } catch {
    bus = null;
  }
}

/**
 * The bus, or `null` when nothing can be played right now — no Web Audio, no
 * gesture yet, or a context the system suspended. Callers treat `null` as
 * "stay silent": scheduling into a suspended context queues sounds that all
 * fire at once on the next resume, several minutes late.
 */
export function audioBus(): AudioBus | null {
  if (bus === null) return null;
  return bus.context.state === 'running' ? bus : null;
}

/** 0 to 1. Applied live, and remembered for a context not yet created. */
export function setAudioVolume(next: number): void {
  volume = Math.min(1, Math.max(0, next));
  if (bus !== null) bus.master.gain.value = volume;
}
