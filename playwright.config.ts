import { defineConfig } from '@playwright/test';

const PORT = 4173;
// Le préfixe de Pages, comme `vite.config.ts` : l'app est servie sous `/FITTRACK-RELOADED/`.
const BASE_URL = `http://localhost:${PORT}/FITTRACK-RELOADED/`;

/**
 * L'E2E de FitTrack : le **vrai build**, servi comme Pages le sert, ouvert dans un navigateur à la
 * taille d'un téléphone.
 *
 * Il existe parce que les composants d'affichage ne se testent pas en jsdom (CLAUDE.md) : une
 * mise en page, une cible tactile ou un libellé qui déborde en thème TTY1 ne se voient que dans un
 * vrai moteur de rendu. Avant lui, chaque session refaisait ces contrôles à la main dans Chromium
 * — et le même défaut (un libellé qui passe sur deux lignes en TTY1) a été redécouvert trois fois
 * le même jour.
 *
 * - **390 × 844**, tactile, texte en français : le téléphone de la règle n° 5.
 * - **Mouvement réduit** : pas d'attente d'animation, donc pas de test qui dépend d'une durée.
 * - **Service worker bloqué** par défaut : il précache 8 Mo par contexte et n'apporte rien à un
 *   parcours. Seul `hors-ligne.spec.ts` le réactive, puisque c'est son sujet.
 * - Un contexte neuf par test : une base vide, comme le premier lancement.
 *
 * `npm run test:e2e` construit puis sert le build ; un serveur déjà lancé sur ce port est réutilisé
 * hors CI.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  outputDir: 'test-results',
  use: {
    baseURL: BASE_URL,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    contextOptions: { reducedMotion: 'reduce' },
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
