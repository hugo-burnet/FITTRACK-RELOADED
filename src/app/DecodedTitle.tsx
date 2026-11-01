import { useEffect, useState } from 'react';
import { decodeFrame } from './decode';

const DURATION_MS = 360;
const FRAME_MS = 40;

/**
 * Le titre d'un écran, qui se décode lettre à lettre à son arrivée dans le thème Cyber — avec la
 * déchirure de `CyberGlitch`, c'est l'arrivée sur un écran. Ailleurs, et en mouvement réduit, le titre
 * tel quel.
 *
 * Le texte affiché est un état de ce composant, jamais un nœud que React possède réécrit à la main :
 * c'est ce qui rend le décodage sûr. Pendant qu'il joue, le bruit est caché aux lecteurs d'écran et le
 * vrai titre leur est donné à part.
 */
export function DecodedTitle({ text }: { text: string }) {
  const [frame, setFrame] = useState<string | null>(null);

  useEffect(() => {
    const cyber = document.documentElement.getAttribute('data-theme') === 'cyber';
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (!cyber || reduced) return;
    const start = Date.now();
    const tick = () => {
      const progress = (Date.now() - start) / DURATION_MS;
      setFrame(progress >= 1 ? null : decodeFrame(text, progress));
    };
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, FRAME_MS);
    const stop = setTimeout(() => {
      clearInterval(id);
      setFrame(null);
    }, DURATION_MS + FRAME_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [text]);

  if (frame === null) return text;
  return (
    <>
      <span aria-hidden="true">{frame}</span>
      <span className="sr-only">{text}</span>
    </>
  );
}
