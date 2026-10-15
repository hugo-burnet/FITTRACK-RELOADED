import type { RouteObject } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { router } from '@/router';
import { tutorialTopicForPath } from './tutorialScript';

/** Les adresses que l'appli déclare, à plat : `/analytics/records`, `/benchmark/:workoutId`… */
function addressesOf(routes: readonly RouteObject[], prefix = ''): string[] {
  return routes.flatMap((route) => {
    const own = route.path === undefined ? prefix : `${prefix.replace(/\/$/, '')}/${route.path.replace(/^\//, '')}`;
    return [own, ...addressesOf(route.children ?? [], own)];
  });
}

/**
 * Une route que le didacticiel ne connaît pas retombe sur l'accueil : son « ? » proposerait
 * « Expliquer cette page : Accueil » devant un écran qui n'en est pas un. C'est arrivé au bilan du
 * benchmark, qui est resté ainsi de la v2.12.0 à la v2.13.0 sans qu'aucun test ne le voie.
 *
 * Une nouvelle route doit donc, ou avoir son chapitre (`tutorialTopicForPath`), ou renoncer à l'aide
 * (`showTutorialHelp={false}`) **et** entrer dans cette liste, avec sa raison.
 */
const WITHOUT_HELP: readonly { prefix: string; why: string }[] = [
  { prefix: '/knowledge', why: 'le Guide pose KnowledgeScreenFrame, qui retire le « ? »' },
  { prefix: '/benchmark', why: 'le bilan du benchmark retire le « ? » lui-même' },
];

describe('le « ? » de chaque écran', () => {
  it('ne retombe sur l’accueil que sur l’accueil, ou sur un écran qui renonce à l’aide', () => {
    const addresses = [...new Set(addressesOf(router.routes))].filter((address) => address !== '' && address !== '/');
    expect(addresses.length).toBeGreaterThan(30);

    const fallbacks = addresses
      .filter((address) => tutorialTopicForPath(address) === 'home')
      .filter((address) => !WITHOUT_HELP.some(({ prefix }) => address.startsWith(prefix)));

    expect(fallbacks).toEqual([]);
  });

  it('ne garde dans la liste que des préfixes qui existent encore', () => {
    const addresses = addressesOf(router.routes);
    for (const { prefix } of WITHOUT_HELP) {
      expect(
        addresses.some((address) => address.startsWith(prefix)),
        prefix,
      ).toBe(true);
    }
  });
});
