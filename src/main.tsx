import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { BOOT_HOLD_MS, BootCurtain, BootScreen, SeedErrorBanner } from './app/Boot';
import { ErrorBoundary } from './app/ErrorBoundary';
import { UpdateBanner } from './app/UpdateBanner';
import { initializePersistentData } from './data/initialize';
import { watchAppUpdate } from './platform/appUpdate';
import { watchInstall } from './platform/install';
import { watchNavDirection } from './app/navigation';
import { router } from './router';
import { applyTheme, loadTheme } from './stores/theme';
import './index.css';

// index.html already set data-theme before first paint to avoid a flash; this
// re-applies it from the single source of truth so the two cannot drift.
applyTheme(loadTheme());

// Both before `createRoot`, and both deliberately outside initialization:
// `beforeinstallprompt` can fire before the first render and is lost if nothing
// is listening, and registering the worker is what makes the *next* cold start
// work offline — neither has any reason to wait on the exercise catalogue.
watchInstall();
watchAppUpdate();
watchNavDirection();

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Élément racine #root introuvable');

const root = createRoot(rootElement);

function mount(seedFailed: boolean) {
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <BootCurtain />
        {seedFailed && <SeedErrorBanner />}
        <UpdateBanner />
        <RouterProvider router={router} />
      </ErrorBoundary>
    </StrictMode>,
  );
}

// Persistent projections have to be ready before the first screen queries
// them, so the opening screen holds until initialization resolves.
root.render(<BootScreen />);

/**
 * Les deux attentes courent ensemble, jamais l'une après l'autre : le rideau
 * dure ce qu'il dure, et une base lente le prolonge au lieu de s'y ajouter.
 */
void Promise.all([
  initializePersistentData().then(
    () => false,
    (error: unknown) => {
      // A failed seed must never leave a blank screen. The app starts anyway and
      // says so: the user's own data does not depend on the catalogue.
      console.error('Le seed du catalogue a échoué', error);
      return true;
    },
  ),
  new Promise((resolve) => setTimeout(resolve, BOOT_HOLD_MS)),
]).then(([seedFailed]) => mount(seedFailed));
