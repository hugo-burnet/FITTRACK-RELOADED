import { beforeEach, describe, expect, it, vi } from 'vitest';

const { isNativePlatform, getPlatform } = vi.hoisted(() => ({
  isNativePlatform: vi.fn(),
  getPlatform: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform, getPlatform },
}));

describe('isNativeAndroid', () => {
  beforeEach(() => {
    isNativePlatform.mockReset();
    getPlatform.mockReset();
  });

  it('is true only inside the native Android container', async () => {
    isNativePlatform.mockReturnValue(true);
    getPlatform.mockReturnValue('android');
    const { isNativeAndroid } = await import('./nativeEnvironment');

    expect(isNativeAndroid()).toBe(true);
  });

  it('is false in the browser and on other native platforms', async () => {
    const { isNativeAndroid } = await import('./nativeEnvironment');
    isNativePlatform.mockReturnValue(false);
    getPlatform.mockReturnValue('web');
    expect(isNativeAndroid()).toBe(false);

    isNativePlatform.mockReturnValue(true);
    getPlatform.mockReturnValue('ios');
    expect(isNativeAndroid()).toBe(false);
  });
});
