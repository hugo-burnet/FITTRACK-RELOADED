import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveBlobFile, saveTextFile } from './saveFile';

/** Le CSV : le seul format de l'app qui demande un BOM, et qui le demande ici. */
const PAYLOAD = {
  name: 'fittrack-2026-08-02.csv',
  text: 'title,reps\r\nLOWER A,12\r\n',
  type: 'text/csv',
  title: 'Sauvegarde FitTrack',
  bom: true,
};

function install(world: { share?: unknown; canShare?: unknown }) {
  Object.defineProperty(navigator, 'share', {
    value: world.share,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(navigator, 'canShare', {
    value: world.canShare,
    configurable: true,
    writable: true,
  });
}

const abort = () => Object.assign(new Error('Share canceled'), { name: 'AbortError' });

beforeEach(() => {
  // jsdom n'implémente ni l'un ni l'autre : le téléchargement en a besoin.
  URL.createObjectURL = vi.fn().mockReturnValue('blob:fittrack');
  URL.revokeObjectURL = vi.fn();
  // Un clic sur une ancre de téléchargement fait râler jsdom (« navigation to
  // another Document ») : le lien n'est pas ce qu'on teste ici.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  install({ share: undefined, canShare: undefined });
});

describe('saveTextFile', () => {
  it('passe le fichier à la feuille de partage quand elle l’accepte', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    install({ share, canShare: () => true });

    expect(await saveTextFile(PAYLOAD)).toBe('shared');
    const shared = share.mock.calls[0]?.[0] as { files: File[] };
    expect(shared.files[0]?.name).toBe(PAYLOAD.name);
  });

  it('télécharge quand le navigateur ne sait pas partager de fichier', async () => {
    install({ share: vi.fn(), canShare: () => false });

    expect(await saveTextFile(PAYLOAD)).toBe('downloaded');
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('télécharge aussi quand il n’y a aucune API de partage', async () => {
    install({ share: undefined, canShare: undefined });

    expect(await saveTextFile(PAYLOAD)).toBe('downloaded');
  });

  it('rend « annulé » quand la feuille de partage est fermée, sans rien télécharger', async () => {
    install({ share: vi.fn().mockRejectedValue(abort()), canShare: () => true });

    expect(await saveTextFile(PAYLOAD)).toBe('cancelled');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('retombe sur le téléchargement quand le partage échoue vraiment', async () => {
    install({
      share: vi.fn().mockRejectedValue(new Error('NotAllowedError')),
      canShare: () => true,
    });

    expect(await saveTextFile(PAYLOAD)).toBe('downloaded');
  });

  it('retombe sur le téléchargement si canShare refuse le fichier en levant une erreur', async () => {
    install({
      share: vi.fn(),
      canShare: () => {
        throw new TypeError('Cannot share this file type');
      },
    });

    expect(await saveTextFile(PAYLOAD)).toBe('downloaded');
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it('sur Android natif, écrit le fichier et ouvre la feuille plutôt que de simuler un téléchargement', async () => {
    install({ share: undefined, canShare: undefined });
    const writeCache = vi.fn().mockResolvedValue('file:///cache/fittrack-2026-08-02.csv');
    const share = vi.fn().mockResolvedValue(undefined);

    expect(
      await saveTextFile(PAYLOAD, {
        isNative: () => true,
        native: { writeCache, writeCacheBinary: vi.fn(), share },
      }),
    ).toBe('shared');

    expect(writeCache).toHaveBeenCalledWith(
      PAYLOAD.name,
      `\uFEFF${PAYLOAD.text}`,
    );
    expect(share).toHaveBeenCalledWith(
      PAYLOAD.title,
      'file:///cache/fittrack-2026-08-02.csv',
    );
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('sur Android natif, une annulation de la feuille n’est pas un échec', async () => {
    const writeCache = vi.fn().mockResolvedValue('file:///cache/fittrack.csv');
    const share = vi.fn().mockRejectedValue(new Error('Share canceled'));

    expect(
      await saveTextFile(PAYLOAD, {
        isNative: () => true,
        native: { writeCache, writeCacheBinary: vi.fn(), share },
      }),
    ).toBe('cancelled');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('sur Android natif, une écriture refusée est un vrai échec, pas un téléchargement', async () => {
    const writeCache = vi.fn().mockRejectedValue(new Error('write failed'));
    const share = vi.fn();

    expect(
      await saveTextFile(PAYLOAD, {
        isNative: () => true,
        native: { writeCache, writeCacheBinary: vi.fn(), share },
      }),
    ).toBe('failed');
    expect(share).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  /** Les octets, pas `.text()` : lire un Blob décode l'UTF-8 et retire le BOM au
   *  passage, donc cette lecture-là ne peut pas dire s'il est là. C'est la même
   *  indulgence qui a laissé le JSON partir avec un BOM sans que rien ne le
   *  remarque de l'intérieur de l'app. */
  const firstBytes = async (share: ReturnType<typeof vi.fn>): Promise<number[]> => {
    const shared = share.mock.calls[0]?.[0] as { files: File[] };
    const bytes = new Uint8Array(await shared.files[0]!.arrayBuffer());
    return [...bytes.slice(0, 3)];
  };

  it('préfixe le CSV d’un BOM pour qu’Excel lise les accents', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    install({ share, canShare: () => true });

    await saveTextFile({ ...PAYLOAD, text: 'Développé' });

    expect(await firstBytes(share)).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('n’en met aucun quand le format n’en demande pas', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    install({ share, canShare: () => true });

    // Le JSON de la sauvegarde : trois octets de plus, et `json.load()` répond
    // « Unexpected UTF-8 BOM » à qui relit le fichier hors de l'app.
    await saveTextFile({
      name: 'fittrack-sauvegarde-2026-08-02.json',
      text: '{"format":"fittrack-backup"}',
      type: 'application/json;charset=utf-8',
      title: 'Sauvegarde FitTrack',
    });

    const bytes = await firstBytes(share);
    expect(bytes).not.toEqual([0xef, 0xbb, 0xbf]);
    expect(String.fromCharCode(bytes[0]!)).toBe('{');
  });
});

describe('saveBlobFile', () => {
  const png = () => new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
  const payload = () => ({
    name: 'fittrack-volume-2026-08-22.png',
    blob: png(),
    title: 'Volume d’entraînement',
  });

  it('passe l’image à la feuille de partage du navigateur quand elle en veut', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    install({ share, canShare: () => true });

    expect(await saveBlobFile(payload())).toBe('shared');
    const [[options]] = share.mock.calls as [[{ files: File[]; title: string }]];
    expect(options.files[0]?.name).toBe('fittrack-volume-2026-08-22.png');
    expect(options.files[0]?.type).toBe('image/png');
  });

  it('sur Android natif, écrit les octets en base64 puis ouvre la feuille', async () => {
    install({ share: undefined, canShare: undefined });
    const writeCacheBinary = vi.fn().mockResolvedValue('file:///cache/chart.png');
    const share = vi.fn().mockResolvedValue(undefined);

    expect(
      await saveBlobFile(payload(), {
        isNative: () => true,
        native: { writeCache: vi.fn(), writeCacheBinary, share },
      }),
    ).toBe('shared');

    const [[name, base64]] = writeCacheBinary.mock.calls as [[string, string]];
    expect(name).toBe('fittrack-volume-2026-08-22.png');
    // Les quatre premiers octets d'un PNG, en base64 et sans le préfixe data:.
    expect(base64).toBe('iVBORw==');
    expect(share).toHaveBeenCalledWith('Volume d’entraînement', 'file:///cache/chart.png');
  });

  it('sur un navigateur de bureau, tombe sur le téléchargement', async () => {
    install({ share: undefined, canShare: undefined });

    expect(await saveBlobFile(payload(), { isNative: () => false })).toBe('downloaded');
    expect(URL.createObjectURL).toHaveBeenCalled();
  });
});
