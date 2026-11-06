/**
 * Les règles des glitchs d'ambiance du thème Cyber, pures : des nombres et des booléens.
 *
 * Deux tailles. La DÉCHIRURE (tout l'écran se coupe en bandes, 250 ms) et le MICRO-GLITCH (un libellé
 * ou une icône tressaute, 170 ms). Décidé avec l'utilisateur : « Rares » — une déchirure toutes les 30
 * à 60 s au plus, un micro toutes les 10 à 20 s. L'arrivée sur un écran est une déchirure aussi, mais
 * déclenchée par la navigation, pas par ce rythme.
 */

export type GlitchKind = 'tear' | 'micro';

export const AMBIENT_PACE: Record<GlitchKind, readonly [number, number]> = {
  tear: [30_000, 60_000],
  micro: [10_000, 20_000],
};

/** Le délai avant le prochain glitch d'ambiance de ce genre. `random` est dans [0, 1). */
export function nextAmbientDelay(kind: GlitchKind, random: number): number {
  const [low, high] = AMBIENT_PACE[kind];
  return low + (high - low) * random;
}

/** Un doigt posé depuis moins que cela : on est en train de faire quelque chose, on ne trouble pas. */
export const TOUCH_QUIET_MS = 1_500;

export interface GlitchContext {
  now: number;
  lastTouchAt: number;
  /** Un champ a le focus : on saisit une charge, on ne secoue pas l'écran sous les chiffres. */
  typing: boolean;
  reducedMotion: boolean;
  hidden: boolean;
}

/** Un glitch d'ambiance ne tombe que sur un écran au repos, visible, pour qui veut du mouvement. */
export function mayGlitch(context: GlitchContext): boolean {
  return (
    !context.reducedMotion &&
    !context.hidden &&
    !context.typing &&
    context.now - context.lastTouchAt >= TOUCH_QUIET_MS
  );
}
