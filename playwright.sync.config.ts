import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testMatch: 'sync.spec.ts',
  testIgnore: [],
  outputDir: 'test-results/sync',
  use: { ...base.use, baseURL: 'http://localhost:4175/' },
  webServer: {
    command:
      'npm run build -- --mode homelab && npx vite preview --mode homelab --port 4175 --strictPort',
    url: 'http://localhost:4175/',
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
