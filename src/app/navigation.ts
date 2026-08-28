import { useCallback } from 'react';
import { useNavigate, type NavigateOptions, type To } from 'react-router-dom';

/**
 * Le sens d'un déplacement. Le CSS le lit sur `<html>` pour choisir de quel
 * côté l'écran entre — et il n'y a que deux réponses possibles dans cette app :
 * on descend d'un cran, ou on remonte celui qu'on vient de descendre.
 */
export type NavDirection = 'forward' | 'back';

/**
 * Le sens du **prochain** déplacement, consommé puis remis à « on avance ».
 *
 * Un drapeau à un coup plutôt qu'un argument à chaque appel : la seule chose
 * qui remonte dans cette app est la flèche de l'en-tête, et elle vit à un seul
 * endroit (`Screen`). Passer le sens par les cinquante autres sites d'appel
 * reviendrait à leur faire répéter la réponse par défaut.
 */
let pending: NavDirection = 'forward';

/**
 * À appeler juste avant une navigation qui remonte d'un cran. Le prochain
 * déplacement, et lui seul, entrera par la gauche.
 */
export function navigatingBack(): void {
  pending = 'back';
}

/**
 * `useNavigate`, mais chaque déplacement devient une transition de vue.
 *
 * **Pourquoi passer par ici plutôt que par `useNavigate`.** Sans transition,
 * un écran n'a qu'une entrée : il paraît, et l'écran d'avant disparaît sans
 * rien dire. Aller et revenir produisaient donc exactement la même animation,
 * et l'app ne disait jamais dans quel sens on se déplaçait. `startViewTransition`
 * donne la moitié manquante — la sortie — et `data-nav` lui donne un sens.
 *
 * Là où l'API n'existe pas, React Router applique la mise à jour directement :
 * on retombe sur le comportement d'avant, sans branche à écrire.
 */
/**
 * Pose le sens sur les clics de `<Link>`, qui ne passent pas par le hook.
 *
 * React Router déclenche lui-même la transition d'un `<Link viewTransition>` :
 * personne ne lit `pending`, et le sens du déplacement précédent resterait
 * collé sur `<html>`. Concrètement, le premier clic après un retour repartait
 * vers la gauche. Un guetteur en capture, une fois, plutôt qu’un composant
 * enveloppant à faire adopter par les treize appelants et par les suivants.
 *
 * Posé depuis `main.tsx` avec les autres guetteurs globaux.
 */
export function watchNavDirection(): void {
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest('a[href]')) return;
      document.documentElement.dataset.nav = pending;
      pending = 'forward';
    },
    true,
  );
}

export function useAppNavigate() {
  const navigate = useNavigate();

  return useCallback(
    (to: To | number, options?: NavigateOptions) => {
      document.documentElement.dataset.nav = pending;
      pending = 'forward';

      if (typeof to === 'number') {
        // `navigate(-1)` n'accepte pas d'options : le sens se lit sur le signe.
        if (to < 0) document.documentElement.dataset.nav = 'back';
        return navigate(to);
      }

      return navigate(to, { viewTransition: true, ...options });
    },
    [navigate],
  );
}
