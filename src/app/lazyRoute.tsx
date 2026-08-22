import { lazy, Suspense, type ComponentType } from 'react';

/**
 * A screen loaded on demand, wrapped in the frame its chunk arrives behind.
 *
 * **Why routes are deferred at all.** Everything `router.tsx` imports statically
 * lands in the chunk the app must download before the first screen paints — and
 * the path that matters is Accueil → Séance, in a basement, on a phone. The
 * import screen's CSV machinery, the debug screen, the programme editor are
 * none of them on that path, and were all being paid for on every cold start.
 * Rule n°2 is about the network being a bonus; a bundle is the one piece of
 * network you cannot make optional, so it is the one worth keeping small.
 *
 * **Why the loader names its export.** The screens export a named component,
 * not a default, and `React.lazy` insists on a default — so every call site was
 * repeating the same `.then((module) => ({ default: module.X }))`. Naming the
 * export instead keeps the mechanical half here and the call site readable.
 *
 * **An empty frame, not a spinner.** The chunk arrives from the cache in a
 * frame or two, and a spinner shown for 30 ms is a flash of anxiety, not
 * information. Kept verbatim from the analytics routes this generalises.
 */
export function lazyRoute<Name extends string>(
  load: () => Promise<Record<Name, ComponentType>>,
  name: Name,
): ComponentType {
  // Resolved through a typed local rather than inferred straight into `lazy`.
  // While `Name` is still a type parameter, `Record<Name, ComponentType>[Name]`
  // stays a deferred indexed access that JSX will not render with no props;
  // naming the value as a `ComponentType` collapses it once, here.
  const Screen = lazy(async () => {
    const component: ComponentType = (await load())[name];
    return { default: component };
  });

  return function LazyRoute() {
    return (
      <Suspense fallback={<span />}>
        <Screen />
      </Suspense>
    );
  };
}
