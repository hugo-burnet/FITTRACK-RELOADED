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
      <main className="safe-top flex-1 overflow-y-auto overscroll-contain">
        <Outlet />
      </main>
      <ActiveWorkoutBar />
      <BottomNav />
    </div>
  );
}
