import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// Must match the GitHub repository name, slashes included.
const BASE = '/FITTRACK-RELOADED/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt', never 'autoUpdate'. A service worker that swaps itself mid-
      // session can reload the page under a live workout, and rule n°4 says a
      // set in progress survives everything. The user is asked instead, by
      // UpdateBanner, and the swap happens when they say so.
      registerType: 'prompt',

      // The icons live in public/ and are copied verbatim; only the manifest
      // and the service worker are generated.
      includeAssets: ['icon.svg', 'apple-touch-icon-180x180.png'],

      manifest: {
        name: 'FitTrack',
        short_name: 'FitTrack',
        description: 'Suivi de musculation personnel, hors-ligne.',
        lang: 'fr',
        // Both are the dark theme's --surface-0. The manifest can only name one
        // theme, and dark is the default (cf. loadTheme in src/stores/theme.ts).
        // background_color paints the splash screen Android draws before the
        // first frame, so a mismatch here shows as a flash at every cold start.
        theme_color: '#12110f',
        background_color: '#12110f',
        display: 'standalone',
        orientation: 'portrait',
        // Explicit rather than inherited from `base`: start_url is what the
        // launcher icon opens, and getting it wrong is only visible once the
        // app is installed on a real phone.
        start_url: BASE,
        scope: BASE,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          // Kept as a separate entry rather than `purpose: 'any maskable'` on a
          // shared file: a launcher that crops an "any" icon would eat the
          // rounded corners, and the two arts are genuinely different files.
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },

      workbox: {
        // Everything the app is made of. The whole bundle is ~709 KB raw, so
        // precaching all of it costs one install and buys a cold start with the
        // phone in airplane mode — which is the entire point of the lot.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // The router is hash-based (ADR-003), so the only navigation the
        // network ever sees is the base URL itself. This one entry covers it.
        navigateFallback: `${BASE}index.html`,
        // Without this, every deploy leaves its predecessor's precache behind
        // and the origin's storage quota grows until eviction picks a victim.
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    // fileURLToPath, not URL.pathname: on Windows the latter yields
    // "/C:/..." and percent-encodes spaces, which breaks resolution.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    maxWorkers: 2,
    setupFiles: ['./src/test/setup.ts'],
    // Les worktrees d'agent sous `.claude/worktrees/` sont des copies complètes
    // du projet, tests compris. Sans cette exclusion, vitest les exécute tous —
    // le compte gonfle (≈ ×4) et un test cassé dans un vieux worktree ferait
    // échouer `test:run` sans rapport avec le dépôt. Même raison que l'exclusion
    // `.claude` déjà posée pour ESLint. `configDefaults.exclude` est repris pour
    // ne pas perdre node_modules/dist en le remplaçant.
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
});
