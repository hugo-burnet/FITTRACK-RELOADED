import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CyberGlitch } from './CyberGlitch';

const playScreenGlitch = vi.hoisted(() => vi.fn(() => true));
vi.mock('@/audio/screenGlitch', () => ({ playScreenGlitch, warmUpCyberSounds: vi.fn() }));

const router: { go: (path: string) => void } = { go: () => {} };
function Navigator() {
  const navigate = useNavigate();
  useEffect(() => {
    router.go = (path) => void navigate(path);
  }, [navigate]);
  return null;
}
const go = (path: string) => router.go(path);

function renderAt(theme: string) {
  document.documentElement.setAttribute('data-theme', theme);
  document.body.innerHTML = '';
  const root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Navigator />
      <CyberGlitch />
    </MemoryRouter>,
    { container: root },
  );
}

describe('CyberGlitch', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    vi.useRealTimers();
    playScreenGlitch.mockClear();
  });

  it('tears the screen and plays its glitch when a screen arrives, not at first paint', () => {
    vi.useFakeTimers();
    renderAt('cyber');
    expect(playScreenGlitch).not.toHaveBeenCalled();

    act(() => go('/history'));

    expect(playScreenGlitch).toHaveBeenCalledOnce();
    act(() => vi.advanceTimersByTime(60));
    expect(document.getElementById('root')?.style.filter).toContain('#cyber-tear');
    act(() => vi.advanceTimersByTime(300));
    expect(document.getElementById('root')?.style.filter).toBe('');
    expect(document.querySelector('.cyber-gband')).toBeNull();
  });

  it('does nothing in the other themes', () => {
    const view = renderAt('dark');

    act(() => go('/history'));

    expect(playScreenGlitch).not.toHaveBeenCalled();
    expect(view.container.querySelector('#cyber-tear')).toBeNull();
  });
});
