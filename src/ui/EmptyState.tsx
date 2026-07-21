import type { ReactNode } from 'react';

/**
 * An empty log is not a failure state, it is a gauge that has not moved yet.
 * A collection therefore shows its reading (`0` + unit) in the very same type it
 * will use once full. Anything that cannot be counted — no search result, a
 * broken screen — shows a `title` instead.
 */
type Props = { body: string; action?: ReactNode } & (
  | { reading: string; unit: string; title?: never }
  | { reading?: never; unit?: never; title: string }
);

export function EmptyState({ reading, unit, title, body, action }: Props) {
  return (
    // my-auto, not justify-center on the parent: it centres in whatever room is
    // left, and collapses harmlessly when there is none.
    <div className="my-auto flex flex-col items-center px-6 py-12 text-center">
      {reading === undefined ? (
        <h2 className="text-xl font-semibold text-[var(--text-1)]">{title}</h2>
      ) : (
        <>
          <p className="label-xs font-semibold text-[var(--text-2)]">{unit}</p>
          <p className="metric mt-3 text-7xl leading-none font-semibold text-[var(--text-1)]">
            {reading}
          </p>
        </>
      )}

      <p className="mt-5 max-w-[26ch] text-base leading-relaxed text-balance text-[var(--text-2)]">
        {body}
      </p>

      {action && <div className="mt-7 w-full max-w-64">{action}</div>}
    </div>
  );
}
