import { useEffect, useState } from 'react';
import { formatElapsed } from './elapsed';

/** Le temps écoulé depuis `startedAt`, rafraîchi chaque seconde (voir `ElapsedTime` pour le pourquoi). */
export function useElapsedReading(startedAt: number | undefined): string {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Pas encore lue (la requête vive de l'écran de fin) : rien à compter.
  return startedAt === undefined ? '' : formatElapsed((now - startedAt) / 1000);
}
