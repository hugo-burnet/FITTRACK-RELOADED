import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText, shareText } from './share';

const PAYLOAD = { title: 'FitTrack — Upper A', text: '# Export FitTrack' };

/** Both APIs are absent from jsdom, so each test installs the world it needs. */
function install(world: { share?: unknown; clipboard?: unknown }) {
  Object.defineProperty(navigator, 'share', {
    value: world.share,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(navigator, 'clipboard', {
    value: world.clipboard,
    configurable: true,
    writable: true,
  });
}

const abort = () => Object.assign(new Error('Share canceled'), { name: 'AbortError' });

afterEach(() => install({ share: undefined, clipboard: undefined }));

describe('shareText', () => {
  it('hands the text to the system share sheet', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    install({ share, clipboard: { writeText: vi.fn() } });

    expect(await shareText(PAYLOAD)).toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: PAYLOAD.title, text: PAYLOAD.text });
  });

  it('reports a dismissed share sheet as cancelled, and copies nothing', async () => {
    const writeText = vi.fn();
    install({ share: vi.fn().mockRejectedValue(abort()), clipboard: { writeText } });

    expect(await shareText(PAYLOAD)).toBe('cancelled');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies when the browser cannot share at all', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    install({ share: undefined, clipboard: { writeText } });

    expect(await shareText(PAYLOAD)).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(PAYLOAD.text);
  });

  it('copies when sharing fails for any other reason', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    install({ share: vi.fn().mockRejectedValue(new Error('NotAllowedError')), clipboard: { writeText } });

    expect(await shareText(PAYLOAD)).toBe('copied');
  });

  it('fails when there is neither a share sheet nor a clipboard', async () => {
    install({ share: undefined, clipboard: undefined });
    expect(await shareText(PAYLOAD)).toBe('failed');
  });

  it('fails when the clipboard refuses', async () => {
    install({
      share: undefined,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });

    expect(await shareText(PAYLOAD)).toBe('failed');
  });
});

describe('copyText', () => {
  it('copies without touching the share sheet', async () => {
    const share = vi.fn();
    const writeText = vi.fn().mockResolvedValue(undefined);
    install({ share, clipboard: { writeText } });

    expect(await copyText(PAYLOAD.text)).toBe('copied');
    expect(share).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith(PAYLOAD.text);
  });

  it('reports a refusal instead of pretending', async () => {
    install({ clipboard: undefined });
    expect(await copyText(PAYLOAD.text)).toBe('failed');
  });
});
