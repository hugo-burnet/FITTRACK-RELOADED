/**
 * Getting text out of the app, and the four honest answers to "did it work".
 *
 * This is the first module of `src/platform/` — an addition to §7 of the
 * architecture, made explicitly rather than smuggled in. An adapter over a
 * browser API is not pure (`lib/`), not a door to the database (`data/`), not a
 * component (`ui/`) and not a feature (`features/`): it needs its own floor.
 *
 * **Text, not a file.** The use this exists for is pasting a session into a
 * conversation with a coach or a model. `navigator.share({ text })` drops it
 * into the body of the message; a `.md` attachment makes the reader open
 * something, and a download makes the user go find it. The file arrives with the
 * CSV, where a file genuinely is the product.
 */

export type ShareOutcome =
  | 'shared'
  /** The share sheet was unavailable or refused; the clipboard took over. */
  | 'copied'
  /** The user closed the share sheet. Not a failure, and not worth a message. */
  | 'cancelled'
  | 'failed';

export interface SharePayload {
  title: string;
  text: string;
}

async function copy(text: string): Promise<ShareOutcome> {
  try {
    if (navigator.clipboard === undefined) return 'failed';
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** The clipboard on its own, for the caller who asked for the clipboard. */
export async function copyText(text: string): Promise<ShareOutcome> {
  return copy(text);
}

export async function shareText(payload: SharePayload): Promise<ShareOutcome> {
  if (typeof navigator.share !== 'function') return copy(payload.text);

  try {
    await navigator.share({ title: payload.title, text: payload.text });
    return 'shared';
  } catch (error) {
    // Closing the share sheet is a decision, not a fault. Reporting it — or
    // silently copying instead — teaches the user that dismissing a dialog has
    // unpredictable consequences, which is how people stop reading them.
    if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
    return copy(payload.text);
  }
}
