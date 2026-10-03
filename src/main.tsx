import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { BootCurtain, BootScreen, SeedErrorBanner } from './app/Boot';
import {
  bootHoldMs,
  getBootStorage,
  holdBootOpening,
  scheduleNextBootEasterEgg,
  selectBootVariant,
} from './app/bootEasterEgg';
import { ErrorBoundary } from './app/ErrorBoundary';
import { UpdateBanner } from './app/UpdateBanner';
import { initializePersistentData } from './data/initialize';
import { getFirstUseAt } from './data/repositories/firstUse';
import { getActiveWorkout } from './data/repositories/workouts';
import { isWorkoutStale } from './app/staleWorkout';
import { watchAppUpdate } from './platform/appUpdate';
import { watchInstall } from './platform/install';
import { watchNavDirection } from './app/navigation';
import { router } from './router';
import {
  isTty1Unlocked,
  unlockTty1,
  unlockTty1IfInUse,
  unlockTty1WhenSeasoned,
} from './stores/skinUnlock';
import { applyTheme, loadTheme } from './stores/theme';
import './index.css';

// index.html already set data-theme before first paint to avoid a flash; this
// re-applies it from the single source of truth so the two cannot drift. The theme is also
// what the opening reads: TTY1 opens on its console every time.
const theme = loadTheme();
applyTheme(theme);

// Both before `createRoot`, and both deliberately outside initialization:
// `beforeinstallprompt` can fire before the first render and is lost if nothing
// is listening, and registering the worker is what makes the *next* cold start
// work offline — neither has any reason to wait on the exercise catalogue.
watchInstall();
watchAppUpdate();
watchNavDirection();

const bootStorage = getBootStorage();
// La v2.8.0 a livré TTY1 ouvert : un thème mémorisé qui l'est déjà prouve que l'option était
// accessible, et la lui retirer serait une régression. Avant le choix de l'ouverture, qui le lit.
unlockTty1IfInUse(bootStorage, theme);

const requestedBoot = new URLSearchParams(window.location.search).get('boot');
const bootVariant =
  import.meta.env.DEV &&
  (requestedBoot === 'console' || requestedBoot === 'normal' || requestedBoot === 'tty1')
    ? requestedBoot
    : selectBootVariant(bootStorage, Date.now(), Math.random(), theme);

/**
 * La console rare qui débloque TTY1 le dit, et seulement ce jour-là.
 *
 * Décidé ici, avant le premier rendu, et jamais rediscuté : l'ancienneté, lue dans la base, peut
 * débloquer entre-temps, mais la première fois qu'on voit la console est la première fois qu'on la
 * voit, quoi que la base ait à dire plus tard.
 */
const unlocking = bootVariant === 'console' && !isTty1Unlocked(bootStorage);

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Élément racine #root introuvable');

const root = createRoot(rootElement);

function mount(seedFailed: boolean) {
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <BootCurtain variant={bootVariant} unlocking={unlocking} />
        {seedFailed && <SeedErrorBanner />}
        <UpdateBanner />
        <RouterProvider router={router} />
      </ErrorBoundary>
    </StrictMode>,
  );
}

// Persistent projections have to be ready before the first screen queries
// them, so the opening screen holds until initialization resolves.
root.render(<BootScreen variant={bootVariant} unlocking={unlocking} />);

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
  bootHoldMs(bootVariant, { unlocking }),
  () =>
    getActiveWorkout().then(
      (active) => active !== undefined && !isWorkoutStale(active.startedAt),
      () => false,
    ),
  () => {
    if (bootVariant !== 'console') return;
    // Les deux se consomment ensemble, et seulement ici : une console coupée par une séance en
    // cours n'a pas été vue, elle rejouera — et ne débloque rien.
    scheduleNextBootEasterEgg(bootStorage);
    unlockTty1(bootStorage);
  },
);

/**
 * Les deux attentes courent ensemble, jamais l'une après l'autre : le rideau
 * dure ce qu'il dure, et une base lente le prolonge au lieu de s'y ajouter.
 */
void Promise.all([
  initializePersistentData()
    .then(
      () => false,
      (error: unknown) => {
        // A failed seed must never leave a blank screen. The app starts anyway and
        // says so: the user's own data does not depend on the catalogue.
        console.error('Le seed du catalogue a échoué', error);
        return true;
      },
    )
    // Après le seed, qui crée les dates qu'elle lit — et même s'il a échoué : les lignes d'un
    // lancement précédent y sont encore. L'ancienneté débloque TTY1 sans cérémonie, avant que
    // Réglages, qui lit le drapeau une fois, ne soit monté.
    .then(async (seedFailed) => {
      await unlockTty1WhenSeasoned(bootStorage, getFirstUseAt);
      return seedFailed;
    }),
  openingHeld,
]).then(([seedFailed]) => mount(seedFailed));
