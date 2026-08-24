import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  // GitHub Pages needs its repository prefix; Capacitor loads local files.
  const base = mode === 'android' ? './' : '/FITTRACK-RELOADED/';

  return {
    base,
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
          // mp3 and wav included on purpose: a voice that needs the network is not
          // a voice, in a basement with no 4G. The clips and the one cadence
          // impact are precached with the rest of the shell.
          globPatterns: ['**/*.{js,css,html,svg,png,webmanifest,mp3,wav}'],
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
        },
      }),
    ],
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
      ],
    },
  };
});
