import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { ErrorBoundary } from './app/ErrorBoundary';
import { router } from './router';
import { applyTheme, loadTheme } from './stores/theme';
import './index.css';

// index.html already set data-theme before first paint to avoid a flash; this
// re-applies it from the single source of truth so the two cannot drift.
applyTheme(loadTheme());

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Élément racine #root introuvable');

createRoot(rootElement).render(
  <StrictMode>
    <ErrorBoundary>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </StrictMode>,
);
