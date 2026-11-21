import { useId, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

/**
 * Passer d'une vue à l'autre du même objet, ou entre routes sœurs (DESIGN.md,
 * écart 6). Deux formes, un seul dessin.
 *
 * Choisir une valeur modifie une donnée (`Segmented`) ; ici on déplace le
 * regard, d'où le soulignement de l'encre d'accent, le même repère que la
 * `BottomNav` : naviguer n'est pas choisir, et l'aplat reste à la valeur.
 */

/** Colonnes égales, quel que soit le nombre d'onglets. */
const ROW = 'grid grid-flow-col auto-cols-[minmax(0,1fr)]';

const tabClass = (current: boolean) =>
  `relative flex min-h-12 items-center justify-center px-3 text-center text-base font-semibold hyphens-auto [overflow-wrap:anywhere]
   transition-colors duration-[var(--dur-1)] ease-[var(--ease-mech)] active:opacity-70
   ${current ? 'text-[var(--accent-ink)]' : 'text-[var(--text-2)]'}`;

/** Le repère de 3 px, le même atome que celui de la `BottomNav`, posé sous le libellé. */
function Mark({ current }: { current: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute bottom-0 left-1/2 h-[3px] w-5 -translate-x-1/2 rounded-t-full
        bg-[var(--accent-ink)] transition-transform duration-[var(--dur-1)]
        ease-[var(--ease-mech)] ${current ? 'scale-x-100' : 'scale-x-0'}`}
    />
  );
}

type ValueProps<V extends string | number> = {
  label: string;
  value: V;
  items: readonly { value: V; label: string }[];
  onChange: (value: V) => void;
  /** Le contenu de la vue courante : il est rendu dans le `tabpanel`. */
  children: ReactNode;
};

type RouteProps = {
  label: string;
  items: readonly { to: string; label: string }[];
};

function isRouteForm<V extends string | number>(
  props: ValueProps<V> | RouteProps,
): props is RouteProps {
  return !('value' in props);
}

export function Tabs<V extends string | number>(props: ValueProps<V> | RouteProps) {
  if (isRouteForm(props)) return <RouteTabs {...props} />;
  return <ValueTabs {...props} />;
}

function ValueTabs<V extends string | number>({
  label,
  value,
  items,
  onChange,
  children,
}: ValueProps<V>) {
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const selected = items.findIndex((item) => item.value === value);
  // Un seul onglet dans la tabulation : le courant, ou le premier si aucun ne l'est.
  const tabbable = selected === -1 ? 0 : selected;
  const tabId = (index: number) => `${base}-tab-${index}`;
  const panelId = `${base}-panel`;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = index + 1;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = index - 1;
    else return;
    event.preventDefault();
    next = (next + items.length) % items.length;
    refs.current[next]?.focus();
    const item = items[next];
    if (item !== undefined) onChange(item.value);
  };

  return (
    <div>
      <div role="tablist" aria-label={label} data-part="tabs" className={ROW}>
        {items.map((item, index) => {
          const current = index === selected;
          return (
            <button
              key={item.value}
              ref={(node) => {
                refs.current[index] = node;
              }}
              id={tabId(index)}
              type="button"
              role="tab"
              aria-selected={current}
              aria-controls={panelId}
              tabIndex={index === tabbable ? 0 : -1}
              onClick={() => {
                onChange(item.value);
              }}
              onKeyDown={(event) => {
                onKeyDown(event, index);
              }}
              className={tabClass(current)}
            >
              {item.label}
              <Mark current={current} />
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={panelId}
        aria-labelledby={selected === -1 ? undefined : tabId(selected)}
      >
        {children}
      </div>
    </div>
  );
}

function RouteTabs({ label, items }: RouteProps) {
  const { pathname } = useLocation();
  return (
    <nav aria-label={label} data-part="tabs" className={ROW}>
      {items.map((item) => {
        const current = pathname === item.to || pathname.startsWith(`${item.to}/`);
        return (
          <Link
            key={item.to}
            viewTransition
            to={item.to}
            aria-current={current ? 'page' : undefined}
            className={tabClass(current)}
          >
            {item.label}
            <Mark current={current} />
          </Link>
        );
      })}
    </nav>
  );
}
