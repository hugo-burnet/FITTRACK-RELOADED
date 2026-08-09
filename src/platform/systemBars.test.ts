import { SystemBarsStyle } from '@capacitor/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { syncSystemBars } from './systemBars';

const state = vi.hoisted(() => ({
  native: true,
  setStyle: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@capacitor/core', () => ({
  SystemBars: { setStyle: state.setStyle },
  SystemBarsStyle: { Dark: 'DARK', Light: 'LIGHT' },
}));

vi.mock('./nativeEnvironment', () => ({
  isNativeAndroid: () => state.native,
}));

describe('syncSystemBars', () => {
  beforeEach(() => {
    state.native = true;
    vi.clearAllMocks();
  });

  it('does nothing on the web', async () => {
    state.native = false;

    await syncSystemBars('dark');

    expect(state.setStyle).not.toHaveBeenCalled();
  });

  it('uses dark system bars for the FitTrack dark theme', async () => {
    await syncSystemBars('dark');

    expect(state.setStyle).toHaveBeenCalledWith({ style: SystemBarsStyle.Dark });
  });

  it('uses light system bars for the FitTrack light theme', async () => {
    await syncSystemBars('light');

    expect(state.setStyle).toHaveBeenCalledWith({ style: SystemBarsStyle.Light });
  });

  it('contains native failures', async () => {
    const error = new Error('system bars failed');
    const report = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    state.setStyle.mockRejectedValueOnce(error);

    await expect(syncSystemBars('dark')).resolves.toBeUndefined();

    expect(report).toHaveBeenCalledWith(error);
    report.mockRestore();
  });
});
