import type { ReactNode } from 'react';

type Props = {
  title: string;
  /** Right-hand slot in the header: a count, an action. */
  action?: ReactNode;
  children: ReactNode;
};

/**
 * The frame every screen shares: one h1, one measure, one set of margins.
 * Centralised so no screen has to re-derive its own padding — the bottom of a
 * list disappearing behind the navigation is the classic bug here.
 */
export function Screen({ title, action, children }: Props) {
  return (
    <section className="mx-auto flex min-h-full w-full max-w-[36rem] flex-col px-4 pb-8">
      <header className="flex min-h-16 items-center justify-between gap-4 pt-5 pb-4">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text-1)]">{title}</h1>
        {action}
      </header>
      {/* Grows to fill the screen so a lone empty state can centre itself in it. */}
      <div className="flex flex-1 flex-col">{children}</div>
    </section>
  );
}
