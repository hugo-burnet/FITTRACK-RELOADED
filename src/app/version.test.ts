import { readFileSync } from 'node:fs';
import { APP_VERSION } from './version';

describe('APP_VERSION', () => {
  it('is the version package.json carries, the one the APK is built with', () => {
    const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

    expect(APP_VERSION).toBe(version);
  });

  it('is a plain major.minor.patch, with no prefix of its own', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
