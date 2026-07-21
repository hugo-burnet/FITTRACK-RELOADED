import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { BootScreen, SeedErrorBanner } from './app/Boot';
import { ErrorBoundary } from './app/ErrorBoundary';
import { seedDatabase } from './data/seed/seedDatabase';
import { router } from './router';
import { applyTheme, loadTheme } from './stores/theme';
import './index.css';

// index.html already set data-theme before first paint to avoid a flash; this
// re-applies it from the single source of truth so the two cannot drift.
applyTheme(loadTheme());

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Élément racine #root introuvable');

const root = createRoot(rootElement);

function mount(seedFailed: boolean) {
  root.render(
    <StrictMode>
      <ErrorBoundary>
        {seedFailed && <SeedErrorBanner />}
        <RouterProvider router={router} />
      </ErrorBoundary>
    </StrictMode>,
  );
}

// The catalogue has to be in place before the first screen queries it, so the
// boot screen holds until the seed resolves.
root.render(<BootScreen />);

void seedDatabase().then(
  () => mount(false),
  (error: unknown) => {
    // A failed seed must never leave a blank screen. The app starts anyway and
    // says so: the user's own data does not depend on the catalogue.
    console.error('Le seed du catalogue a échoué', error);
    mount(true);
  },
);
