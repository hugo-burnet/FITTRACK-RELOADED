/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
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
  },
});
