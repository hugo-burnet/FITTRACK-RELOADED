/**
 * The sound at the end of a rest, and the gesture that makes it possible.
 *
 * **Synthesised, not a file.** Two short tones from an oscillator cost zero
 * bytes, raise no licence question on a public repository, and work with no
 * network — which is the point of an app used in a basement.
 *
 * **The unlock is the whole problem.** Mobile browsers refuse to start audio
 * without a user gesture, and a `play()` fired from a timer two minutes later
 * has none: it fails silently, which is the worst possible failure for a
 * feature whose entire job is to make a noise. So the context is created and
 * resumed on the first touch of the session, and reused from then on.
 */

let context: AudioContext | null = null;

/** Chrome ships it prefixed on older Android WebViews. */
type AudioContextCtor = typeof AudioContext;

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
export function unlockChime(): void {
  try {
    const Ctor = constructor();
    if (Ctor === undefined) return;
    context ??= new Ctor();
    if (context.state === 'suspended') void context.resume();
  } catch {
    context = null;
  }
}

/** Rest is over. Two rising tones — short enough to cut through a gym, not an alarm. */
export function playChime(): void {
  try {
    const audio = context;
    if (audio === null || audio.state !== 'running') return;

    // A4 then E5. The interval carries further than a single beep, and two
    // events read as "that was the app" rather than as a notification.
    tone(audio, 880, 0);
    tone(audio, 1318.5, 0.18);
  } catch {
    // Nothing to recover: the vibration has already fired.
  }
}

function tone(audio: AudioContext, frequency: number, delay: number): void {
  const start = audio.currentTime + delay;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;

  // Ramped, never switched: a gain that jumps to 0 clicks, and a click is the
  // one thing that makes a synthesised sound read as a bug.
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);

  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + 0.2);
}

/** The end of a rest, felt. Two taps — the 10 ms tick already means "threshold crossed". */
export function buzzRestOver(): void {
  navigator.vibrate?.([80, 60, 80]);
}
