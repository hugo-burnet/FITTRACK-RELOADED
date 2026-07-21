import { Outlet } from 'react-router-dom';
import { BottomNav } from './BottomNav';

/**
 * The navigation is a flex sibling of the scroll area rather than a fixed
 * overlay: it is pinned to the bottom of the viewport either way, but this way
 * no screen can ever hide its last row behind it.
 */
export function AppShell() {
  return (
    <div className="flex h-full flex-col bg-[var(--surface-0)]">
      <main className="safe-top flex-1 overflow-y-auto overscroll-contain">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
