import { Outlet } from 'react-router-dom';
import { ActiveWorkoutBar } from './ActiveWorkoutBar';
import { BottomNav } from './BottomNav';

/**
 * The navigation is a flex sibling of the scroll area rather than a fixed
 * overlay: it is pinned to the bottom of the viewport either way, but this way
 * no screen can ever hide its last row behind it.
 *
 * The resume bar sits in the same stack, above the tabs, for the same reason.
 * It draws nothing at all when no session is running.
 */
export function AppShell() {
  return (
    <div className="flex h-full flex-col bg-[var(--surface-0)]">
      {/* Le défilement est descendu dans `Screen`, entre son en-tête et sa barre
          d'action : c'est ce qui permet à cette barre d'être un frère flex comme
          la navigation, au lieu d'une superposition qui tranche le contenu. */}
      <main className="safe-top flex min-h-0 flex-1 flex-col">
        <Outlet />
      </main>
      <ActiveWorkoutBar />
      <BottomNav />
    </div>
  );
}
