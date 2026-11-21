import { useCallback } from 'react';
import { useAppNavigate } from './navigation';

/**
 * La flèche retour d'un écran qu'on ouvre de plusieurs endroits : revenir là
 * d'où l'on vient, `fallback` quand il n'y a nulle part où revenir.
 *
 * Le test est l'index d'historique de React Router, pas `location.key` : une
 * arrivée par `replace` (création, lien profond) fabrique une clé neuve sans
 * quitter l'index 0, et `navigate(-1)` ne ferait alors silencieusement rien.
 * Même garde que la fiche exercice, mesurée sur le téléphone.
 */
export function useGoBack(fallback: string): () => void {
  const navigate = useAppNavigate();
  return useCallback(() => {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) void navigate(-1);
    else void navigate(fallback);
  }, [navigate, fallback]);
}
