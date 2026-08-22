import { useEffect, useState } from 'react';

interface Measured {
  selector: string | null;
  rect: DOMRect | null;
}

const NOTHING: Measured = { selector: null, rect: null };

/**
 * La position réelle de l'élément mis en surbrillance, tant qu'il est là.
 *
 * Les deux couches du tutoriel mesuraient chacune leur cible dans **une seule**
 * `requestAnimationFrame`, jamais reprise ensuite. Or les ancres arrivent après
 * coup : une route paresseuse, une lecture Dexie, une carte d'exercice qui se
 * déplie. La mesure tombait donc régulièrement sur « rien », et le cadre ne
 * revenait plus jamais — c'est le décalage entre le cadre et l'élément dont on
 * parle, remonté du téléphone.
 *
 * Trois sources, une seule mesure par image :
 * - `MutationObserver` pour l'ancre qui apparaît ou disparaît ;
 * - `ResizeObserver` pour celle qui change de taille sur place ;
 * - défilement et redimensionnement pour celle qui bouge sans changer.
 */
export function useTutorialAnchor(selector: string | null): DOMRect | null {
  const [measured, setMeasured] = useState<Measured>(NOTHING);
  // La mesure porte le sélecteur qui l'a produite : changer de cible rend
  // l'ancienne caduque **pendant le rendu**, sans attendre un effet qui
  // remettrait l'état à zéro — c'est-à-dire sans une image où le cadre reste
  // sur la commande de l'étape précédente.
  const rect = measured.selector === selector ? measured.rect : null;

  useEffect(() => {
    if (selector === null) return;

    let frame = 0;
    let observed: HTMLElement | null = null;
    const size = new ResizeObserver(() => schedule());

    const measure = () => {
      frame = 0;
      const target = document.querySelector<HTMLElement>(selector);
      if (target !== observed) {
        if (observed !== null) size.unobserve(observed);
        if (target !== null) size.observe(target);
        observed = target;
      }
      const next = target?.getBoundingClientRect() ?? null;
      // Comparée et non remplacée : un `DOMRect` neuf à chaque image rendrait
      // la couche du tutoriel soixante fois par seconde pour rien.
      setMeasured((current) =>
        current.selector === selector && sameBox(current.rect, next)
          ? current
          : { selector, rect: next },
      );
    };

    function schedule() {
      if (frame === 0) frame = requestAnimationFrame(measure);
    }

    schedule();
    const tree = new MutationObserver(schedule);
    tree.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    // En capture : le défilement vit dans le conteneur de `Screen`, pas sur la
    // fenêtre, et un événement de défilement ne remonte pas.
    window.addEventListener('scroll', schedule, true);

    return () => {
      if (frame !== 0) cancelAnimationFrame(frame);
      tree.disconnect();
      size.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
    };
  }, [selector]);

  return rect;
}

function sameBox(a: DOMRect | null, b: DOMRect | null): boolean {
  if (a === null || b === null) return a === b;
  return a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height;
}
