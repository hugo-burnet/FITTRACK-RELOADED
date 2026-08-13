import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveTextFile } from './saveFile';

const PAYLOAD = {
  name: 'fittrack-2026-08-02.csv',
  text: 'title,reps\r\nLOWER A,12\r\n',
  type: 'text/csv',
  title: 'Sauvegarde FitTrack',
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
        native: { writeCache, share },
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
        native: { writeCache, share },
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
        native: { writeCache, share },
      }),
    ).toBe('failed');
    expect(share).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it('préfixe le contenu d’un BOM pour qu’Excel lise les accents', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    install({ share, canShare: () => true });

    await saveTextFile({ ...PAYLOAD, text: 'Développé' });

    // Sur les octets, pas sur `.text()` : la lecture d'un Blob décode l'UTF-8
    // et retire le BOM au passage, donc elle ne peut pas dire s'il est là.
    const shared = share.mock.calls[0]?.[0] as { files: File[] };
    const bytes = new Uint8Array(await shared.files[0]!.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  });
});
