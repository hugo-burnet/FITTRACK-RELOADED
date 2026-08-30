import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { BOOT_HOLD_MS, BootCurtain, BootScreen, SeedErrorBanner } from './app/Boot';
import {
  getBootStorage,
  holdBootOpening,
  scheduleNextBootEasterEgg,
  selectBootVariant,
} from './app/bootEasterEgg';
import { ErrorBoundary } from './app/ErrorBoundary';
import { UpdateBanner } from './app/UpdateBanner';
import { initializePersistentData } from './data/initialize';
import { getActiveWorkout } from './data/repositories/workouts';
import { isWorkoutStale } from './app/staleWorkout';
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

const bootStorage = getBootStorage();
const requestedBoot = new URLSearchParams(window.location.search).get('boot');
const bootVariant =
  import.meta.env.DEV && (requestedBoot === 'console' || requestedBoot === 'normal')
    ? requestedBoot
    : selectBootVariant(bootStorage);

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Élément racine #root introuvable');

const root = createRoot(rootElement);

function mount(seedFailed: boolean) {
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <BootCurtain variant={bootVariant} />
        {seedFailed && <SeedErrorBanner />}
        <UpdateBanner />
        <RouterProvider router={router} />
      </ErrorBoundary>
    </StrictMode>,
  );
}

// Persistent projections have to be ready before the first screen queries
// them, so the opening screen holds until initialization resolves.
root.render(<BootScreen variant={bootVariant} />);

/**
 * Le rideau ne s'attarde pas quand une séance est en cours.
 *
 * Il présente l'app, et on ne présente pas une app à quelqu'un qui l'a ouverte
 * il y a huit minutes pour saisir sa série suivante. La règle n° 5 est
 * explicite : une main, en sueur, entre deux séries — deux secondes y sont un
 * mur, pas une entrée en matière. C'est le seul endroit où l'ouverture coûtait
 * quelque chose, et le seul où elle ne raconte plus rien.
 *
 * La condition est celle de la barre de reprise, pas une autre : une séance
 * périmée n'est pas une séance en cours, et son propriétaire mérite l'ouverture
 * comme tout le monde.
 *
 * Le minuteur part quand même et se fait couper : interroger la base **avant**
 * de l'armer ferait payer le temps de la requête à tous les démarrages, y
 * compris ceux qui gardent le rideau. Une base illisible ne saute rien — on
 * laisse alors le minuteur faire son travail.
 */
const openingHeld = holdBootOpening(
  BOOT_HOLD_MS[bootVariant],
  () =>
    getActiveWorkout().then(
      (active) => active !== undefined && !isWorkoutStale(active.startedAt),
      () => false,
    ),
  () => {
    if (bootVariant === 'console') scheduleNextBootEasterEgg(bootStorage);
  },
);

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
  openingHeld,
]).then(([seedFailed]) => mount(seedFailed));
