/**
 * Getting a *file* out of the app — the sibling of `share.ts`, which gets text
 * out.
 *
 * Two ways down, in this order:
 *
 * 1. **The system share sheet, with the file attached.** On the phone this is
 *    the only route that reaches Drive, Files, or a message — a download on
 *    Android lands in `Downloads` and the user has to go dig it out. A backup
 *    you cannot put where you want is barely a backup.
 * 2. **A plain download**, for the browser that cannot share files — every
 *    desktop one, at the time of writing.
 *
 * The BOM is deliberate: without it Excel reads `Développé couché` as mojibake,
 * and the CSV's first destination after the phone is a spreadsheet. Every CSV
 * reader in the app strips it (`readCsvRows`).
 */

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

export async function saveTextFile(payload: SaveFilePayload): Promise<SaveOutcome> {
  const file = new File([BOM + payload.text], payload.name, { type: payload.type });

  // `canShare` and not `share` alone: Chrome exposes `share` on desktop but
  // refuses files, and the refusal is a rejected promise mid-flight rather than
  // something we can catch before the user has watched a dialog fail.
  if (
    typeof navigator.share === 'function' &&
    navigator.canShare?.({ files: [file] }) === true
  ) {
    try {
      await navigator.share({ files: [file], title: payload.title });
      return 'shared';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled';
      return download(file);
    }
  }

  return download(file);
}
