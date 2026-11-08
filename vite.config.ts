import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { contentSecurityPolicy } from './src/lib/contentSecurityPolicy';

const { version } = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string };

/**
 * Writes dist/csp.txt from the final index.html. The homelab proxy sends it,
 * and `vite preview` sends it too, so every E2E run exercises the same policy.
 */
function emitContentSecurityPolicy(): Plugin {
  return {
    name: 'fittrack-content-security-policy',
    enforce: 'post',
    generateBundle(_, bundle) {
      const page = bundle['index.html'];
      if (page?.type !== 'asset') return;
      this.emitFile({
        type: 'asset',
        fileName: 'csp.txt',
        source: `${contentSecurityPolicy(String(page.source))}
`,
      });
    },
  };
}
const builtPolicy = new URL('./dist/csp.txt', import.meta.url);

export default defineConfig(({ mode }) => {
  // GitHub Pages needs its repository prefix; Capacitor loads local files.
  const base = mode === 'android' ? './' : mode === 'homelab' ? '/' : '/FITTRACK-RELOADED/';

  return {
    base,
    // The one number a release bumps. The Android workflow reads the same field for the APK's
    // versionName, so the header and the APK cannot say different things.
    define: { __APP_VERSION__: JSON.stringify(version) },
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        disable: mode === 'android',
        // Never reload under an active workout without user confirmation.
        registerType: 'prompt',
        includeAssets: ['icon.svg', 'apple-touch-icon-180x180.png'],

        manifest: {
          name: 'FitTrack',
          short_name: 'FitTrack',
          description: 'Suivi de musculation personnel, hors-ligne.',
          lang: 'fr',
          theme_color: '#12110f',
          background_color: '#12110f',
          display: 'standalone',
          orientation: 'portrait',
          start_url: base,
          scope: base,
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },

        workbox: {
          // mp3, wav, and jpg included on purpose: a voice or a palier token
          // that needs the network is not a voice, in a basement with no 4G. Same for
          // woff2: the TTY1 theme without its font is a different app.
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,mp3,wav,jpg,woff2}'],
          navigateFallback: `${base}index.html`,
          navigateFallbackDenylist: [/^\/api\//],
          cleanupOutdatedCaches: true,
        },
      }),
      emitContentSecurityPolicy(),
    ],
    // Only the homelab build is served with headers; Pages cannot send any.
    preview: {
      headers:
        mode === 'homelab' && existsSync(builtPolicy)
          ? { 'Content-Security-Policy': readFileSync(builtPolicy, 'utf8').trim() }
          : {},
    },
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      maxWorkers: 2,
      setupFiles: ['./src/test/setup.ts'],
      // Prevent tests in local agent worktrees from running twice.
      // fittrack-kb-contract uses `node --test`, not vitest. Without this,
      // `npm run test:run` ingests its *.test.mjs files and fails CI deploy.
      exclude: [
        ...configDefaults.exclude,
        '**/.claude/**',
        '**/.worktrees/**',
        'fittrack-kb-contract/**',
        // Les parcours Playwright (`npm run test:e2e`) : même suffixe `.spec.ts`, autre lanceur.
        'e2e/**',
      ],
    },
  };
});
