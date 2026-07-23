import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Must match the GitHub repository name, slashes included.
  base: '/FITTRACK-RELOADED/',
  plugins: [react(), tailwindcss()],
  resolve: {
    // fileURLToPath, not URL.pathname: on Windows the latter yields
    // "/C:/..." and percent-encodes spaces, which breaks resolution.
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    globals: true,
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
