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
 *
 * **Three ways out, in this order** — the same ladder as `saveFile.ts`, and for
 * the same reason it exists there:
 *
 * 1. **The native Android share sheet.** The Capacitor WebView does not
 *    implement the Web Share API at all: `navigator.share` is simply absent, so
 *    the APK — the way this app is actually used — fell straight through to the
 *    clipboard. "Partager" answered "copié dans le presse-papiers", which is
 *    not what the button says it does, and on a WebView with no clipboard
 *    permission it answered nothing at all. That is the broken share button.
 * 2. **The Web Share sheet**, for a real browser tab that has one.
 * 3. **The clipboard**, for the desktop browser that has neither.
 */

import { Share } from '@capacitor/share';
import { isNativeAndroid } from './nativeEnvironment';

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

/** Android-only share sheet. Injected in tests so jsdom never loads the plugin. */
export interface NativeTextShare {
  share: (payload: SharePayload) => Promise<void>;
}

export interface ShareOptions {
  isNative?: () => boolean;
  native?: NativeTextShare;
}

const capacitorTextShare: NativeTextShare = {
  async share(payload) {
    await Share.share({
      title: payload.title,
      text: payload.text,
      dialogTitle: payload.title,
    });
  },
};

async function copy(text: string): Promise<ShareOutcome> {
  try {
    if (navigator.clipboard === undefined) return 'failed';
    await navigator.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/**
 * Closing the share sheet is a decision, not a fault. Reporting it — or
 * silently copying instead — teaches the user that dismissing a dialog has
 * unpredictable consequences, which is how people stop reading them.
 *
 * The Capacitor plugin rejects with a plain `Error` carrying the platform's
 * word rather than an `AbortError`, so both shapes count as a dismissal.
 */
function isShareCancelled(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'AbortError') return true;
  const message = error.message.toLowerCase();
  return message.includes('cancel') || message.includes('abort');
}

/** The clipboard on its own, for the caller who asked for the clipboard. */
export async function copyText(text: string): Promise<ShareOutcome> {
  return copy(text);
}

export async function shareText(
  payload: SharePayload,
  options: ShareOptions = {},
): Promise<ShareOutcome> {
  const native = options.isNative ?? isNativeAndroid;

  if (native()) {
    try {
      await (options.native ?? capacitorTextShare).share(payload);
      return 'shared';
    } catch (error) {
      if (isShareCancelled(error)) return 'cancelled';
      return copy(payload.text);
    }
  }

  if (typeof navigator.share !== 'function') return copy(payload.text);

  try {
    await navigator.share({ title: payload.title, text: payload.text });
    return 'shared';
  } catch (error) {
    if (isShareCancelled(error)) return 'cancelled';
    return copy(payload.text);
  }
}
