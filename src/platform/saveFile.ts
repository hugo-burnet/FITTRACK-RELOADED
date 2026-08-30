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
  /**
   * The same write, for bytes. A PNG has no encoding to declare: Capacitor
   * takes base64 and writes the decoded bytes, which is the only way an image
   * survives the trip through the WebView bridge intact.
   */
  writeCacheBinary: (name: string, base64: string) => Promise<string>;
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

const capacitorFileSave: NativeFileSave = {
  async writeCache(name, text) {
    const written = await Filesystem.writeFile({
      path: name,
      data: text,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    return written.uri;
  },
  async writeCacheBinary(name, base64) {
    const written = await Filesystem.writeFile({
      path: name,
      data: base64,
      directory: Directory.Cache,
    });
    return written.uri;
  },
  async share(title, fileUri) {
    await Share.share({ title, files: [fileUri], dialogTitle: title });
  },
};

async function shareNatively(
  title: string,
  native: NativeFileSave,
  write: (native: NativeFileSave) => Promise<string>,
): Promise<SaveOutcome> {
  let uri: string;
  try {
    uri = await write(native);
  } catch {
    return 'failed';
  }
  try {
    await native.share(title, uri);
    return 'shared';
  } catch (error) {
    return isShareCancelled(error) ? 'cancelled' : 'failed';
  }
}

/**
 * The ladder itself, once, whatever the file is made of.
 *
 * Text and bytes only differ in how the Android write is spelled; everything
 * above — what Chrome will share, what a WebView lies about, what a desktop
 * browser can download — is the same three rungs in the same order.
 */
async function saveFile(
  file: File,
  title: string,
  options: SaveFileOptions,
  writeNatively: (native: NativeFileSave) => Promise<string>,
): Promise<SaveOutcome> {
  const isNative = options.isNative ?? isNativeAndroid;
  const native = options.native ?? capacitorFileSave;

  // `canShare` and not `share` alone: Chrome exposes `share` on desktop but
  // refuses files, and the refusal is a rejected promise mid-flight rather than
  // something we can catch before the user has watched a dialog fail.
  if (canShareFile(file)) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (error) {
      if (isShareCancelled(error)) return 'cancelled';
      if (isNative()) return shareNatively(title, native, writeNatively);
      return download(file);
    }
  }

  // The WebView download click is a lie: it returns success and writes nothing.
  // On the APK the share sheet is the only way a backup actually leaves the app.
  if (isNative()) return shareNatively(title, native, writeNatively);

  return download(file);
}

export async function saveTextFile(
  payload: SaveFilePayload,
  options: SaveFileOptions = {},
): Promise<SaveOutcome> {
  const text = BOM + payload.text;
  return saveFile(
    new File([text], payload.name, { type: payload.type }),
    payload.title,
    options,
    (native) => native.writeCache(payload.name, text),
  );
}

export interface SaveBlobPayload {
  name: string;
  blob: Blob;
  /** Shown by the share sheet above the file. */
  title: string;
}

/**
 * Reads a blob as the base64 the Capacitor bridge takes.
 *
 * `FileReader` and not `arrayBuffer()` + `btoa`: a chart PNG is a few tens of
 * kilobytes, and turning that into a `String.fromCharCode` argument list is how
 * an export dies with "too many arguments" on a phone rather than on a desktop.
 */
function toBase64(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Blob could not be read'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });
}

/** The same three rungs, for bytes: an image, a PDF, anything not typed. */
export async function saveBlobFile(
  payload: SaveBlobPayload,
  options: SaveFileOptions = {},
): Promise<SaveOutcome> {
  return saveFile(
    new File([payload.blob], payload.name, { type: payload.blob.type }),
    payload.title,
    options,
    async (native) => native.writeCacheBinary(payload.name, await toBase64(payload.blob)),
  );
}
