/**
 * Getting a *file* out of the app — the sibling of `share.ts`, which gets text
 * out.
 *
 * Three ways down, in this order:
 *
 * 1. **The Web Share sheet, with the file attached.** Chrome on a real browser
 *    tab can do this. The Capacitor WebView usually cannot.
 * 2. **The native Android share sheet.** The WebView's `<a download>` click
 *    reports success and writes nothing — that is how "Sauvegarde téléchargée"
 *    appeared with no file. Filesystem + Share is the route that actually
 *    reaches Drive or Fichiers.
 * 3. **A plain download**, for the desktop browser that cannot share files.
 *
 * The BOM is deliberate: without it Excel reads `Développé couché` as mojibake,
 * and the CSV's first destination after the phone is a spreadsheet. Every CSV
 * reader in the app strips it (`readCsvRows`).
 */

import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNativeAndroid } from './nativeEnvironment';

export type SaveOutcome =
  | 'shared'
  | 'downloaded'
  /** The share sheet was dismissed. A decision, not a failure. */
  | 'cancelled'
  | 'failed';

export interface SaveFilePayload {
  name: string;
  text: string;
  type: string;
  /** Shown by the share sheet above the file. */
  title: string;
}

/** Android-only file write + share. Injected in tests so jsdom never loads the plugins. */
export interface NativeFileSave {
  writeCache: (name: string, text: string) => Promise<string>;
  share: (title: string, fileUri: string) => Promise<void>;
}

export interface SaveFileOptions {
  isNative?: () => boolean;
  native?: NativeFileSave;
}

const BOM = '\uFEFF';

function download(file: File): SaveOutcome {
  try {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.click();
    // Deferred, not immediate: revoking the URL in the same tick can beat the
    // navigation the click just started, and the file arrives empty.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

function canShareFile(file: File): boolean {
  if (typeof navigator.share !== 'function') return false;
  try {
    return navigator.canShare?.({ files: [file] }) === true;
  } catch {
    // Some Android WebViews throw TypeError instead of returning false. A throw
    // is the same answer as false: this browser will not share a file.
    return false;
  }
}

function isShareCancelled(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error.name === 'AbortError') return true;
  const message = error.message.toLowerCase();
  return message.includes('cancel') || message.includes('abort');
}

export const capacitorFileSave: NativeFileSave = {
  async writeCache(name, text) {
    const written = await Filesystem.writeFile({
      path: name,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    return written.uri;
  },
  async share(title, fileUri) {
    await Share.share({ title, files: [fileUri], dialogTitle: title });
  },
};

async function shareNatively(
  payload: SaveFilePayload,
  native: NativeFileSave,
): Promise<SaveOutcome> {
  let uri: string;
  try {
    uri = await native.writeCache(payload.name, BOM + payload.text);
  } catch {
    return 'failed';
  }
  try {
    await native.share(payload.title, uri);
    return 'shared';
  } catch (error) {
    return isShareCancelled(error) ? 'cancelled' : 'failed';
  }
}

export async function saveTextFile(
  payload: SaveFilePayload,
  options: SaveFileOptions = {},
): Promise<SaveOutcome> {
  const file = new File([BOM + payload.text], payload.name, { type: payload.type });
  const native = options.isNative ?? isNativeAndroid;

  // `canShare` and not `share` alone: Chrome exposes `share` on desktop but
  // refuses files, and the refusal is a rejected promise mid-flight rather than
  // something we can catch before the user has watched a dialog fail.
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title: payload.title });
      return 'shared';
    } catch (error) {
      if (isShareCancelled(error)) return 'cancelled';
      if (native()) return shareNatively(payload, options.native ?? capacitorFileSave);
      return download(file);
    }
  }

  // The WebView download click is a lie: it returns success and writes nothing.
  // On the APK the share sheet is the only way a backup actually leaves the app.
  if (native()) return shareNatively(payload, options.native ?? capacitorFileSave);

  return download(file);
}
